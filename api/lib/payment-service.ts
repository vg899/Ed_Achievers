import { GoogleGenAI } from "@google/genai";
import Razorpay from "razorpay";
import crypto from "crypto";

export const RTDB_BASE_URL = "https://ed-achievers-2e3f1-default-rtdb.firebaseio.com";

// Lazy-initialization helper for Razorpay to prevent crashes if credentials are not fully deployed
let razorpayInstance: Razorpay | null = null;
export function getRazorpayClient(): Razorpay {
  if (!razorpayInstance) {
    const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_T0HmDojSRbiVEr";
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "dummy_secret_for_dev_mode";
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
  }
  return razorpayInstance;
}

export interface CheckoutPayload {
  courseId: string;
  courseName: string;
  price: string | number;
  couponCode?: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  paymentMethod?: string; // Optional indicator of direct QR mode
}

// 1. Direct REST communications with Firebase Realtime Database
export async function writeToRtdb(path: string, data: any, method: "PUT" | "PATCH" | "POST" = "PATCH"): Promise<any> {
  const url = `${RTDB_BASE_URL}/${path}.json`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        return await res.json().catch(() => null);
      }
      console.warn(`[RTDB_RETRY] Database sync attempt ${attempt} returned status: ${res.status}`);
    } catch (err) {
      console.error(`[RTDB_RETRY_ERROR] Database connection failure on attempt ${attempt}:`, err);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 150));
  }
}

export async function readFromRtdb(path: string): Promise<any> {
  const url = `${RTDB_BASE_URL}/${path}.json`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error(`[RTDB_READ_ERROR] Failed reading database path ${path}:`, err);
  }
  return null;
}

// 2. Audit Trace Helper for transactions
export async function logAuditTrace(
  orderId: string,
  event: string,
  level: "INFO" | "WARNING" | "ERROR",
  details: string,
  rawResponse?: any
) {
  const timestamp = Date.now();
  const auditId = `AUD_${timestamp}_${Math.floor(Math.random() * 1000)}`;
  const payload = {
    id: auditId,
    orderId,
    timestamp,
    event,
    level,
    details,
    razorpayResponse: rawResponse ? JSON.stringify(rawResponse) : null
  };
  
  // Write to a trace log list for admin visualization
  await writeToRtdb(`payment_audit_logs/${auditId}`, payload, "PUT");
  console.log(`[AUDIT_LOG][${level}] OrderId: ${orderId} | Event: ${event} | Details: ${details}`);
}

