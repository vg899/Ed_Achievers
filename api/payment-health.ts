import { checkCashfreeHealth, readFromRtdb } from "./lib/payment-service";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const health = await checkCashfreeHealth();
    
    // Supplement with operational statistics from our database
    const draftStats = await readFromRtdb("cashfree_draft_orders") || {};
    const successList = await readFromRtdb("transactions") || {};
    
    const draftCount = Object.keys(draftStats).length;
    const successCount = Object.keys(successList).length;

    return res.status(200).json({
      status: "OK",
      timestamp: Date.now(),
      gatewayHealth: health,
      operationalTelemetry: {
        totalDraftOrdersCreated: draftCount,
        totalPurchasesUnlocked: successCount,
        successRatePercentage: draftCount > 0 ? Math.round((successCount / draftCount) * 100) : 100
      }
    });
  } catch (err: any) {
    console.error("[HEALTH_CHECK_ERROR] Internal monitoring failure:", err);
    return res.status(500).json({
      status: "DEGRADED",
      error: err.message || err
    });
  }
}
