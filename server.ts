import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK lazily to prevent crash if key is missing
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// 1. AI Study Assistant API
app.post("/api/gemini/assistant", async (req, res) => {
  try {
    const { message, exam, history } = req.body;
    const ai = getGemini();

    const systemInstruction = `
      You are the elite "Ed Achievers" AI Study Assistant, a native Indian mentor specialized in cracking prestigious Government Teacher Examinations:
      - CTET (Paper 1 & Paper 2)
      - KVS (PRT, TGT, PGT)
      - UPTET, DSSSB, Super TET
      
      Your goal is to provide high-yield, hyper-focused study strategies, custom study plans, clear explanations of pedagogical concepts (like Piaget, Vygotsky, CDP, Bloom's Taxonomy), exam marking patterns, and positive pedagogical motivation.
      Keep responses beautifully structured, clear, and highly practical. Focus strictly on helping the student score maximum marks.
    `;

    // Construct contents from conversational history if provided, or simple prompt
    let contents = "";
    if (exam) {
      contents += `[Target Exam: ${exam}]\n`;
    }
    contents += message;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || "I apologize, I could not process that request at this time. Please try again.";
    res.json({ reply });
  } catch (err: any) {
    console.error("Gemini Assistant Error:", err);
    res.status(500).json({ error: err.message || "Failed to contact Gemini API" });
  }
});

// 2. Production Cashfree Payment System Gateway & Verification
const verifiedOrdersStore = new Set<string>();

// Express handler for order creation
const createOrderHandler = async (req: any, res: any) => {
  try {
    const { courseId, courseName, price, couponCode, studentId, studentName, studentEmail, studentPhone } = req.body;

    console.log("[PAYMENT_DEBUG] Order Request Payload:", req.body);

    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const mode = process.env.CASHFREE_MODE || "sandbox";

    if (!appId || !secretKey) {
      console.error("[CASHFREE_ERROR] Missing Cashfree API credentials in environment.");
      return res.status(500).json({
        error: "Cashfree API configuration is incomplete. Missing CASHFREE_APP_ID or CASHFREE_SECRET_KEY in server environment.",
        details: "Please configure CASHFREE_APP_ID and CASHFREE_SECRET_KEY in application settings."
      });
    }

    if (!courseId) {
      return res.status(400).json({ error: "Validation Failure: Missing classroom course identifier (courseId)." });
    }
    if (!studentId) {
      return res.status(400).json({ error: "Validation Failure: Student must be logged in to create orders (studentId)." });
    }

    const rawPrice = parseFloat(price);
    if (isNaN(rawPrice) || rawPrice <= 0) {
      return res.status(400).json({ error: "Validation Failure: Subtotal price must be greater than zero." });
    }

    if (!studentName || studentName.trim() === "") {
      return res.status(400).json({ error: "Validation Failure: Billing Full Name is required." });
    }
    if (!studentEmail || studentEmail.trim() === "") {
      return res.status(400).json({ error: "Validation Failure: Billing Email address is required." });
    }
    const cleanPhone = studentPhone ? studentPhone.trim().replace(/\D/g, "") : "";
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ error: "Validation Failure: A valid 10-digit customer mobile phone number is required." });
    }

    // Secure discount computation on the server-side
    let finalAmount = rawPrice;
    let discount = 0;

    if (couponCode) {
      const code = couponCode.toUpperCase().trim();
      if (code === "ACHIEVERS10") {
        discount = finalAmount * 0.10;
      } else if (code === "FIRST50") {
        discount = finalAmount * 0.50;
      } else if (code === "GOVEXAM30") {
        discount = finalAmount * 0.30;
      } else if (code === "FIXED500") {
        discount = Math.min(finalAmount, 500);
      }
      finalAmount = Math.max(0, finalAmount - discount);
    }

    const orderId = "ORD_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

    const url = mode === "production" 
      ? "https://api.cashfree.com/pg/orders" 
      : "https://sandbox.cashfree.com/pg/orders";

    const host = req.get("host") || "localhost:3000";
    const protocol = req.protocol || "http";
    const returnUrl = `${protocol}://${host}/user.html?payment_status={payment_status}&order_id={order_id}&course_id=${courseId}&amount=${Math.round(finalAmount * 100) / 100}&discount=${Math.round(discount * 100) / 100}&coupon=${couponCode || ""}`;

    const requestBody = {
      order_id: orderId,
      order_amount: Math.round(finalAmount * 100) / 100,
      order_currency: "INR",
      customer_details: {
        customer_id: studentId.toString().substring(0, 50),
        customer_name: studentName,
        customer_email: studentEmail,
        customer_phone: cleanPhone
      },
      order_meta: {
        return_url: returnUrl
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-client-id": appId,
        "x-client-secret": secretKey,
        "x-api-version": "2023-08-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    const responseData = await response.json().catch(() => null);

    if (response.ok && responseData) {
      console.log("[PAYMENT_DEBUG] Cashfree API Order response:", responseData);
      console.log("[PAYMENT_DEBUG] Session Generated paymentSessionId:", responseData.payment_session_id);

      return res.json({
        orderId: responseData.order_id || orderId,
        paymentSessionId: responseData.payment_session_id,
        paymentUrl: responseData.payment_link || responseData.payments?.payment_link || `https://payments.cashfree.com/order/#${responseData.payment_session_id}`,
        finalAmount: Math.round(finalAmount * 100) / 100,
        discount: Math.round(discount * 100) / 100,
        courseId,
        courseName,
        studentId
      });
    } else {
      console.error("[CASHFREE_ERROR] Cashfree order creation API rejected integration:", response.status, responseData);
      
      const errorMsg = responseData && responseData.message 
        ? `${responseData.message} (Code: ${responseData.code || responseData.type || response.status})`
        : `Server returned HTTP Status ${response.status}`;

      return res.status(response.status || 400).json({
        error: errorMsg,
        details: responseData
      });
    }
  } catch (err: any) {
    console.error("[CASHFREE_ERROR] Order registry network or runtime failure:", err);
    return res.status(500).json({ 
      error: `Payment gateway connection is temporarily unavailable: ${err.message || err}`
    });
  }
};