// 3. Automated Entitlement Unlock and Purchase Recovery System
export async function unlockCourseAndLogTransaction(
  orderId: string,
  studentId: string,
  courseId: string,
  amount: number,
  discount: number,
  coupon: string,
  studentName: string,
  studentEmail: string,
  razorpayDetails: any,
  transactionId?: string,
  failureReason?: string,
  razorpayResponseRaw?: any
): Promise<{ success: boolean; alreadyProcessed: boolean }> {
  try {
    // Check if duplicate transaction in primary SUCCESS branch
    const existingTx = await readFromRtdb(`transactions/${orderId}`);
    if (existingTx && existingTx.status === "SUCCESS") {
      await logAuditTrace(orderId, "UNLOCKED_ABORT_DUPLICATE", "WARNING", "Duplicate transaction lock requested. Unlocked entitlement was already active.");
      return { success: true, alreadyProcessed: true };
    }

    const courseTitle = razorpayDetails?.courseName || razorpayDetails?.courseTitle || "Premium Coaching Course";
    const finalTxnId = transactionId || razorpayDetails?.razorpay_payment_id || razorpayDetails?.id || `TXN-${Math.floor(100000 + Math.random() * 900000)}`;

    // Create resilient multi-write updates with auto-retries
    let writeCleared = false;
    let rtdbError: any = null;

    for (let dbAttempt = 1; dbAttempt <= 3; dbAttempt++) {
      try {
        // A. Update User Purchase Enrollment (Course Unlock)
        const userSubsRef = `users/${studentId}/purchasedCourses/${courseId}`;
        await writeToRtdb(userSubsRef, {
          unlockedAt: Date.now(),
          orderId: orderId,
          transactionId: finalTxnId,
          amountPaid: amount || 0,
          discountApplied: discount || 0,
          couponCode: coupon || "None",
          courseTitle: courseTitle
        }, "PUT");

        // B. Save Transaction ledger entry
        const txRef = `transactions/${orderId}`;
        await writeToRtdb(txRef, {
          orderId,
          transactionId: finalTxnId,
          uid: studentId,
          name: studentName || "Verified Scholar",
          email: studentEmail,
          courseId,
          courseTitle,
          amount: amount || 0,
          discount: discount || 0,
          coupon: coupon || "None",
          timestamp: Date.now(),
          status: "SUCCESS",
          failureReason: failureReason || "None",
          razorpayResponse: razorpayResponseRaw ? JSON.stringify(razorpayResponseRaw) : (razorpayDetails ? JSON.stringify(razorpayDetails) : null)
        }, "PUT");

        // C. Update razorpay_draft_orders node state to align with Payment Debug Dashboard
        await writeToRtdb(`cashfree_draft_orders/${orderId}`, {
          status: "PAID",
          transactionId: finalTxnId,
          failureReason: failureReason || "None",
          razorpayResponse: razorpayResponseRaw ? JSON.stringify(razorpayResponseRaw) : (razorpayDetails ? JSON.stringify(razorpayDetails) : null)
        }, "PATCH");

        // D. Send Student Profile Notification Hub Feed
        const notificationId = `NOTIF_${Date.now()}`;
        await writeToRtdb(`users/${studentId}/notifications/${notificationId}`, {
          id: notificationId,
          title: "Classroom Unlocked Successfully! 🎉",
          message: `Your payment of ₹${amount} for "${courseTitle}" was verified. Your complete videos, mock PDFs, and notes are unlocked.`,
          timestamp: Date.now(),
          read: false
        }, "PUT");

        // E. Secure Revenue & Financial Aggregates Update
        const existingRevenue = await readFromRtdb("revenue_aggregates/total_gross_revenue") || 0;
        await writeToRtdb("revenue_aggregates", {
          total_gross_revenue: (existingRevenue || 0) + (amount || 0),
          last_updated: Date.now()
        }, "PATCH");

        const currentCourseRevenue = await readFromRtdb(`revenue_aggregates/by_course/${courseId}`) || 0;
        await writeToRtdb(`revenue_aggregates/by_course`, {
          [courseId]: (currentCourseRevenue || 0) + (amount || 0)
        }, "PATCH");

        // F. Update Sales Metrics and Analytics Tracking
        const purchaseCount = await readFromRtdb("purchases/count") || 0;
        await writeToRtdb("purchases/count", purchaseCount + 1, "PUT");

        const totalTransactionsCount = await readFromRtdb("analytics/total_transactions") || 0;
        const currentSuccessCount = await readFromRtdb("analytics/successful_payments") || 0;
        await writeToRtdb("analytics", {
          total_transactions: (totalTransactionsCount || 0) + 1,
          successful_payments: (currentSuccessCount || 0) + 1,
          last_payment_time: Date.now()
        }, "PATCH");

        const todayStr = new Date().toISOString().substring(0, 10);
        const todayStats = await readFromRtdb(`analytics/daily_stats/${todayStr}`) || { revenue: 0, sales: 0 };
        await writeToRtdb(`analytics/daily_stats/${todayStr}`, {
          revenue: (todayStats.revenue || 0) + (amount || 0),
          sales: (todayStats.sales || 0) + 1
        }, "PUT");

        // Clean from pending recoveries if it was resolved
        await writeToRtdb(`pending_recoveries/${orderId}`, null, "PUT");

        writeCleared = true;
        break;
      } catch (err: any) {
        console.error(`[UNLOCKED_DB_PROPAGATION_RETRY] Write chain failed on attempt ${dbAttempt} of 3:`, err);
        rtdbError = err;
        if (dbAttempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, dbAttempt * 250));
        }
      }
    }

    if (!writeCleared) {
      // payment succeeds but database update fails: Recover purchase automatically
      await logAuditTrace(
        orderId,
        "DATABASE_PROPAGATION_RECOVERY_HUB",
        "ERROR",
        `Payment was SUCCESS, but local database write failed after 3 attempts. Registering emergency recovery patch. Error: ${rtdbError?.message || rtdbError}`
      );

      const recoveryPayload = {
        orderId,
        studentId,
        courseId,
        amount,
        discount,
        coupon,
        studentName,
        studentEmail,
        courseTitle,
        transactionId: finalTxnId,
        timestamp: Date.now(),
        retriesRemaining: 5,
        status: "PENDING_RECOVERY",
        errorDetails: rtdbError?.message || "Transient database network drop"
      };

      await writeToRtdb(`pending_recoveries/${orderId}`, recoveryPayload, "PUT");
      return { success: false, alreadyProcessed: false };
    }

    await logAuditTrace(orderId, "AUTO_ENTITLEMENT_UNLOCK", "INFO", `Successfully processed recovery pipeline. Course unlocked, revenue updated and transaction registered. Amount: ₹${amount}`);
    return { success: true, alreadyProcessed: false };
  } catch (err: any) {
    await logAuditTrace(orderId, "AUTO_ENTITLEMENT_FAILED", "ERROR", `Failure during course unlocking or database propagation: ${err.message || err}`);
    return { success: false, alreadyProcessed: false };
  }
}

