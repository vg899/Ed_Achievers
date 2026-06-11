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

  try {
    const urlObj = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
    const orderId = urlObj.searchParams.get("orderId");
    const courseId = urlObj.searchParams.get("courseId");
    const uid = urlObj.searchParams.get("uid");

    if (!orderId) {
      return res.status(400).json({ error: "Missing required orderId parameter" });
    }

    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const mode = process.env.CASHFREE_MODE || "sandbox";

    if (!appId || !secretKey) {
      console.error("[CASHFREE_ERROR] Missing Cashfree API credentials for Vercel verify-payment.");
      return res.status(500).json({
        error: "Cashfree verification failed: Server missing CASHFREE_APP_ID or CASHFREE_SECRET_KEY in environment variables."
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
        console.log(`[VERCEL_VERIFY_DEBUG] Live Serverless Verification Success for Order: ${orderId}`);
      } else if (pStatus === "EXPIRED" || pStatus === "FAILED") {
        finalStatus = "FAILED";
        console.log(`[VERCEL_VERIFY_DEBUG] Live Serverless Verification Failed for Order: ${orderId}`);
      } else {
        console.log(`[VERCEL_VERIFY_DEBUG] Live Serverless Payment is in ${pStatus} state for Order: ${orderId}`);
      }

      return res.status(200).json({
        verified: true,
        status: finalStatus,
        alreadyProcessed: false, // Client side handles DB write check through Firestore ref
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
      console.error("[CASHFREE_ERROR] Cashfree Vercel verification check rejected:", response.status, orderInfo);
      return res.status(response.status || 400).json({
        verified: false,
        status: "FAILED",
        error: orderInfo?.message || `Cashfree verification failed with status ${response.status}`,
        details: orderInfo
      });
    }
  } catch (err: any) {
    console.error("[CASHFREE_ERROR] Vercel verification connection failure:", err);
    return res.status(500).json({
      verified: false,
      status: "FAILED",
      error: `Verification connection error: ${err.message || err}`
    });
  }
}
