import { GoogleGenAI } from "@google/genai";

export const RTDB_BASE_URL = "https://ed-achievers-2e3f1-default-rtdb.firebaseio.com";

export interface CheckoutPayload {
  courseId: string;
  courseName: string;
  price: string | number;
  couponCode?: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
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
    cashfreeResponse: rawResponse ? JSON.stringify(rawResponse) : null
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
  cashfreeDetails: any,
  transactionId?: string,
  failureReason?: string,
  cashfreeResponseRaw?: any
): Promise<{ success: boolean; alreadyProcessed: boolean }> {
  try {
    // Check if duplicate transaction in primary SUCCESS branch
    const existingTx = await readFromRtdb(`transactions/${orderId}`);
    if (existingTx && existingTx.status === "SUCCESS") {
      await logAuditTrace(orderId, "UNLOCKED_ABORT_DUPLICATE", "WARNING", "Duplicate transaction lock requested. Unlocked entitlement was already active.");
      return { success: true, alreadyProcessed: true };
    }

    const courseTitle = cashfreeDetails?.courseName || cashfreeDetails?.order_note || "Premium Training Course";
    const finalTxnId = transactionId || cashfreeDetails?.cf_payment_id || cashfreeDetails?.transactionId || `TXN-${Math.floor(100000 + Math.random() * 900000)}`;

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
          cashfreeResponse: cashfreeResponseRaw ? JSON.stringify(cashfreeResponseRaw) : (cashfreeDetails ? JSON.stringify(cashfreeDetails) : null)
        }, "PUT");

        // C. Update cashfree_draft_orders node state to align with Payment Debug Dashboard
        await writeToRtdb(`cashfree_draft_orders/${orderId}`, {
          status: "PAID",
          transactionId: finalTxnId,
          failureReason: failureReason || "None",
          cashfreeResponse: cashfreeResponseRaw ? JSON.stringify(cashfreeResponseRaw) : (cashfreeDetails ? JSON.stringify(cashfreeDetails) : null)
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
export interface CashfreeStatusResponse {
  configured: boolean;
  mode: string;
  appIdPresent: boolean;
  secretKeyPresent: boolean;
  connectionSuccess: boolean;
  apiStatus: string;
  error?: string;
}

export async function checkCashfreeHealth(): Promise<CashfreeStatusResponse> {
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;
  const mode = process.env.CASHFREE_MODE || "sandbox";

  const status: CashfreeStatusResponse = {
    configured: !!(appId && secretKey),
    mode,
    appIdPresent: !!appId,
    secretKeyPresent: !!secretKey,
    connectionSuccess: false,
    apiStatus: "FAILED"
  };

  if (!status.configured) {
    status.error = "Missing app ID or API secret key configuration.";
    await writeToRtdb("payment_health_check", { ...status, lastCheck: Date.now() }, "PUT");
    return status;
  }

  // Ping cashfree api servers using standard request to test credential authentication
  try {
    const url = mode === "production" 
      ? "https://api.cashfree.com/pg/orders/HEALTHTEST_NON_EXISTENT_PING" 
      : "https://sandbox.cashfree.com/pg/orders/HEALTHTEST_NON_EXISTENT_PING";

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-client-id": appId!,
        "x-client-secret": secretKey!,
        "x-api-version": "2023-08-01",
        "Content-Type": "application/json"
      }
    });

    // Cashfree returns 404 for non-existent order, but if credentials are correct, it does NOT return 401/403
    if (response.status !== 401 && response.status !== 403) {
      status.connectionSuccess = true;
      status.apiStatus = "ONLINE";
    } else {
      const errBody = await response.json().catch(() => null);
      status.error = `Authentication Failure: Rejected by Cashfree server with Status Code ${response.status}. Message: ${errBody?.message || 'Access Denied'}`;
      status.apiStatus = "AUTH_FAILURE";
    }
  } catch (err: any) {
    status.error = `Network Failure: Unable to establish outbound PG link. ${err.message || err}`;
    status.apiStatus = "NETWORK_ERROR";
  }

  await writeToRtdb("payment_health_check", { ...status, lastCheck: Date.now() }, "PUT");
  return status;
}
