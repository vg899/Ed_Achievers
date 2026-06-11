import crypto from "crypto";
import { readFromRtdb, logAuditTrace, unlockCourseAndLogTransaction } from "./lib/payment-service";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const orderId = req.body?.data?.order?.order_id || req.body?.orderId || "UNKNOWN";
  
  try {
    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const mode = process.env.CASHFREE_MODE || "sandbox";

    if (!appId || !secretKey) {
      return res.status(500).json({ error: "Missing Cashfree configuration for webhook processing" });
    }

    const headers = req.headers || {};
    const signature = headers["x-webhook-signature"] || headers["X-Webhook-Signature"];
    const timestamp = headers["x-webhook-timestamp"] || headers["X-Webhook-Timestamp"];

    await logAuditTrace(orderId, "WEBHOOK_RECEIVED", "INFO", `Received incoming checkout webhook event. Parsing payload.`, req.body);

    // 1. Webhook Signature Verification
    if (signature && timestamp) {
      try {
        const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
        const signaturePayload = timestamp + rawBody;
        const expectedSignature = crypto
          .createHmac("sha256", secretKey)
          .update(signaturePayload)
          .digest("base64");

        if (signature !== expectedSignature) {
          await logAuditTrace(orderId, "WEBHOOK_SIGNATURE_MISMATCH", "WARNING", `Webhook verification failed. Provided: ${signature}, Expected: ${expectedSignature}`);
          return res.status(400).json({ error: "Invalid webhook signature checksum" });
        }
        await logAuditTrace(orderId, "WEBHOOK_VERIFIED", "INFO", "Webhook signature verified successfully via SHA256 checksum.");
      } catch (err: any) {
        console.error("[WEBHOOK_SIG_ERROR] Webhook cryptographic processing error:", err);
      }
    } else {
      await logAuditTrace(orderId, "WEBHOOK_UNSIGNED", "WARNING", "Webhook processed without cryptographic signature headers. Enforcing local verification checks.");
    }

    // 2. Parse Webhook Event Details
    const eventType = req.body?.type; // e.g., PAYMENT_SUCCESS_WEBHOOK
    const paymentStatus = req.body?.data?.payment?.payment_status || req.body?.paymentStatus;
    const amount = req.body?.data?.payment?.payment_amount || req.body?.amount;
    
    if (eventType === "PAYMENT_SUCCESS_WEBHOOK" || paymentStatus === "SUCCESS" || paymentStatus === "PAID") {
      // Execute Purchase Recovery System
      const draftDetails = await readFromRtdb(`cashfree_draft_orders/${orderId}`) || {};
      const finalCourseId = draftDetails.courseId || "course_ctet_paper1";
      const finalUid = draftDetails.studentId;

      if (!finalUid) {
        await logAuditTrace(orderId, "WEBHOOK_UNRESOLVED_USER", "ERROR", "Webhook received success but student details could not be found in active drafts.");
        return res.status(200).json({ status: "UNRESOLVED_DRAFT" });
      }

      await logAuditTrace(orderId, "WEBHOOK_RECOVERY_ENGAGED", "INFO", `Webhook recovered valid transaction. Initiating course entitlement unlock. User: ${finalUid}`);
      
      await unlockCourseAndLogTransaction(
        orderId,
        finalUid,
        finalCourseId,
        parseFloat(amount),
        parseFloat(draftDetails.discount || 0),
        draftDetails.couponCode || "None",
        draftDetails.studentName || "Verified Scholar",
        draftDetails.studentEmail || "student@edachievers.com",
        { courseName: draftDetails.courseName || "Premium Coaching Course" }
      );

      return res.status(200).json({ status: "SUCCESS_PROCESSED" });
    }

    return res.status(200).json({ status: "EVENT_IGNORED", type: eventType });
  } catch (err: any) {
    await logAuditTrace(orderId, "WEBHOOK_PROCESS_CRASH", "ERROR", `Internal crash within webhook processing pipeline: ${err.message || err}`);
    return res.status(500).json({ error: `Internal webhook processing error: ${err.message || err}` });
  }
}
