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

// 2. Production Razorpay Payment System Gateway & Verification
import createOrderHandler from "./api/create-order";
import verifyPaymentHandler from "./api/verify-payment";
import checkPaymentStatusHandler from "./api/check-payment-status";
import paymentHealthHandler from "./api/payment-health";

// Bind routes to ensure backward compatibility and Razorpay standards
app.post("/api/create-order", createOrderHandler);
app.post("/api/razorpay/create-order", createOrderHandler);

app.get("/api/verify-payment", verifyPaymentHandler);
app.get("/api/razorpay/verify-payment", verifyPaymentHandler);

app.post("/api/verify-payment", verifyPaymentHandler);
app.post("/api/razorpay/verify-payment", verifyPaymentHandler);

app.get("/api/check-payment-status", checkPaymentStatusHandler);
app.get("/api/payment-health", paymentHealthHandler);

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