// Express handler for payment verification
const verifyPaymentHandler = async (req: any, res: any) => {
  try {
    const { orderId, courseId, uid } = req.query;

    if (!orderId) {
      return res.status(400).json({ error: "Missing required orderId parameter" });
    }

    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const mode = process.env.CASHFREE_MODE || "sandbox";

    if (!appId || !secretKey) {
      console.error("[CASHFREE_ERROR] Missing Cashfree API verification credentials.");
      return res.status(500).json({
        error: "Cashfree verification failed: Server missing CASHFREE_APP_ID or CASHFREE_SECRET_KEY."
      });
    }

    const url = mode === "production" 
      ? `https://api.cashfree.com/pg/orders/${orderId}` 
      : `https://sandbox.cashfree.com/pg/orders/${orderId}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-client-id": appId,
        "x-client-secret": secretKey,
        "x-api-version": "2023-08-01",
        "Content-Type": "application/json"
      }
    });

    const orderInfo = await response.json().catch(() => null);

    if (response.ok && orderInfo) {
      const pStatus = orderInfo.order_status; // PAID, ACTIVE, EXPIRED, FAILED
      let finalStatus = "PENDING";
      if (pStatus === "PAID") {
        finalStatus = "SUCCESS";
        console.log(`[PAYMENT_DEBUG] Live Payment Verification Success for Order ID: ${orderId}`);
      } else if (pStatus === "EXPIRED" || pStatus === "FAILED") {
        finalStatus = "FAILED";
        console.log(`[PAYMENT_DEBUG] Live Payment Verification Failed for Order ID: ${orderId}`);
      } else {
        console.log(`[PAYMENT_DEBUG] Live Payment is in ${pStatus} state for Order ID: ${orderId}`);
      }

      let alreadyProcessed = false;
      if (finalStatus === "SUCCESS") {
        if (verifiedOrdersStore.has(orderId as string)) {
          alreadyProcessed = true;
        } else {
          verifiedOrdersStore.add(orderId as string);
        }
      }

      return res.json({
        verified: true,
        status: finalStatus,
        alreadyProcessed,
        orderId,
        amount: orderInfo.order_amount,
        courseId: courseId || null,
        uid: uid || null,
        cashfreeDetails: {
          status: orderInfo.order_status,
          currency: orderInfo.order_currency,
          message: "Verified with Cashfree Gateway API servers"
        }
      });
    } else {
      console.error("[CASHFREE_ERROR] Cashfree verification API rejected check, status:", response.status, orderInfo);
      return res.status(response.status || 400).json({
        verified: false,
        status: "FAILED",
        error: orderInfo?.message || `Cashfree verification failed with status ${response.status}`,
        details: orderInfo
      });
    }
  } catch (err: any) {
    console.error("[CASHFREE_ERROR] Live cashfree verification route network/runtime failure:", err);
    return res.status(500).json({
      verified: false,
      status: "FAILED",
      error: `Verification connection error: ${err.message || err}`
    });
  }
};

// Bind both routes to ensure backward compatibility and Vercel standards
app.post("/api/create-order", createOrderHandler);
app.post("/api/cashfree/create-order", createOrderHandler);

app.get("/api/verify-payment", verifyPaymentHandler);
app.get("/api/cashfree/verify-payment", verifyPaymentHandler);

// Serve frontend assets
if (process.env.NODE_ENV !== "production") {
  // We use Vite middleware in local development
  import("vite").then(async (viteModule) => {
    const viteInstance = await viteModule.createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(viteInstance.middlewares);
    
    // Serve index.html as fallback in development
    app.use("*", (req, res, next) => {
      res.sendFile(path.resolve("index.html"));
    });
  });
} else {
  // Use static folder for compiled assets in production
  app.use(express.static("dist"));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve("dist/index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Ed Achievers Premium backend booted on port ${PORT}`);
});
