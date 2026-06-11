import { IncomingMessage, ServerResponse } from "http";

interface VercelRequest extends IncomingMessage {
  body: any;
  query: any;
  cookies: any;
}

interface VercelResponse extends ServerResponse {
  send: (body: any) => VercelResponse;
  json: (body: any) => VercelResponse;
  status: (statusCode: number) => VercelResponse;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const { courseId, courseName, price, couponCode, studentId, studentName, studentEmail, studentPhone } = req.body || {};

    console.log("[VERCEL_SERVERLESS] Order Request Payload:", req.body);

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

    // Vercel apps run in a secure subdomain, use relative return_url safely via HTTP headers if available or generic host
    const host = req.headers.host || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
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
      console.log("[VERCEL_SERVERLESS] Cashfree API Order response:", responseData);
      console.log("[VERCEL_SERVERLESS] Session Generated paymentSessionId:", responseData.payment_session_id);

      return res.status(200).json({
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
      console.error("[CASHFREE_ERROR] Vercel serverless order creation rejected:", response.status, responseData);
      
      const errorMsg = responseData && responseData.message 
        ? `${responseData.message} (Code: ${responseData.code || responseData.type || response.status})`
        : `Server returned HTTP Status ${response.status}`;

      return res.status(response.status || 400).json({
        error: errorMsg,
        details: responseData
      });
    }
  } catch (err: any) {
    console.error("[CASHFREE_ERROR] Vercel serverless order registry crash:", err);
    return res.status(500).json({ 
      error: `Vercel Serverless Cashfree Error: ${err.message || err}`
    });
  }
}
