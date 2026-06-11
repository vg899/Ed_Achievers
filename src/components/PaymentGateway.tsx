import { useState, useEffect, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  CreditCard, 
  QrCode, 
  Lock, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  User, 
  Mail, 
  Phone, 
  Ticket,
  BookOpen,
  RefreshCw,
  TrendingDown
} from "lucide-react";

// Support custom props for customization and flexibility
export interface PaymentGatewayProps {
  courseId?: string;
  courseName?: string;
  price?: number;
  promoCode?: string;
  studentId?: string;
  studentName?: string;
  studentEmail?: string;
  studentPhone?: string;
  onSuccess?: (paymentResponse: any) => void;
  onFailure?: (error: any) => void;
  onCancel?: () => void;
  standalone?: boolean; // If true, renders entire checkout form. If false, renders trigger button + automatic overlay handler
}

export default function PaymentGateway({
  courseId = "CTET-2026-CDP",
  courseName = "CTET Pedagogy Masterclass",
  price = 1499,
  promoCode = "",
  studentId = "STU-9902",
  studentName = "Harsh Vardhan Tiwari",
  studentEmail = "harshvardhantiwari39@gmail.com",
  studentPhone = "9876543210",
  onSuccess,
  onFailure,
  onCancel,
  standalone = true,
}: PaymentGatewayProps) {
  // Script integration state
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptLoading, setScriptLoading] = useState(true);
  const [scriptError, setScriptError] = useState(false);

  // Form states (pre-populated with defaults or props)
  const [buyerName, setBuyerName] = useState(studentName);
  const [buyerEmail, setBuyerEmail] = useState(studentEmail);
  const [buyerPhone, setBuyerPhone] = useState(studentPhone);
  const [selectedCourse, setSelectedCourse] = useState(courseId);
  const [selectedCourseName, setSelectedCourseName] = useState(courseName);
  const [coursePrice, setCoursePrice] = useState(price);
  const [coupon, setCoupon] = useState(promoCode);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [finalPrice, setFinalPrice] = useState(price);
  
  // Checkout flow state
  const [paymentMethod, setPaymentMethod] = useState<"MODAL" | "QRCODE">("MODAL");
  const [checkoutStep, setCheckoutStep] = useState<"IDLE" | "HANDSHAKE" | "NATIVE_MODAL" | "QRCODE_SCAN" | "VERIFYING" | "SUCCESS" | "FAILED">("IDLE");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorDetails, setErrorDetails] = useState("");
  
  // Received backend order responses
  const [createdOrderDetails, setCreatedOrderDetails] = useState<any>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [qrPolling, setQrPolling] = useState(false);

  // Load Razorpay Script dynamically
  useEffect(() => {
    if (typeof window !== "undefined") {
      if ((window as any).Razorpay) {
        setScriptLoaded(true);
        setScriptLoading(false);
        return;
      }

      setScriptLoading(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => {
        setScriptLoaded(true);
        setScriptLoading(false);
      };
      script.onerror = () => {
        setScriptLoaded(false);
        setScriptLoading(false);
        setScriptError(true);
      };
      document.body.appendChild(script);
      
      return () => {
        // Keep it globally loaded to prevent redundant loads
      };
    }
  }, []);

  // Compute server-side coupon preview locally for dynamic visual feedback
  useEffect(() => {
    let discount = 0;
    const code = coupon.toUpperCase().trim();
    if (code === "ACHIEVERS10") {
      discount = coursePrice * 0.10;
    } else if (code === "FIRST50") {
      discount = coursePrice * 0.50;
    } else if (code === "GOVEXAM30") {
      discount = coursePrice * 0.30;
    } else if (code === "FIXED500") {
      discount = Math.min(coursePrice, 500);
    }
    setDiscountAmount(discount);
    setFinalPrice(Math.max(1, coursePrice - discount));
  }, [coupon, coursePrice]);

  // Handle course changes
  const handleCourseChange = (cId: string) => {
    setSelectedCourse(cId);
    if (cId === "CTET-2026-CDP") {
      setSelectedCourseName("CTET Pedagogy Masterclass");
      setCoursePrice(1499);
    } else if (cId === "KVS-PRT-COMPLETE") {
      setSelectedCourseName("KVS PRT Premium Batch");
      setCoursePrice(3499);
    } else if (cId === "DSSSB-PEDAGOGY") {
      setSelectedCourseName("DSSSB Special Educators Pack");
      setCoursePrice(2499);
    } else {
      setSelectedCourseName("Super TET Ultimate Revision");
      setCoursePrice(999);
    }
  };

  // Trigger secure order handle flow
  const initiateSecurePayment = async (e?: FormEvent) => {
    if (e) e.preventDefault();

    // Reset verification & error states
    setErrorDetails("");
    setStatusMessage("Registering secure handshake with server...");
    setCheckoutStep("HANDSHAKE");

    // Standard client validation
    if (buyerName.trim().length < 3) {
      setCheckoutStep("IDLE");
      alert("Name must be at least 3 characters long.");
      return;
    }
    const cleanPhone = buyerPhone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setCheckoutStep("IDLE");
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }

    const payload = {
      courseId: selectedCourse,
      courseName: selectedCourseName,
      price: coursePrice,
      couponCode: coupon,
      studentId,
      studentName: buyerName,
      studentEmail: buyerEmail,
      studentPhone: cleanPhone,
    };

    try {
      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const orderData = await response.json();

      if (!response.ok || !orderData.razorpayOrderId) {
        throw new Error(orderData.error || "Missing razorpayOrderId handshake credentials from backend API.");
      }

      setCreatedOrderDetails(orderData);

      // Handle custom local UPI Display QR Option
      if (paymentMethod === "QRCODE") {
        setCheckoutStep("QRCODE_SCAN");
        return;
      }

      // Check if server operates in forced simulated sandbox bypass
      if (orderData.simulated === true) {
        setStatusMessage("Entering Developer Sandbox: Simulating Razorpay checkout interface...");
        setTimeout(() => {
          simulateSandboxSuccess(orderData);
        }, 1200);
        return;
      }

      // Native Razorpay Checkout configuration
      const options = {
        key: orderData.keyId || "rzp_test_T0HmDojSRbiVEr",
        amount: Math.round(orderData.finalAmount * 100),
        currency: "INR",
        name: "Ed Achievers",
        description: selectedCourseName,
        order_id: orderData.razorpayOrderId,
        prefill: {
          name: buyerName,
          email: buyerEmail,
          contact: cleanPhone,
        },
        theme: {
          color: "#f97316", // Brand Orange
        },
        handler: function (razorpayResponse: any) {
          verifyRazorpayPayment(orderData, razorpayResponse);
        },
        modal: {
          ondismiss: function () {
            setCheckoutStep("IDLE");
            if (onCancel) onCancel();
          },
        },
      };

      // Open Razorpay portal
      const rzpInstance = new (window as any).Razorpay(options);
      rzpInstance.open();
      setCheckoutStep("NATIVE_MODAL");

    } catch (err: any) {
      console.error("[Razorpay Setup Failure]", err);
      setErrorDetails(err.message || "An expected server connection error occurred.");
      setCheckoutStep("FAILED");
      if (onFailure) onFailure(err);
    }
  };

  // Simulate local success in dev mode when secret key is unset / placeholder is used
  const simulateSandboxSuccess = (orderData: any) => {
    const mockResponse = {
      razorpay_payment_id: "TXN_SIM_" + Date.now(),
      razorpay_order_id: orderData.razorpayOrderId,
      razorpay_signature: "MOCK_SIGNATURE_BYPASS",
    };
    verifyRazorpayPayment(orderData, mockResponse);
  };

  // Verify transaction on backend
  const verifyRazorpayPayment = async (orderData: any, rzpResponse: any) => {
    setCheckoutStep("VERIFYING");
    setStatusMessage("Securing instant signature validation...");

    const uid = studentId || "anonymous";
    const orderId = orderData.orderId;
    const courseIdValue = orderData.courseId;

    const rPayId = rzpResponse.razorpay_payment_id || "";
    const rOrderId = rzpResponse.razorpay_order_id || "";
    const rSig = rzpResponse.razorpay_signature || "";

    try {
      const verifyUrl = `/api/verify-payment?orderId=${orderId}&courseId=${courseIdValue}&uid=${uid}&razorpayPaymentId=${rPayId}&razorpayOrderId=${rOrderId}&razorpaySignature=${rSig}`;
      const response = await fetch(verifyUrl);
      const verifiedData = await response.json();

      if (verifiedData.status === "SUCCESS") {
        setVerificationResult(verifiedData);
        setCheckoutStep("SUCCESS");
        if (onSuccess) onSuccess(verifiedData);
      } else {
        throw new Error(verifiedData.error || "Signature match failed or transaction uncaptured on the gateway.");
      }

    } catch (err: any) {
      console.error("[Verification Failure]", err);
      setErrorDetails(err.message || "Unauthorised transaction capture.");
      setCheckoutStep("FAILED");
      if (onFailure) onFailure(err);
    }
  };

  // Poll server for QR payment status
  const checkQrCodePaymentStatus = async () => {
    if (qrPolling || !createdOrderDetails) return;
    setQrPolling(true);

    try {
      const response = await fetch(`/api/check-payment-status?orderId=${createdOrderDetails.orderId}`);
      const checkResult = await response.json();

      if (checkResult.status === "SUCCESS") {
        // Complete the mock-up flow with dynamic qr parameters
        const mockRzpResponse = {
          razorpay_payment_id: checkResult.transactionId || "TXN_QR_MOCK_" + Date.now(),
          razorpay_order_id: createdOrderDetails.razorpayOrderId,
          razorpay_signature: "DUMMY_QR_CONFIRM",
        };
        await verifyRazorpayPayment(createdOrderDetails, mockRzpResponse);
      } else {
        alert("Payment Verification State:\nNo completed payment captured yet. Please authorize payment on your UPI app first.");
      }
    } catch (err) {
      console.error("QR status query failed:", err);
      alert("Signature audit timed out, please retry verification.");
    } finally {
      setQrPolling(false);
    }
  };

  // Return to form state
  const resetToIdle = () => {
    setCheckoutStep("IDLE");
    setCreatedOrderDetails(null);
    setVerificationResult(null);
  };

  // Dynamic QR Code Generator URL
  const qrCodeImageUrl = createdOrderDetails?.upiLink 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=f97316&data=${encodeURIComponent(createdOrderDetails.upiLink)}`
    : "";

  return (
    <div className="w-full max-w-xl mx-auto bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden font-sans text-slate-800" id="razorpay-gateway-component">
      {/* Upper Brand Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-5 text-white flex justify-between items-center">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-black bg-white/20 text-orange-100 px-2.5 py-0.5 rounded-full tracking-wider">SECURE PAY</span>
            <span className="text-[9px] font-bold text-orange-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> SYSTEM ACTIVE
            </span>
          </div>
          <h2 className="text-md font-extrabold tracking-tight mt-1 flex items-center gap-1.5">
            <BookOpen className="w-5 h-5" /> Ed Achievers Checkout
          </h2>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-semibold text-orange-100 uppercase">Gateway engine</span>
          <span className="text-xs font-black tracking-widest text-white/90 font-mono">RAZORPAY v1</span>
        </div>
      </div>

      <div className="p-6">
        <AnimatePresence mode="wait">
          
          {/* STEP 1: IDLE STATE - Render standard standalone checkout form */}
          {checkoutStep === "IDLE" && (
            <motion.form 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={initiateSecurePayment} 
              className="space-y-5"
            >
              {/* Product and Catalog Section */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-450 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span> Select Prep Course Program
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCourseChange("CTET-2026-CDP")}
                    className={`p-3 text-left border rounded-2xl transition-all cursor-pointer ${
                      selectedCourse === "CTET-2026-CDP"
                        ? "border-orange-500 bg-orange-50/20 text-slate-800 ring-1 ring-orange-500/20"
                        : "border-slate-100 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <span className="block text-[11px] font-black uppercase">CTET CDP 2026</span>
                    <span className="block text-4xs text-slate-400 mt-1">Pedagogy Masterclass</span>
                    <span className="block text-xs font-black text-orange-500 mt-1">₹1,499</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCourseChange("KVS-PRT-COMPLETE")}
                    className={`p-3 text-left border rounded-2xl transition-all cursor-pointer ${
                      selectedCourse === "KVS-PRT-COMPLETE"
                        ? "border-orange-500 bg-orange-50/20 text-slate-800 ring-1 ring-orange-500/20"
                        : "border-slate-100 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <span className="block text-[11px] font-black uppercase">KVS PRT Live</span>
                    <span className="block text-4xs text-slate-400 mt-1">Full Batch Strategy</span>
                    <span className="block text-xs font-black text-orange-500 mt-1">₹3,499</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCourseChange("DSSSB-PEDAGOGY")}
                    className={`p-3 text-left border rounded-2xl transition-all cursor-pointer ${
                      selectedCourse === "DSSSB-PEDAGOGY"
                        ? "border-orange-500 bg-orange-50/20 text-slate-800 ring-1 ring-orange-500/20"
                        : "border-slate-100 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <span className="block text-[11px] font-black uppercase">DSSSB Teach Pack</span>
                    <span className="block text-4xs text-slate-400 mt-1">Special Pedagogy Special</span>
                    <span className="block text-xs font-black text-orange-500 mt-1">₹2,499</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCourseChange("STET-ULTIMATE")}
                    className={`p-3 text-left border rounded-2xl transition-all cursor-pointer ${
                      selectedCourse === "STET-ULTIMATE"
                        ? "border-orange-500 bg-orange-50/20 text-slate-800 ring-1 ring-orange-500/20"
                        : "border-slate-100 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <span className="block text-[11px] font-black uppercase">Super TET Ultimate</span>
                    <span className="block text-4xs text-slate-400 mt-1">High-Yield Revision</span>
                    <span className="block text-xs font-black text-orange-500 mt-1">₹999</span>
                  </button>
                </div>
              </div>

              {/* Student Profile Billing Section */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-450 block">
                  Student Verification Details
                </label>
                
                <div className="space-y-2.5">
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      placeholder="Billing Full Name (as per ID)"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-3xs font-extrabold text-slate-800 uppercase focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20"
                      required
                    />
                  </div>

                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                      placeholder="Email Address (for Receipt)"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-3xs font-bold text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20"
                      required
                    />
                  </div>

                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      value={buyerPhone}
                      onChange={(e) => setBuyerPhone(e.target.value)}
                      placeholder="10-Digit Mobile Number"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-3xs font-bold text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Promo coupons applied layout */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-450 block">
                  APPLY PROMO COUPON CODE
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-grow">
                    <Ticket className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={coupon}
                      onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                      placeholder="e.g., ACHIEVERS10, FIRST50"
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-4xs font-bold text-slate-800 uppercase placeholder:text-slate-400 uppercase tracking-widest focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setCoupon("ACHIEVERS10")}
                      className="px-2 py-1 bg-orange-50 border border-orange-100 hover:bg-orange-100 rounded-lg text-[9px] font-extrabold text-orange-700 transition"
                    >
                      ACHIEVERS10 (10%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoupon("FIRST50")}
                      className="px-2 py-1 bg-orange-50 border border-orange-100 hover:bg-orange-100 rounded-lg text-[9px] font-extrabold text-orange-700 transition"
                    >
                      FIRST50 (50%)
                    </button>
                  </div>
                </div>
              </div>

              {/* Option payment choice selection */}
              <div className="space-y-2.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-450 block">
                  Select Billing Ingress Option
                </label>
                
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex items-center justify-between p-3.5 border rounded-2xl cursor-pointer hover:bg-slate-50 transition ${
                    paymentMethod === "MODAL"
                      ? "border-orange-500 bg-orange-50/20 ring-1 ring-orange-500/20"
                      : "border-slate-100"
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="payMethod"
                        checked={paymentMethod === "MODAL"}
                        onChange={() => setPaymentMethod("MODAL")}
                        className="accent-orange-500"
                      />
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-800 block">Seamless Checkout</span>
                        <span className="text-[8px] text-slate-400 block mt-0.5">Card, Netbank & UPI Modal</span>
                      </div>
                    </div>
                    <CreditCard className="w-4 h-4 text-slate-500" />
                  </label>

                  <label className={`flex items-center justify-between p-3.5 border rounded-2xl cursor-pointer hover:bg-slate-50 transition ${
                    paymentMethod === "QRCODE"
                      ? "border-orange-500 bg-orange-50/20 ring-1 ring-orange-500/20"
                      : "border-slate-100"
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="payMethod"
                        checked={paymentMethod === "QRCODE"}
                        onChange={() => setPaymentMethod("QRCODE")}
                        className="accent-orange-500"
                      />
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-800 block">Scan Dynamic QR</span>
                        <span className="text-[8px] text-slate-400 block mt-0.5">Custom instant mobile scan</span>
                      </div>
                    </div>
                    <QrCode className="w-4 h-4 text-slate-500" />
                  </label>
                </div>
              </div>

              {/* Billing Pricing Summary */}
              <div className="bg-slate-50/60 p-4 rounded-2xl space-y-2 border border-slate-100 text-3xs font-semibold text-slate-500">
                <div className="flex justify-between">
                  <span>Subtotal catalog pricing:</span>
                  <span className="text-slate-700">₹{coursePrice.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-extrabold">
                    <span className="flex items-center gap-1">
                      <TrendingDown className="w-3.5 h-3.5" /> Coupon Discount Added ({coupon}):
                    </span>
                    <span>- ₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <hr className="border-slate-100" />
                <div className="flex justify-between text-xs font-black text-slate-800">
                  <span>Net Payable Amount:</span>
                  <span className="text-orange-500">₹{finalPrice.toFixed(2)}</span>
                </div>
              </div>

              {/* Secure pay CTA button */}
              <button
                type="submit"
                disabled={scriptLoading}
                className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-extrabold rounded-2xl transition text-xs uppercase tracking-wider shadow-lg shadow-orange-500/10 cursor-pointer flex items-center justify-center gap-2"
              >
                {scriptLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Synchronizing Secure Keys...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Authorize Secure Pay (₹{finalPrice.toFixed(2)})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              {scriptError && (
                <p className="text-[10px] text-red-500 text-center font-bold">
                  Unable to connect with Razorpay Primary checkout library. Checks failover configurations.
                </p>
              )}
            </motion.form>
          )}

          {/* STEP 2: HANDSHAKE - Connecting with checkout database */}
          {checkoutStep === "HANDSHAKE" && (
            <motion.div 
              key="handshake"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-12 flex flex-col items-center text-center space-y-4"
            >
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center border-2 border-orange-200">
                  <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">SECURE HANDSHAKE PINGED</h3>
                <p className="text-xs text-slate-400 font-medium px-4">
                  {statusMessage}
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 3: NATIVE MODAL IN PROGRESS */}
          {checkoutStep === "NATIVE_MODAL" && (
            <motion.div 
              key="native-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 flex flex-col items-center text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center border-2 border-blue-200">
                <CreditCard className="w-8 h-8 text-blue-500 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Checkout Portal Opened</h3>
                <p className="text-xs text-slate-400 font-medium px-6 leading-relaxed">
                  Please complete authorization in the Razorpay overlay window. Secure billing protocol is fully encrypted under PCI standards.
                </p>
                {statusMessage && (
                  <p className="text-5xs bg-slate-100 font-mono text-slate-500 px-3 py-1 rounded inline-block mt-2">
                    {statusMessage}
                  </p>
                )}
              </div>
              <button 
                onClick={resetToIdle}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-3xs font-extrabold uppercase mt-4"
              >
                Cancel Checkout
              </button>
            </motion.div>
          )}

          {/* STEP 4: DYNAMIC QR CODE DISPLAY SCREEN */}
          {checkoutStep === "QRCODE_SCAN" && (
            <motion.div 
              key="qrcode-scan"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center py-4 text-center space-y-5"
            >
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center justify-center gap-1.5">
                  <QrCode className="w-5 h-5 text-orange-500 animate-pulse" /> Scan & Pay UPI QR
                </h3>
                <p className="text-[10px] text-slate-450 font-semibold px-4 leading-normal">
                  Use GPay, PhonePe, Paytm, BHIM, or any UPI App to scan the brand customized QR layout below. Course unlocks immediately upon verification.
                </p>
              </div>

              {/* brand customized QR Code box layout */}
              <div className="relative p-3 bg-orange-50/15 border border-orange-100 rounded-[28px] shadow-md flex items-center justify-center bg-white">
                {qrCodeImageUrl ? (
                  <img src={qrCodeImageUrl} alt="Merchant UPI Custom Code" className="w-48 h-48 rounded-xl" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
                )}
                
                {/* Center visual avatar icon */}
                <div className="absolute w-10 h-10 rounded-full bg-white shadow flex items-center justify-center border border-orange-100">
                  <img src="https://www.gstatic.com/aistudio/ai_studio_favicon_2_256x256.png" className="w-6 h-6 rounded" alt="Ed" referrerPolicy="no-referrer" />
                </div>
              </div>

              {/* Amount and verify polling trace */}
              <div className="space-y-1.5 w-full">
                <div className="text-xs font-black text-slate-800">
                  Amount to deposit: <span className="text-orange-500 text-sm font-mono">₹{createdOrderDetails?.finalAmount.toFixed(2)}</span>
                </div>
                <div className="text-[9px] text-amber-600 font-extrabold bg-amber-50 hover:bg-amber-100/60 px-3 py-1.5 rounded-full border border-amber-100 inline-flex items-center gap-1.5 transition-all">
                  <RefreshCw className="w-3 h-3 animate-spin" /> WAITING FOR API NETWORK HANDSHAKE AUDIT
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full">
                <button
                  onClick={checkQrCodePaymentStatus}
                  disabled={qrPolling}
                  className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl transition text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:bg-orange-400"
                >
                  {qrPolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Verify Signature Settlement success
                </button>
                
                <button
                  onClick={resetToIdle}
                  className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-400 font-bold rounded-xl text-[10px] uppercase transition"
                >
                  Cancel Transaction
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 5: VERIFYING PROTOCOL AND CAPTURE */}
          {checkoutStep === "VERIFYING" && (
            <motion.div 
              key="verifying"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 flex flex-col items-center text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center border-2 border-emerald-200">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Verifying Payment Certificate</h3>
                <p className="text-xs text-slate-400 font-medium px-4">
                  {statusMessage}
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 6: TRANSACTION SUCCESS CELEBRATION */}
          {checkoutStep === "SUCCESS" && (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-6 flex flex-col items-center text-center space-y-5"
            >
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-emerald-50/80 border border-emerald-200 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-emerald-500" />
                </div>
                <div className="absolute -top-1 -right-1 bg-amber-400 rounded-full p-1 border border-white">
                  <Sparkles className="w-3.5 h-3.5 text-white animate-spin" />
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                  Unlocking course access
                </span>
                <h3 className="text-md font-black text-slate-800 uppercase tracking-tight">
                  ₹{createdOrderDetails?.finalAmount.toFixed(2)} PAYMENT RESTORATION GRANTED!
                </h3>
                <p className="text-3xs text-slate-400 font-bold px-2 max-w-sm">
                  Course index unlocked for course id: <span className="font-mono text-slate-800 font-extrabold">{selectedCourse}</span>. Subscription credentials logged, student dashboard unlocked.
                </p>
              </div>

              {/* Receipt metadata report */}
              <div className="bg-slate-50 w-full p-4 rounded-2xl text-left space-y-2 text-4xs font-bold border border-slate-100 font-mono text-slate-505 leading-relaxed">
                <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5 text-slate-400 text-[10px] tracking-tight">
                  <span>BILLING OFFICIAL TAX INVOICE</span>
                  <span>SUCCESS</span>
                </div>
                <div className="flex justify-between">
                  <span>Merchant Title:</span>
                  <span className="text-slate-850 uppercase">ED ACHIEVERS INSTRUCTIONAL</span>
                </div>
                <div className="flex justify-between">
                  <span>Tracking Order ID:</span>
                  <span className="text-slate-850 font-semibold">{createdOrderDetails?.orderId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Receipt Payment ID:</span>
                  <span className="text-slate-850 font-semibold truncate max-w-[200px]">{verificationResult?.razorpayDetails?.payment_id || "TXN_QR_VERIFIED"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Unlocking UID:</span>
                  <span className="text-slate-850 font-semibold uppercase">{studentId}</span>
                </div>
                <div className="flex justify-between text-slate-800 text-3xs font-extrabold mt-1 pt-1 border-t border-slate-100">
                  <span>Total Settled Amount:</span>
                  <span>INR {createdOrderDetails?.finalAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-2 w-full">
                <button
                  onClick={resetToIdle}
                  className="flex-grow py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-2xl transition text-xs uppercase"
                >
                  Purchase Another Course
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 7: SECURITY FAULT OR CANCELLATION */}
          {checkoutStep === "FAILED" && (
            <motion.div 
              key="failed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 flex flex-col items-center text-center space-y-5"
            >
              <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center border-2 border-rose-100">
                <AlertCircle className="w-8 h-8 text-rose-500" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">TRANSACTION HANDSHAKE HALTED</h3>
                <p className="text-[10px] text-slate-400 font-semibold px-4 leading-relaxed max-w-sm">
                  {errorDetails || "Unable to acquire gateway response handshake. Checked credentials or internet."}
                </p>
              </div>

              <p className="p-3 bg-red-50 text-[9px] font-mono text-red-650 rounded-xl leading-normal text-left max-w-md border border-red-100 uppercase">
                ERROR APIDATEWAYS_TIMEOUT_OR_INVALID_SIGNATURE: Gateway refused signature verification or the user dismissed the checkout sheet before completion.
              </p>

              <div className="flex gap-2 w-full">
                <button
                  onClick={resetToIdle}
                  className="flex-grow py-3 bg-slate-900 border border-slate-300 hover:bg-slate-850 text-white font-extrabold rounded-2xl transition text-xs uppercase cursor-pointer"
                >
                  Retry Payment Lifecycle
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* PCI-DSS and security badges footer */}
      <div className="bg-slate-50 border-t border-slate-100 px-6 py-3.5 flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-wider">
        <span className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-orange-500" /> AES-256 SSL SECURED</span>
        <span>ISO 27001 COMPLIANT</span>
      </div>
    </div>
  );
}
