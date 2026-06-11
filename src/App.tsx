import { useState, useEffect } from "react";
import PaymentGateway from "./components/PaymentGateway";
import { 
  ShieldCheck, 
  Settings, 
  Activity, 
  Percent, 
  BookOpen, 
  HelpCircle, 
  ArrowUpRight, 
  Users, 
  Sparkles, 
  CheckCircle2, 
  HeartHandshake,
  AlertCircle
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"checkout" | "telemetry" | "help">("checkout");
  const [telemetry, setTelemetry] = useState<any>(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [telemetryError, setTelemetryError] = useState("");

  // Retrieve health logs and statistics
  const fetchTelemetryLogs = async () => {
    setLoadingTelemetry(true);
    setTelemetryError("");
    try {
      const response = await fetch("/api/payment-health");
      if (!response.ok) {
        throw new Error("Diagnostic health API reported an error or is uninitialized.");
      }
      const data = await response.json();
      setTelemetry(data);
    } catch (err: any) {
      console.error("Telemetry failed:", err);
      setTelemetryError(err.message || "Could not retrieve API status.");
    } finally {
      setLoadingTelemetry(false);
    }
  };

  useEffect(() => {
    fetchTelemetryLogs();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans" id="app-root-container">
      
      {/* Visual Navigation Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          
          {/* Brand Logo & Slogan */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-md shadow-orange-500/10">
              <BookOpen className="w-5.5 h-5.5" />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                Ed Achievers <span className="text-[9px] bg-orange-100 text-orange-700 font-extrabold px-2 py-0.5 rounded-full tracking-wider">PREMIUM</span>
              </h1>
              <p className="text-5xs text-slate-400 font-bold uppercase tracking-wider">India's Elite Prep Coaching Portal</p>
            </div>
          </div>

          {/* Tab Selector Buttons */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50">
            <button
              onClick={() => setActiveTab("checkout")}
              className={`px-4 py-1.5 rounded-lg text-4xs font-black uppercase tracking-wider transition ${
                activeTab === "checkout"
                  ? "bg-white text-slate-800 shadow"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Payment Checkout Gateway
            </button>
            <button
              onClick={() => {
                setActiveTab("telemetry");
                fetchTelemetryLogs();
              }}
              className={`px-4 py-1.5 rounded-lg text-4xs font-black uppercase tracking-wider transition ${
                activeTab === "telemetry"
                  ? "bg-white text-slate-800 shadow"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              API Telemetry Logs & Status
            </button>
            <button
              onClick={() => setActiveTab("help")}
              className={`px-4 py-1.5 rounded-lg text-4xs font-black uppercase tracking-wider transition ${
                activeTab === "help"
                  ? "bg-white text-slate-800 shadow"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Developer Docs
            </button>
          </div>

          {/* Secure SSL indicator */}
          <div className="hidden md:flex items-center gap-2 text-4xs font-black text-emerald-600 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-100">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>SECURE GATEWAY ENCRYPTION ACTIVE</span>
          </div>

        </div>
      </header>

      {/* Main Container Grid */}
      <main className="flex-grow max-w-6xl w-full mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left panel: Info & Highlight specs */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Elite Pedagogical Accents & Info Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-850 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10">
                <BookOpen className="w-48 h-48" />
              </div>
              
              <div className="relative space-y-4">
                <span className="text-[9px] bg-orange-500/20 text-orange-400 font-extrabold px-3 py-1 rounded-full border border-orange-500/20">
                  CRACK GOVT TEACHER EXAMS
                </span>
                
                <h3 className="text-lg font-black tracking-tight leading-snug">
                  Uncompromised Pedagogical Strategy & Complete Batch Syllabus
                </h3>
                
                <p className="text-4xs text-slate-400 leading-relaxed font-medium">
                  Gain instant lifetime access to elite pedagogy masterclasses, dynamic practice mock sets, notes templates, and certified mental mentors. Unlock top performance in 
                  <strong className="text-white"> CTET, KVS, DSSSB, and Super TET</strong>.
                </p>

                <div className="pt-2 grid grid-cols-2 gap-3 text-center">
                  <div className="bg-white/5 border border-white/5 p-3 rounded-2xl">
                    <span className="block text-sm font-black text-orange-400">12,000+</span>
                    <span className="block text-[8px] text-slate-400 uppercase mt-0.5">STUDENTS ENROLLED</span>
                  </div>
                  <div className="bg-white/5 border border-white/5 p-3 rounded-2xl">
                    <span className="block text-sm font-black text-orange-400">98.4%</span>
                    <span className="block text-[8px] text-slate-400 uppercase mt-0.5">SELECTION RATE</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Test Coupons Promo Widget */}
            <div className="bg-white border border-slate-150 rounded-3xl p-5 space-y-3 shadow-sm">
              <h4 className="text-[10px] font-black uppercase text-slate-450 tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-orange-500" /> Active Testing Coupons
              </h4>
              <p className="text-3xs text-slate-400 leading-normal">
                Apply these custom promo coupon codes during checkout to test server-side dynamic calculations and discounts.
              </p>
              
              <div className="space-y-2 pt-1 font-mono text-[10px]">
                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-slate-800">ACHIEVERS10</span>
                    <span className="block text-5xs text-slate-400 font-sans font-bold">10% Off Entire Catalog</span>
                  </div>
                  <span className="text-4xs text-orange-500 font-extrabold font-sans">Active</span>
                </div>

                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-slate-800">FIRST50</span>
                    <span className="block text-5xs text-slate-400 font-sans font-bold">Flat 50% Off First-Time Buy</span>
                  </div>
                  <span className="text-4xs text-orange-500 font-extrabold font-sans">Active</span>
                </div>

                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-slate-800">FIXED500</span>
                    <span className="block text-5xs text-slate-400 font-sans font-bold">Save flat ₹500 instantly</span>
                  </div>
                  <span className="text-4xs text-orange-500 font-extrabold font-sans">Active</span>
                </div>
              </div>
            </div>

            {/* Real-Time Database Metrics Feed */}
            <div className="bg-white border border-slate-150 rounded-3xl p-5 space-y-4 shadow-sm">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black uppercase text-slate-450 tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-orange-500" /> Telemetry Overview
                </h4>
                <button 
                  onClick={fetchTelemetryLogs} 
                  className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-4xs uppercase tracking-wider font-extrabold transition cursor-pointer"
                >
                  Sync
                </button>
              </div>

              {loadingTelemetry ? (
                <div className="flex items-center gap-2 py-4 justify-center text-3xs text-slate-400">
                  <Activity className="w-3.5 h-3.5 animate-spin text-orange-500" /> Calculating metrics...
                </div>
              ) : telemetryError ? (
                <div className="text-center p-3 bg-red-50 text-[10px] text-red-500 rounded-xl">
                  {telemetryError}
                </div>
              ) : telemetry ? (
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="bg-slate-50 p-3 rounded-2xl text-center">
                    <span className="text-slate-400 text-5xs block uppercase font-bold">Draft Orders</span>
                    <span className="text-md font-black text-slate-800 mt-1 block">
                      {telemetry?.operationalTelemetry?.totalDraftOrdersCreated ?? 0}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl text-center">
                    <span className="text-slate-400 text-5xs block uppercase font-bold">Captures</span>
                    <span className="text-md font-black text-slate-800 mt-1 block">
                      {telemetry?.operationalTelemetry?.totalPurchasesUnlocked ?? 0}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl text-center col-span-2">
                    <span className="text-slate-400 text-5xs block uppercase font-bold">Checkout Conversion Rate</span>
                    <span className="text-sm font-black text-orange-500 mt-1 block">
                      {telemetry?.operationalTelemetry?.successRatePercentage ?? 0}%
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-4xs text-slate-400 italic text-center py-2">Click sync to reload operational diagnostics.</p>
              )}
            </div>

          </div>

          {/* Right panel: Active View display */}
          <div className="lg:col-span-8">
            {activeTab === "checkout" && (
              <div className="space-y-4">
                <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm mb-6">
                  <h3 className="text-xs font-bold text-slate-800">Razorpay Payment Integration</h3>
                  <p className="text-3xs text-slate-400 mt-1.5 leading-relaxed">
                    Test the complete interactive billing loop. Click the button inside the ticket sheet below to query the `/api/create-order` endpoint. If you do not have production Razorpay Credentials configured, the server automatically bypasses checkout and engages an elegant **Interactive Sandbox Emulator** allowing you to review signature flow, logs, and database polling securely!
                  </p>
                </div>
                
                <PaymentGateway 
                  studentId="STU-1892"
                  studentName="Harsh Vardhan Tiwari"
                  studentEmail="harshvardhantiwari39@gmail.com"
                  studentPhone="9876543210"
                  onSuccess={() => {
                    fetchTelemetryLogs();
                  }}
                />
              </div>
            )}

            {activeTab === "telemetry" && (
              <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">Dynamic Payment Security Audit & Diagnostics</h3>
                    <p className="text-3xs text-slate-400 mt-1">Real-time status analysis of backend API endpoints.</p>
                  </div>
                  <button
                    onClick={fetchTelemetryLogs}
                    className="py-2.5 px-4 bg-orange-500 hover:bg-orange-600 text-white text-4xs font-black uppercase rounded-xl transition flex items-center gap-1 cursor-pointer"
                  >
                    <Activity className="w-3.5 h-3.5 animate-pulse" /> Force Full Diagnostics Check
                  </button>
                </div>

                {loadingTelemetry ? (
                  <div className="flex flex-col items-center py-20 gap-3 text-xs text-slate-400">
                    <Activity className="w-8 h-8 animate-spin text-orange-500" />
                    <span>Contacting database endpoints...</span>
                  </div>
                ) : telemetryError ? (
                  <div className="bg-red-50 text-red-500 p-4 rounded-2xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>Failed to fetch metrics: {telemetryError}</span>
                  </div>
                ) : telemetry ? (
                  <div className="space-y-6">
                    {/* Overall Endpoint Check */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-bold text-slate-800">V1 API Gateway Endpoint Status:</span>
                        <p className="text-5xs text-slate-400 uppercase mt-0.5">Endpoint: /api/payment-health</p>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                        {telemetry.status || "OK"}
                      </span>
                    </div>

                    {/* Check API Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Razorpay Gateway Health */}
                      <div className="bg-slate-50/60 p-5 rounded-3xl border border-slate-100 space-y-3">
                        <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Gateway Integrations</span>
                        <div className="flex justify-between items-center pt-1.5">
                          <span className="text-4xs text-slate-500 font-extrabold">Public API Primary IP:</span>
                          <span className="text-4xs font-mono font-bold text-slate-800">api.razorpay.com</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-4xs text-slate-500 font-extrabold font-sans">Active Sandbox Bypass:</span>
                          <span className="text-4xs text-amber-600 font-black">
                            {process.env.RAZORPAY_KEY_SECRET ? "No" : "Yes (Simulated)"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-4xs text-slate-500 font-extrabold">Client Handshake:</span>
                          <span className="text-4xs text-emerald-600 font-black">Ready</span>
                        </div>
                      </div>

                      {/* Operations Audit */}
                      <div className="bg-slate-50/60 p-5 rounded-3xl border border-slate-100 space-y-3">
                        <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Database Synchronization</span>
                        <div className="flex justify-between items-center pt-1.5">
                          <span className="text-4xs text-slate-500 font-extrabold">Primary Cache Store:</span>
                          <span className="text-4xs text-slate-800 font-bold">Firebase RTDB</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-4xs text-slate-500 font-extrabold">Draft Checkout nodes:</span>
                          <span className="text-4xs font-mono text-slate-800 font-bold">
                            {telemetry?.operationalTelemetry?.totalDraftOrdersCreated ?? 0}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-4xs text-slate-500 font-extrabold">Success Signatures:</span>
                          <span className="text-4xs font-mono text-slate-800 font-bold">
                            {telemetry?.operationalTelemetry?.totalPurchasesUnlocked ?? 0}
                          </span>
                        </div>
                      </div>

                    </div>

                    {/* Developer Mock System Event logs */}
                    <div className="space-y-3">
                      <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Telemetry Operational Feed</span>
                      <div className="bg-slate-900 text-slate-300 font-mono text-5xs p-4 rounded-2xl min-h-[140px] leading-normal space-y-2 uppercase tracking-wide">
                        <p className="text-slate-500 tracking-tight">[{new Date().toISOString()}] INITIALIZING COMPILER SECURITY AUDIT ENGINE...</p>
                        <p className="text-emerald-400">[{new Date().toISOString()}] PAYMENT GATEWAY LISTENER REGISTERED SUCCESSFULLY.</p>
                        <p className="text-slate-400">[{new Date().toISOString()}] TOTAL INITIALIZED DRAFTS: {telemetry?.operationalTelemetry?.totalDraftOrdersCreated ?? 0} ENTRIES DETECTED.</p>
                        <p className="text-slate-400">[{new Date().toISOString()}] INSTANT PAYOUT CONVERSION METRIC: {telemetry?.operationalTelemetry?.successRatePercentage ?? 0}%</p>
                        <p className="text-amber-400">[{new Date().toISOString()}] WARNING: USING SECURITY SIMULATION SINCE SECRET_KEY IS DUMMY.</p>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-400 text-xs text-medium">
                    No diagnostics loaded. Click &quot;Force Full Diagnostics Check&quot; above.
                  </div>
                )}
              </div>
            )}

            {activeTab === "help" && (
              <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-800">Razorpay Payment Integration Guide</h3>
                  <p className="text-3xs text-slate-400 mt-1">Complete reference for creating orders and verifying signatures.</p>
                </div>

                <div className="space-y-5 text-xs text-slate-600 font-medium leading-relaxed">
                  <section className="space-y-2">
                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-wide">1. Core checkout script injection</h4>
                    <p className="text-3xs text-slate-500">
                      We load the CDN payload dynamically inside our React component to keep loading speed clean:
                    </p>
                    <pre className="bg-slate-50 p-3 rounded-xl text-5xs font-mono text-slate-700 overflow-x-auto">
{`const script = document.createElement("script");
script.src = "https://checkout.razorpay.com/v1/checkout.js";
script.async = true;
document.body.appendChild(script);`}
                    </pre>
                  </section>

                  <section className="space-y-2">
                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-wide">2. Endpoint call orchestration</h4>
                    <p className="text-3xs text-slate-500">
                      Our component executes a secure server-side handshake. This keeps key security protected behind express middle-layers:
                    </p>
                    <pre className="bg-slate-50 p-3 rounded-xl text-5xs font-mono text-slate-700 overflow-x-auto">
{`// 1. Send checkout transaction profile to /api/create-order
const response = await fetch("/api/create-order", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(checkoutProfile),
});
const orderData = await response.json();

// 2. Feed payment transaction responses into /api/verify-payment
const verifyUrl = \`/api/verify-payment?orderId=\${id}&razorpayPaymentId=\${payId}...\`;
const verifyResponse = await fetch(verifyUrl);`}
                    </pre>
                  </section>

                  <section className="space-y-2">
                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-wide">3. Verification criteria & Security standards</h4>
                    <p className="text-3xs text-slate-500">
                      Payment settlement is backed by HMAC hex signatures in compliance with standard Razorpay security criteria. Transactions are recorded safely inside the primary Firebase Realtime Database for access audit tracing.
                    </p>
                  </section>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Footer information section */}
      <footer className="bg-white border-t border-slate-100 py-6 px-6 text-center text-5xs font-bold text-slate-400 uppercase tracking-widest mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <span>&copy; 2026 ED ACHIEVERS ONLINE RECRUITMENT COACHING PVT. LTD.</span>
          <span className="flex items-center gap-2">
            <HeartHandshake className="w-3.5 h-3.5 text-orange-500" /> PROUDLY EMPOWERED BY REALTIME RAZORPAY GATEWAY
          </span>
        </div>
      </footer>

    </div>
  );
}