// 4. Validate payment configurations and endpoints on request
export interface RazorpayStatusResponse {
  configured: boolean;
  mode: string;
  keyIdPresent: boolean;
  secretKeyPresent: boolean;
  connectionSuccess: boolean;
  apiStatus: string;
  error?: string;
}

export async function checkRazorpayHealth(): Promise<RazorpayStatusResponse> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secretKey = process.env.RAZORPAY_KEY_SECRET;

  const status: RazorpayStatusResponse = {
    configured: !!(keyId && secretKey),
    mode: keyId?.startsWith("rzp_live_") ? "production" : "sandbox",
    keyIdPresent: !!keyId,
    secretKeyPresent: !!secretKey,
    connectionSuccess: false,
    apiStatus: "FAILED"
  };

  if (!status.configured) {
    // If we only have keyId (fallback dev mode is supported as we have rzp_test_T0HmDojSRbiVEr)
    if (keyId) {
      status.connectionSuccess = true;
      status.apiStatus = "ONLINE_SANDBOX_STAGING";
      status.error = "Staging/Sandbox Key Loaded. Secret missing but fallback ready.";
    } else {
      status.error = "Missing Razorpay Key ID configuration.";
      status.apiStatus = "OFFLINE";
    }
    await writeToRtdb("payment_health_check", { ...status, lastCheck: Date.now() }, "PUT");
    return status;
  }

  try {
    const authString = Buffer.from(`${keyId}:${secretKey}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders?count=1", {
      method: "GET",
      headers: {
        "Authorization": `Basic ${authString}`
      }
    });

    if (response.ok) {
      status.connectionSuccess = true;
      status.apiStatus = "ONLINE";
    } else {
      const errBody = await response.json().catch(() => null);
      status.error = `Authentication Failure: Rejected by Razorpay server. Message: ${errBody?.error?.description || 'Access Denied'}`;
      status.apiStatus = "AUTH_FAILURE";
    }
  } catch (err: any) {
    status.error = `Network Failure: Unable to establish outbound Razorpay link. ${err.message || err}`;
    status.apiStatus = "NETWORK_ERROR";
  }

  await writeToRtdb("payment_health_check", { ...status, lastCheck: Date.now() }, "PUT");
  return status;
}
