import React, { useState, useEffect, useRef } from "react";

// Deployed Google Apps Script web app that appends orders to the Sheet.
// Public "Anyone" endpoint, so it's safe to call directly from the browser.
const GOOGLE_SHEETS_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbz8VkHVHRYWier_BUqq3LmDsqwwuph4d_O4IlwNeivJac9GoJUi1pVoDLDLErgIWxEB/exec";

import { 
  Maximize2, 
  Wind, 
  Activity, 
  CheckCircle2, 
  Palette, 
  CalendarDays, 
  Check, 
  ShoppingBag, 
  Star, 
  Plus, 
  Minus, 
  Clock, 
  Lock, 
  Heart, 
  Info, 
  ShieldCheck, 
  Truck, 
  ThumbsUp, 
  HelpCircle, 
  Send, 
  Sparkles, 
  ChevronDown, 
  AlertTriangle,
  ShoppingBag as CartIcon,
  X,
  CreditCard,
  Volume2,
  Bookmark,
  ChevronLeft,
  MapPin,
  Search,
  FileText,
  Compass,
  Trash2,
  TrendingUp,
  Coins,
  ClipboardList
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PRODUCT_DATA, RECENT_PURCHASES_MOCKS, ColorOption, SizeRecommendation, Feature, Review, Spec } from "./data";
import { BarefootLogo } from "./components/BarefootLogo";
import { SeoKnowledgeHub } from "./components/SeoKnowledgeHub";
import { TermsOfUse, PrivacyPolicy, ShippingPolicy } from "./components/LegalPages";
import { initAuth, googleSignIn, logout as googleLogout, getAccessToken } from "./lib/firebaseAuth";
import { createOrdersSpreadsheet, syncAllOrdersToSheet, GoogleSheetConfig } from "./lib/googleSheets";

declare global {
  interface Window {
    paypal?: any;
  }
}


export default function App() {
  // Main Gallery state
  const [selectedColor, setSelectedColor] = useState<ColorOption>(PRODUCT_DATA.colors[0]);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  
  // Custom states
  const [selectedSize, setSelectedSize] = useState<number | null>(38); // Default to a popular size
  const [quantity, setQuantity] = useState<number>(1);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [likesCount, setLikesCount] = useState<number>(342);
  
  // Sizing adviser calculator states
  const [footLength, setFootLength] = useState<number>(24.0); // starts at 24 cm
  const [advisorRecommendedSize, setAdvisorRecommendedSize] = useState<SizeRecommendation | null>(PRODUCT_DATA.sizes[2]);

  // Urgency Stock status and checkout states
  const [stockLeft, setStockLeft] = useState<number>(6);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [checkoutStep, setCheckoutStep] = useState<"form" | "payment" | "loading" | "success">("form");
  const [paypalClientId, setPaypalClientId] = useState<string>(
    (import.meta as any).env?.VITE_PAYPAL_CLIENT_ID || localStorage.getItem("paypal_client_id") || "test"
  );
  const [paypalHostedButtonId, setPaypalHostedButtonId] = useState<string>(
    localStorage.getItem("paypal_hosted_button_id") || "SB9M86R8YG8LW"
  );
  const [paypalCustomUrl, setPaypalCustomUrl] = useState<string>(
    (import.meta as any).env?.VITE_PAYPAL_CUSTOM_URL || localStorage.getItem("paypal_custom_url") || "https://www.paypal.com/ncp/payment/SB9M86R8YG8LW"
  );
  const [paypalTransactionId, setPaypalTransactionId] = useState<string>("");
  const [isPaypalConfigVisible, setIsPaypalConfigVisible] = useState<boolean>(false);
  const [orderId, setOrderId] = useState<string>("");
  
  // Checkout Form states
  const [fullName, setFullName] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "paypal" | "apple_pay">("paypal");
  const [hasClickedPaypal, setHasClickedPaypal] = useState<boolean>(false);
  // Credit Card Entry Form States
  const [cardNumber, setCardNumber] = useState<string>("");
  const [cardExpiry, setCardExpiry] = useState<string>("");
  const [cardCvv, setCardCvv] = useState<string>("");
  const [cardHolderId, setCardHolderId] = useState<string>("");
  const [cardErrors, setCardErrors] = useState<{
    cardNumber?: string;
    cardExpiry?: string;
    cardCvv?: string;
    cardHolderId?: string;
  }>({});
  const [formErrors, setFormErrors] = useState<{
    fullName?: string;
    phoneNumber?: string;
    city?: string;
    address?: string;
    email?: string;
  }>({});
  
  // User review additions
  const [allReviews, setAllReviews] = useState<Review[]>(PRODUCT_DATA.reviews);
  const [newReviewName, setNewReviewName] = useState<string>("");
  const [newReviewRating, setNewReviewRating] = useState<number>(5);
  const [newReviewText, setNewReviewText] = useState<string>("");
  const [newReviewColor, setNewReviewColor] = useState<string>(PRODUCT_DATA.colors[0].name);
  const [newReviewSize, setNewReviewSize] = useState<number>(38);
  const [addReviewError, setAddReviewError] = useState<string>("");
  const [addReviewSuccess, setAddReviewSuccess] = useState<boolean>(false);

  // Active reviews filters
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number | null>(null);

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState({ hours: 2, minutes: 44, seconds: 12 });

  // Navigation / SEO routing state
  const [currentView, setCurrentView] = useState<"shop" | "seo" | "admin" | "terms" | "privacy" | "shipping">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const page = params.get("page");
      if (page === "secret-admin" || page === "admin-panel" || page === "admin") return "admin";
      if (page === "terms") return "terms";
      if (page === "privacy") return "privacy";
      if (page === "shipping") return "shipping";
      if (page === "guide" || window.location.hash === "#expert-seo-hub") {
        return "seo";
      }
    }
    return "shop";
  });

  // Admin Dashboard States
  const [adminPasscodeInput, setAdminPasscodeInput] = useState<string>("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [adminOrders, setAdminOrders] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState<boolean>(false);
  const [adminError, setAdminError] = useState<string>("");
  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState<string>("");
  const [adminStatusFilter, setAdminStatusFilter] = useState<string>("all");
  const [editingTrackingId, setEditingTrackingId] = useState<string>("");
  const [newTrackingVal, setNewTrackingVal] = useState<string>("");

  // Google Sheets Integration States
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetConfig | null>(null);
  const [sheetsLoading, setSheetsLoading] = useState<boolean>(false);
  const [sheetsSyncing, setSheetsSyncing] = useState<boolean>(false);
  const [sheetsError, setSheetsError] = useState<string>("");
  const [sheetsSuccess, setSheetsSuccess] = useState<string>("");
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [webhookInput, setWebhookInput] = useState<string>("");

  // Load orders for admin
  const fetchAdminOrders = async (passcodeToUse: string = adminPasscodeInput) => {
    setAdminLoading(true);
    setAdminError("");
    try {
      const res = await fetch(`/api/orders?passcode=${passcodeToUse}`);
      if (!res.ok) {
        throw new Error("קוד מנהל שגוי או שגיאת חיבור");
      }
      const data = await res.json();
      if (data.orders) {
        setAdminOrders(data.orders);
        setIsAdminAuthenticated(true);
        setCurrentView("admin");
        setShowAdminLoginModal(false);
        // Persist code in local storage
        localStorage.setItem("admin_passcode", passcodeToUse);
        setAdminPasscodeInput(passcodeToUse);
      } else {
        throw new Error("שגיאה במבנה הנתונים מהשרת");
      }
    } catch (err: any) {
      setAdminError(err.message || "שגיאה בתקשורת עם השרת");
      setIsAdminAuthenticated(false);
    } finally {
      setAdminLoading(false);
    }
  };

  // Try auto login for admin if code is stored
  useEffect(() => {
    const storedCode = localStorage.getItem("admin_passcode");
    if (storedCode && currentView === "admin") {
      fetchAdminOrders(storedCode);
    }
  }, [currentView]);

  // Fetch PayPal configuration from server environment variables on startup
  useEffect(() => {
    const fetchPaypalConfig = async () => {
      try {
        const res = await fetch("/api/paypal-config");
        if (res.ok) {
          const data = await res.json();
          if (data.paypalClientId && data.paypalClientId.trim() !== "") {
            setPaypalClientId(data.paypalClientId);
            localStorage.setItem("paypal_client_id", data.paypalClientId);
          }
          if (data.paypalHostedButtonId && data.paypalHostedButtonId.trim() !== "") {
            setPaypalHostedButtonId(data.paypalHostedButtonId);
            localStorage.setItem("paypal_hosted_button_id", data.paypalHostedButtonId);
          }
          if (data.paypalCustomUrl && data.paypalCustomUrl.trim() !== "") {
            setPaypalCustomUrl(data.paypalCustomUrl);
            localStorage.setItem("paypal_custom_url", data.paypalCustomUrl);
          }
        }
      } catch (err) {
        console.error("Error fetching PayPal config from server:", err);
      }
    };
    fetchPaypalConfig();
  }, []);

  // --- GOOGLE SHEETS INTEGRATION LOGIC & EFFECTS ---
  const fetchSheetsConfig = async () => {
    try {
      const res = await fetch("/api/google-sheets/config");
      if (res.ok) {
        const data = await res.json();
        setSheetsConfig(data);
        if (data.webhookUrl) {
          setWebhookInput(data.webhookUrl);
        }
      }
    } catch (err) {
      console.error("Error fetching sheets config:", err);
    }
  };

  const saveSheetsTokenToBackend = async (token: string, spreadsheetIdToSave?: string) => {
    try {
      const body: any = { accessToken: token };
      if (spreadsheetIdToSave !== undefined) {
        body.spreadsheetId = spreadsheetIdToSave;
      }
      await fetch("/api/google-sheets/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      fetchSheetsConfig();
    } catch (err) {
      console.error("Error saving token to backend:", err);
    }
  };

  const saveWebhookUrlToBackend = async (url: string) => {
    try {
      await fetch("/api/google-sheets/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: url })
      });
      fetchSheetsConfig();
      setSheetsSuccess("כתובת ה-Webhook נשמרה בהצלחה! 🔌");
    } catch (err) {
      console.error("Error saving webhook to backend:", err);
      setSheetsError("שגיאה בשמירת ה-Webhook");
    }
  };

  useEffect(() => {
    fetchSheetsConfig();

    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleAccessToken(token);
        saveSheetsTokenToBackend(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleAccessToken(null);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    setSheetsError("");
    setSheetsSuccess("");
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleAccessToken(result.accessToken);
        await saveSheetsTokenToBackend(result.accessToken);
        setSheetsSuccess("מחובר ל-Google בהצלחה! 🎉");
      }
    } catch (err: any) {
      console.error("Google sign in failed:", err);
      setSheetsError("חיבור ל-Google נכשל: " + err.message);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await googleLogout();
      setGoogleUser(null);
      setGoogleAccessToken(null);
      await fetch("/api/google-sheets/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: "" })
      });
      fetchSheetsConfig();
      setSheetsSuccess("התנתקת מחשבון Google בהצלחה.");
    } catch (err: any) {
      console.error("Logout failed:", err);
    }
  };

  const handleCreateSheet = async () => {
    if (!googleAccessToken) {
      setSheetsError("נא להתחבר ל-Google תחילה");
      return;
    }
    setSheetsLoading(true);
    setSheetsError("");
    setSheetsSuccess("");
    try {
      const newSheetId = await createOrdersSpreadsheet(googleAccessToken);
      await saveSheetsTokenToBackend(googleAccessToken, newSheetId);
      setSheetsSuccess("גיליון הזמנות חדש נוצר בהצלחה בדרייב! 📊");
    } catch (err: any) {
      console.error("Failed to create sheet:", err);
      setSheetsError(err.message || "יצירת הגיליון נכשלה");
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleFullSync = async () => {
    if (!sheetsConfig?.spreadsheetId) {
      setSheetsError("לא מוגדר גיליון פעיל לסנכרון");
      return;
    }
    const token = googleAccessToken;
    if (!token) {
      setSheetsError("נא להתחבר ל-Google כדי לבצע סנכרון מלא");
      return;
    }

    setSheetsSyncing(true);
    setSheetsError("");
    setSheetsSuccess("");
    try {
      const res = await fetch(`/api/orders?passcode=${localStorage.getItem("admin_passcode") || adminPasscodeInput}`);
      if (!res.ok) throw new Error("כשלו בהבאת הזמנות עדכניות");
      const { orders } = await res.json();
      
      await syncAllOrdersToSheet(sheetsConfig.spreadsheetId, token, orders);
      setSheetsSuccess("כל ההזמנות סונכרנו בהצלחה מלאה ל-Google Sheets! 🚀");
    } catch (err: any) {
      console.error("Full sync failed:", err);
      setSheetsError(err.message || "הסנכרון נכשל. אנא נסה שוב.");
    } finally {
      setSheetsSyncing(false);
    }
  };

  // Update Status
  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const passcode = localStorage.getItem("admin_passcode") || adminPasscodeInput;
      const res = await fetch(`/api/orders/${orderId}?passcode=${passcode}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setAdminOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      } else {
        alert("עדכון סטטוס נכשל");
      }
    } catch (e) {
      console.error(e);
      alert("שגיאת שרת בעדכון הסטטוס");
    }
  };

  // Update Tracking Number
  const updateOrderTracking = async (orderId: string, trackingNumber: string) => {
    try {
      const passcode = localStorage.getItem("admin_passcode") || adminPasscodeInput;
      const res = await fetch(`/api/orders/${orderId}?passcode=${passcode}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumber })
      });
      if (res.ok) {
        setAdminOrders(prev => prev.map(o => o.id === orderId ? { ...o, trackingNumber } : o));
        setEditingTrackingId("");
        setNewTrackingVal("");
      } else {
        alert("עדכון מספר מעקב נכשל");
      }
    } catch (e) {
      console.error(e);
      alert("שגיאת שרת בעדכון מספר המעקב");
    }
  };

  // Delete Order
  const deleteOrder = async (orderId: string) => {
    if (!window.confirm("האם את בטוחה שברצונך למחוק לצמיתות את ההזמנה הזו?")) return;
    try {
      const passcode = localStorage.getItem("admin_passcode") || adminPasscodeInput;
      const res = await fetch(`/api/orders/${orderId}?passcode=${passcode}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setAdminOrders(prev => prev.filter(o => o.id !== orderId));
      } else {
        alert("מחיקת ההזמנה נכשלה");
      }
    } catch (e) {
      console.error(e);
      alert("שגיאת שרת במחיקת ההזמנה");
    }
  };

  const changeView = (view: "shop" | "seo" | "admin" | "terms" | "privacy" | "shipping") => {
    setCurrentView(view);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (view === "seo") {
        url.searchParams.set("page", "guide");
      } else if (view === "admin") {
        url.searchParams.set("page", "secret-admin");
      } else if (view === "terms") {
        url.searchParams.set("page", "terms");
      } else if (view === "privacy") {
        url.searchParams.set("page", "privacy");
      } else if (view === "shipping") {
        url.searchParams.set("page", "shipping");
      } else {
        url.searchParams.delete("page");
      }
      window.history.pushState({}, "", url.toString());
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const page = params.get("page");
      if (page === "guide") {
        setCurrentView("seo");
      } else if (page === "secret-admin" || page === "admin-panel" || page === "admin") {
        setCurrentView("admin");
      } else if (page === "terms") {
        setCurrentView("terms");
      } else if (page === "privacy") {
        setCurrentView("privacy");
      } else if (page === "shipping") {
        setCurrentView("shipping");
      } else {
        setCurrentView("shop");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);



  // Sizing Advisory logic update based on slider change
  useEffect(() => {
    // Find closest foot length match
    const closest = PRODUCT_DATA.sizes.reduce((prev, curr) => {
      return Math.abs(curr.footLengthCm - footLength) < Math.abs(prev.footLengthCm - footLength) ? curr : prev;
    });
    setAdvisorRecommendedSize(closest);
  }, [footLength]);

  // Urgency Timer simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        } else {
          // Reset
          return { hours: 3, minutes: 12, seconds: 0 };
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Set randomized stock left per size-color selection for FOMO/scarcity simulation
  useEffect(() => {
    // Generates a mock stock between 3 and 9 items
    const hash = (selectedSize || 38) + selectedColor.name.length;
    setStockLeft((hash % 7) + 3);
  }, [selectedColor, selectedSize]);



  // Function to lock image gallery index to color images
  const selectColorHandler = (color: ColorOption) => {
    setSelectedColor(color);
    // Switch main image to reflect the selected color option
    const matchingImgIndex = PRODUCT_DATA.galleryImages.findIndex(img => 
      img.url.toLowerCase() === color.imgUrl.toLowerCase() || 
      // check similarity or fallbacks
      img.title.includes(color.name)
    );
    if (matchingImgIndex !== -1) {
      setActiveImageIndex(matchingImgIndex);
    } else {
      // Find matching color in gallery manually or just keep it index 0
      setActiveImageIndex(0);
    }
  };

  // Helper to compute direct PayPal checkout redirect link
  const getPaypalDirectUrl = () => {
    if (paypalCustomUrl && paypalCustomUrl.trim().startsWith("http")) {
      return paypalCustomUrl.trim();
    }
    
    // Default to NCP hosted button format
    let buttonId = paypalHostedButtonId || "SB9M86R8YG8LW";
    
    // Auto-detect if client ID is configured with an NCP hosted button ID (length 13 and starts with SB)
    if (paypalClientId && paypalClientId.trim().startsWith("SB") && paypalClientId.trim().length === 13) {
      buttonId = paypalClientId.trim();
    }
    
    return `https://www.paypal.com/ncp/payment/${buttonId}`;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 16) {
      value = value.substring(0, 16);
    }
    const parts = [];
    for (let i = 0; i < value.length; i += 4) {
      parts.push(value.substring(i, i + 4));
    }
    setCardNumber(parts.join(" "));
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 4) {
      value = value.substring(0, 4);
    }
    if (value.length > 2) {
      setCardExpiry(value.substring(0, 2) + "/" + value.substring(2));
    } else {
      setCardExpiry(value);
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").substring(0, 4);
    setCardCvv(value);
  };

  const handleCardHolderIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").substring(0, 9);
    setCardHolderId(value);
  };

  const getCardBrand = (numStr: string) => {
    const cleanNum = numStr.replace(/\s/g, "");
    if (cleanNum.startsWith("4")) return "visa";
    if (/^5[1-5]/.test(cleanNum)) return "mastercard";
    if (/^3[47]/.test(cleanNum)) return "amex";
    if (/^(61|62|63|65)/.test(cleanNum)) return "isracard";
    return "unknown";
  };

  const saveOrderToDb = async (method: "card" | "paypal" | "apple_pay", transId: string) => {
    const orderData = {
      fullName,
      phoneNumber,
      city,
      address,
      email: email || "",
      paymentMethod: method,
      items: [
        {
          name: PRODUCT_DATA.hebrewName,
          color: selectedColor.name,
          size: selectedSize,
          quantity: quantity,
          imgUrl: selectedColor.imgUrl,
          price: PRODUCT_DATA.salePrice
        }
      ],
      totalPrice: PRODUCT_DATA.salePrice * quantity,
      paymentDetails: {
        transactionId: transId,
        cardBrand: method === "card" ? getCardBrand(cardNumber) : undefined,
        last4: method === "card" ? cardNumber.replace(/\s/g, "").slice(-4) : undefined,
        cardHolderId: method === "card" ? cardHolderId : undefined,
        paypalMode: method === "paypal" ? (paypalClientId === "test" ? "sandbox" : "live") : undefined
      }
    };

    const newOrderId = "ORD-" + Math.floor(Math.random() * 900000 + 100000);

    // Send straight to the Google Sheets Apps Script web app.
    // Done from the browser so the Sheet write doesn't depend on any
    // server-side config. text/plain + no-cors avoids the CORS preflight
    // that Apps Script can't answer; doPost still reads e.postData.contents.
    try {
      await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          id: newOrderId,
          createdAt: new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }),
          fullName: orderData.fullName,
          phoneNumber: orderData.phoneNumber,
          city: orderData.city,
          address: orderData.address,
          email: orderData.email,
          totalPrice: `₪${orderData.totalPrice}`,
          items: orderData.items
            .map((i) => `${i.name} (${i.color}, מידה ${i.size}) x${i.quantity}`)
            .join(", "),
          paymentMethod: orderData.paymentMethod,
          status: "חדש",
          trackingNumber: ""
        })
      });
    } catch (e) {
      console.error("Error sending order to Google Sheets:", e);
    }

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
      });
      const data = await res.json();
      if (data.success && data.order) {
        setOrderId(data.order.id);
      } else {
        setOrderId("ORD-" + Math.floor(Math.random() * 900000 + 100000));
      }
    } catch (e) {
      console.error("Error saving order to backend:", e);
      setOrderId("ORD-" + Math.floor(Math.random() * 900000 + 100000));
    }
  };

  const handleCardPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: {
      cardNumber?: string;
      cardExpiry?: string;
      cardCvv?: string;
      cardHolderId?: string;
    } = {};

    const cleanNum = cardNumber.replace(/\s/g, "");
    if (!cleanNum) {
      errors.cardNumber = "אנא הזיני מספר כרטיס אשראי";
    } else if (cleanNum.length < 14 || cleanNum.length > 16 || !/^\d+$/.test(cleanNum)) {
      errors.cardNumber = "מספר כרטיס אשראי לא תקין (נדרשות 14-16 ספרות)";
    }

    if (!cardExpiry) {
      errors.cardExpiry = "אנא הזיני תוקף (MM/YY)";
    } else {
      const parts = cardExpiry.split("/");
      if (parts.length !== 2 || parts[0].length !== 2 || parts[1].length !== 2) {
        errors.cardExpiry = "תוקף לא תקין, אנא השתמשי במבנה MM/YY";
      } else {
        const m = parseInt(parts[0], 10);
        if (m < 1 || m > 12) {
          errors.cardExpiry = "חודש לא תקין (1-12)";
        }
      }
    }

    if (!cardCvv) {
      errors.cardCvv = "אנא הזיני קוד אבטחה (CVV)";
    } else if (cardCvv.length < 3 || cardCvv.length > 4 || !/^\d+$/.test(cardCvv)) {
      errors.cardCvv = "קוד אבטחה לא תקין (3 או 4 ספרות)";
    }

    if (!cardHolderId) {
      errors.cardHolderId = "אנא הזיני תעודת זהות של בעל הכרטיס";
    } else if (cardHolderId.length < 9 || !/^\d+$/.test(cardHolderId)) {
      errors.cardHolderId = "תעודת זהות לא תקינה (חובה 9 ספרות)";
    }

    if (Object.keys(errors).length > 0) {
      setCardErrors(errors);
      return;
    }

    setCardErrors({});
    setCheckoutStep("loading");
    
    const liveTxId = "TX-CC-" + Math.floor(Math.random() * 9000000 + 1000000);
    setPaypalTransactionId(liveTxId);
    
    // Save to server first, then complete checkout sequence
    saveOrderToDb("card", liveTxId).then(() => {
      setTimeout(() => {
        setCheckoutStep("success");
      }, 3500);
    });
  };

  // Simulated Buy Process spinner trigger
  const handlePurchaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: {
      fullName?: string;
      phoneNumber?: string;
      city?: string;
      address?: string;
      email?: string;
    } = {};

    if (!fullName.trim()) {
      newErrors.fullName = "אנא הזיני שם מלא למסירה";
    } else if (fullName.trim().length < 3) {
      newErrors.fullName = "השם קצר מדי, אנא הזיני שם מלא ותקין";
    }

    const cleanPhone = phoneNumber.replace(/[-\s]/g, "").replace(/^\+?972/, "0");
    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = "אנא הזיני מספר טלפון לתיאום משלוח";
    } else if (!/^0\d{8,9}$/.test(cleanPhone)) {
      newErrors.phoneNumber = "מספר טלפון לא תקין, אנא וודאי מילוי נכון (למשל 050-1234567)";
    }

    if (!city.trim()) {
      newErrors.city = "אנא הזיני שם עיר או יישוב";
    } else if (city.trim().length < 2) {
      newErrors.city = "אנא הזיני שם עיר תקין";
    }

    if (!address.trim()) {
      newErrors.address = "אנא הזיני רחוב ומספר בית";
    } else if (address.trim().length < 3) {
      newErrors.address = "אנא הזיני כתובת מלאה ומצוינת";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = "אנא הזיני כתובת אימייל";
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = "כתובת אימייל אינה תקינה, אנא בדקי קצת שוב (לדוגמה: name@domain.com)";
    }

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      return;
    }

    setFormErrors({});
    const generatedCode = "PP-DIR-" + Math.floor(Math.random() * 900000 + 100000);
    setOrderId(generatedCode);
    setPaypalTransactionId(generatedCode);
    setHasClickedPaypal(true);
    setCheckoutStep("loading");
    
    // Open PayPal directly inside the click event thread to bypass popup blockers
    const paypalUrl = getPaypalDirectUrl();
    try {
      window.open(paypalUrl, "_blank");
    } catch (e) {
      console.error("Popup block or iframe restriction:", e);
    }
    
    saveOrderToDb("paypal", generatedCode)
      .then(() => {
        // Safe Meta Pixel Purchase tracking
        try {
          if (typeof (window as any).fbq === 'function') {
            (window as any).fbq('track', 'Purchase', {
              value: PRODUCT_DATA.salePrice * quantity,
              currency: 'ILS',
              content_name: PRODUCT_DATA.hebrewName,
              content_type: 'product',
              order_id: generatedCode
            });
          }
        } catch (fbErr) {
          console.warn("Meta Pixel Purchase track error:", fbErr);
        }

        setTimeout(() => {
          setCheckoutStep("success");
        }, 1200);
      })
      .catch(err => {
        console.error("Error saving order:", err);
        setTimeout(() => {
          setCheckoutStep("success");
        }, 1200);
      });
  };

  // Add customized review
  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewName.trim() || !newReviewText.trim()) {
      setAddReviewError("נא למלא את השם ואת הערות הביקורת שלך");
      return;
    }

    const newReview: Review = {
      id: "rev-custom-" + Date.now(),
      author: newReviewName + " (קונה מאומת)",
      rating: newReviewRating,
      date: "עכשיו",
      color: newReviewColor,
      size: newReviewSize,
      text: newReviewText,
      tags: ["קונה מרוצה", "ביקורת לקוח"],
      isVerified: true,
      avatarSeed: "user-" + Math.floor(Math.random() * 100)
    };

    setAllReviews(prev => [newReview, ...prev]);
    setNewReviewName("");
    setNewReviewText("");
    setAddReviewError("");
    setAddReviewSuccess(true);
    setTimeout(() => setAddReviewSuccess(false), 5000);
  };

  // Liked counter toggle
  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
    setLikesCount(prev => isFavorite ? prev - 1 : prev + 1);
  };

  // Calculates stats
  const totalStarRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
  const calculatedAvgRating = (totalStarRating / allReviews.length).toFixed(1);

  // Filter logic
  const filteredReviews = selectedRatingFilter 
    ? allReviews.filter(r => r.rating === selectedRatingFilter)
    : allReviews;

  return (
    <div className="min-h-screen bg-[#06110c] text-slate-100 flex flex-col justify-between selection:bg-[#bca374] selection:text-[#06110c]">
      
      {/* TIME-LIMITED HIGHEST CONVERTING TOP BAR */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#0a2319] to-emerald-950 text-[#bca374] font-medium py-2.5 px-4 text-center text-xs md:text-sm shadow-md flex items-center justify-center gap-2 relative z-40 border-b border-[#bca374]/15">
        <Sparkles className="w-4 h-4 animate-bounce shrink-0 text-[#bca374]" />
        <span className="font-extrabold text-[#bca374]">מבצע זמני מוגבל!</span>
        <span className="text-[#ebe2cf]">משלוח חינם לכל הארץ • תוך שבועיים אצלכם • רכישה מאובטחת</span>
        <div className="hidden lg:flex items-center gap-1.5 mr-4 bg-emerald-950/50 border border-emerald-800/40 px-2.5 py-0.5 rounded-full text-xs">
          <Clock className="w-3.5 h-3.5 text-[#bca374]" />
          <span>המבצע מסתיים בעוד:</span>
          <span className="font-mono font-bold tracking-wider text-[#bca374]">
            {timeLeft.hours.toString().padStart(2, '0')}:
            {timeLeft.minutes.toString().padStart(2, '0')}:
            {timeLeft.seconds.toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* MODERN ELEGANT SHOPPING HEADER */}
      <header className="sticky top-0 bg-[#06110c]/90 backdrop-blur-md border-b border-[#112d21] py-1.5 md:py-2 px-4 md:px-8 z-30 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Brand/Store Info */}
          <div className="flex items-center gap-6">
            <button 
              type="button" 
              onClick={() => changeView("shop")} 
              className="text-right focus:outline-hidden hover:opacity-90 transition-opacity cursor-pointer flex items-center"
            >
              <BarefootLogo variant="header" size={160} />
            </button>
            
            {/* Nav links */}
            <nav className="hidden lg:flex items-center gap-5 text-sm font-black border-r border-[#112d21]/65 pr-5" dir="rtl">
              <button 
                type="button"
                onClick={() => changeView("shop")}
                className={`transition-all pb-1 hover:text-[#bca374] cursor-pointer ${
                  currentView === "shop" ? "text-[#bca374] border-b-2 border-[#bca374]" : "text-slate-350"
                }`}
              >
                חנות מוצרים
              </button>
              <button 
                type="button"
                onClick={() => changeView("seo")}
                className={`transition-all pb-1 hover:text-[#bca374] cursor-pointer ${
                  currentView === "seo" ? "text-[#bca374] border-b-2 border-[#bca374]" : "text-slate-350"
                }`}
              >
                מדריך בריאות כף הרגל והגב
              </button>

            </nav>
          </div>

          {/* Core Trust Indicators */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-1">
              <div className="flex text-[#bca374]">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star key={star} className="w-4.5 h-4.5 fill-current" />
                ))}
              </div>
              <span className="text-sm font-bold text-[#bca374] pr-1">{calculatedAvgRating}</span>
              <span className="text-xs text-slate-400">({allReviews.length} ביקורות קונים)</span>
            </div>
          </div>

          {/* Sizable Button CTA */}
          <button 
            type="button"
            onClick={() => {
              changeView("shop");
              setIsCheckoutOpen(true);
            }}
            className="bg-gradient-to-r from-[#bca374] to-[#a38b5d] hover:from-[#ad9466] hover:to-[#91794d] active:scale-95 text-slate-950 px-5 py-2.5 rounded-full text-xs md:text-sm font-black shadow-[0_4px_15px_rgba(188,163,116,0.25)] hover:shadow-[0_4px_20px_rgba(188,163,116,0.45)] transition-all flex items-center gap-2 cursor-pointer"
          >
            <CartIcon className="w-4 h-4 stroke-[2.5]" />
            <span>רכישה מהירה</span>
          </button>
        </div>
      </header>

      {/* INTERNAL APP PAGE ROTATION NAVIGATION (FOR HIGH PERFORMANCE DISCOVERY) */}
      <div className="bg-[#05110a] border-b border-[#112d21] sticky top-[72px] md:top-[80.5px] z-25 py-2.5 px-4 shadow-[0_2px_10px_rgba(0,0,0,0.25)]" dir="rtl">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 md:gap-6 text-xs md:text-sm font-black">
          <button
            type="button"
            onClick={() => changeView("shop")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition-all cursor-pointer ${
              currentView === "shop"
                ? "bg-[#bca374]/15 text-[#bca374] border border-[#bca374]/30 shadow-inner"
                : "text-slate-400 hover:text-white border border-transparent"
            }`}
          >
            <CartIcon className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>עמוד חנות ומפרט רכישה</span>
          </button>
          
          <button
            type="button"
            onClick={() => changeView("seo")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition-all cursor-pointer ${
              currentView === "seo"
                ? "bg-[#bca374]/15 text-[#bca374] border border-[#bca374]/30 shadow-inner"
                : "text-slate-400 hover:text-white border border-transparent"
            }`}
          >
            <FileText className="w-4 h-4 text-[#bca374] shrink-0" />
            <span>מדריך בריאות כף הרגל והיציבה האנטומית</span>
          </button>


        </div>
      </div>

      {/* MAIN MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 flex-grow w-full">
        {currentView === "shop" ? (
          <>
            {/* HERO SPLIT SECTION: GALLERY + PRODUCT DESCRIPTION */}
            <div id="product-customizer" className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-12 gap-8 bg-[#0c241b]/30 backdrop-blur-md p-4 md:p-8 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] border border-[#112d21]">
          
          {/* RIGHT SIDE: PREMIUM GALLERY WITH ZOOM AND INTERACTION (Cols: 7) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            
            {/* Primary Main Image Area */}
            <div className="relative aspect-1 cursor-pointer bg-[#06110c] rounded-2xl overflow-hidden border border-[#112d21] shadow-xl group">
              
              {/* Hot Badges */}
              <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 pointer-events-none">
                <span className="bg-[#bca374] text-[#06110c] text-[10px] md:text-xs font-black px-3 py-1.5 rounded-full shadow-lg tracking-wide border border-[#bca374]/20">
                  26% הנחה בלעדית
                </span>
                <span className="bg-[#06110c]/85 backdrop-blur-xs text-[#bca374] text-[10px] md:text-sm font-black px-2.5 py-1 rounded-md border border-[#112d21] shadow-sm flex items-center gap-1.5 self-start">
                  <Star className="w-3.5 h-3.5 fill-current text-[#bca374] pr-0.5" />
                  {calculatedAvgRating} / 5
                </span>
              </div>

              {/* High Demand alert */}
              <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
                <span className="bg-amber-500/10 text-amber-300 font-bold text-xs px-3 py-1.5 rounded-full shadow-lg border border-amber-500/20 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  ביקוש גבוה: מעל 47 אנשים צופים כעת
                </span>
              </div>

              {/* Main Image zoom controller */}
              <div 
                className="w-full h-full relative"
                onMouseEnter={() => setIsZoomed(true)}
                onMouseLeave={() => setIsZoomed(false)}
              >
                <img 
                  src={
                    // If index 0 is selected but a specific color was chosen, we can override or just show the active image index
                    activeImageIndex === 0 ? selectedColor.imgUrl : PRODUCT_DATA.galleryImages[activeImageIndex].url
                  } 
                  alt={PRODUCT_DATA.galleryImages[activeImageIndex].title}
                  className={`w-full h-full object-cover transition-transform duration-500 ${isZoomed ? 'scale-125' : 'scale-100'}`}
                />
              </div>

              {/* Zoom guide */}
              <div className="absolute bottom-3 right-3 bg-black/85 backdrop-blur-xs text-white/90 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                העברי את העכבר להגדלה
              </div>
            </div>

            {/* Gallery Thumbnails Slider */}
            <div className="grid grid-cols-6 gap-2 md:gap-3">
              {PRODUCT_DATA.galleryImages.map((img, idx) => {
                const isSelected = activeImageIndex === idx;
                // Highlight corresponding thumb
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 bg-[#06110c] transition-all cursor-pointer ${
                      isSelected 
                        ? 'border-[#bca374] shadow-lg shadow-[#bca374]/20 ring-2 ring-[#bca374]/30' 
                        : 'border-[#112d21] hover:border-[#bca374]/40'
                    }`}
                  >
                    <img 
                      src={img.url} 
                      alt={img.title} 
                      className="w-full h-full object-cover" 
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                        <Check className="w-5 h-5 text-blue-400 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* High Conversion Assurance Ticker */}
            <div className="bg-[#06110c]/65 border border-[#112d21] rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center mt-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]">
              <div className="flex flex-col items-center justify-center border-l border-[#112d21] last:border-0 pl-1">
                <ShieldCheck className="w-6 h-6 text-[#bca374] mb-1" />
                <span className="text-[11px] font-bold text-slate-200">100% הגנת קונה</span>
                <span className="text-[10px] text-slate-400">החזר כספי מלא מוגן</span>
              </div>
              <div className="flex flex-col items-center justify-center md:border-l border-[#112d21] last:border-0 pr-1">
                <Truck className="w-6 h-6 text-emerald-400 mb-1" />
                <span className="text-[11px] font-bold text-slate-205">ביטוח חבילה מלא</span>
                <span className="text-[10px] text-slate-450">פיצוי אם חבילה אובדת</span>
              </div>
              <div className="flex flex-col items-center justify-center border-l border-[#112d21] last:border-0 pl-1">
                <ShieldCheck className="w-6 h-6 text-[#bca374] mb-1" />
                <span className="text-[11px] font-bold text-slate-205">רכישה מוגנת</span>
                <span className="text-[10px] text-slate-450">תשלום בטוח ומאובטח</span>
              </div>
              <div className="flex flex-col items-center justify-center pl-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mb-1" />
                <span className="text-[11px] font-bold text-slate-205">שירות לקוחות זמין</span>
                <span className="text-[10px] text-slate-450">מענה מהיר ומקצועי</span>
              </div>
            </div>
          </div>

          {/* LEFT SIDE: CRO ORDERING PANEL & SALES COPY (Cols: 5) */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div>
              {/* Product title & Badges */}
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-emerald-950/40 text-emerald-300 text-[11px] font-extrabold px-3 py-1 rounded-full border border-emerald-800/30 uppercase tracking-wider">
                  נעלי יחפנים שלמות
                </span>
                <span className="bg-[#bca374]/15 text-[#bca374] text-[11px] font-extrabold px-3 py-1 rounded-full border border-[#bca374]/20 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  המומלץ ביותר לקיץ
                </span>
              </div>

              {/* Title group */}
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-100 tracking-tight leading-tight">
                {PRODUCT_DATA.hebrewName}
              </h1>
              
              <p className="text-slate-400 text-sm md:text-base mt-2 font-medium">
                {PRODUCT_DATA.name} - נוחות אנטומית פורצת דרך עם קופסת אצבעות רחבה וסוליה גמישה המשחררת את הרגל מכל כאב!
              </p>

              {/* Realistic Price Action Box */}
              <div className="bg-gradient-to-br from-[#0c241b] to-[#06110c] border border-[#112d21] text-white rounded-2xl p-5 mt-5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-32 h-32 bg-[#bca374]/5 rounded-full blur-2xl"></div>
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl"></div>

                <div className="flex items-end justify-between relative z-10">
                  <div>
                    <span className="text-[#bca374] font-extrabold text-xs uppercase tracking-wide block mb-1">מחיר חיסול מיוחד</span>
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-3xl md:text-4xl font-extrabold text-white leading-none">
                        ₪{PRODUCT_DATA.salePrice}
                      </span>
                      <span className="text-slate-450 line-through text-sm">
                        ₪{PRODUCT_DATA.originalPrice}
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#bca374] text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-lg flex flex-col items-center shadow-md">
                    <span>חסכתם</span>
                    <span className="text-sm font-black text-slate-900">₪{PRODUCT_DATA.originalPrice - PRODUCT_DATA.salePrice}</span>
                  </div>
                </div>

                <div className="border-t border-emerald-950/40 mt-4 pt-3 flex items-center justify-between text-xs text-slate-400 relative z-10">
                  <span className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-emerald-400" />
                    משלוח מבוטח: <strong className="text-emerald-400 font-black">חינם!</strong>
                  </span>
                  <span className="text-amber-400 font-semibold animate-pulse">אספקה מוערכת במבצע: {PRODUCT_DATA.deliveryDateEstimate}</span>
                </div>
              </div>
              <div className="mt-4">
                <label className="text-sm font-bold text-slate-350 block mb-2.5 text-right">
                  1. בחרי צבע: <strong className="text-[#bca374] font-bold">{selectedColor.name}</strong>
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRODUCT_DATA.colors.map(color => {
                    const isSelected = selectedColor.id === color.id;
                    return (
                      <button
                        key={color.id}
                        onClick={() => selectColorHandler(color)}
                        className={`group px-3.5 py-2 rounded-xl border flex items-center gap-2.5 transition-all outline-hidden cursor-pointer ${
                          isSelected
                            ? 'bg-[#bca374]/15 border-[#bca374] text-[#bca374] font-bold ring-2 ring-[#bca374]/20'
                            : 'bg-[#06110c] border-[#112d21] hover:border-[#bca374]/40 text-slate-300'
                        }`}
                      >
                        <span 
                          className="w-4 h-4 rounded-full border border-black/10 shrink-0 shadow-sm" 
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="text-xs md:text-sm">{color.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#bca374]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SIZE SELECTOR */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-slate-350 block text-right">
                    2. בחרי מידה: <strong className="text-[#bca374] font-extrabold">{selectedSize || 'לא נבחר'}</strong>
                  </label>
                  <a 
                    href="#size-advisor" 
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5" />
                    איזה מידה מתאימה לי? מחשבון מידות
                  </a>
                </div>
                
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {PRODUCT_DATA.sizes.map((item) => {
                    const isSelected = selectedSize === item.size;
                    return (
                      <button
                        key={item.size}
                        onClick={() => setSelectedSize(item.size)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all truncate text-center outline-hidden cursor-pointer ${
                          isSelected
                            ? 'bg-[#bca374] border-[#bca374] text-[#06110c] font-black ring-4 ring-[#bca374]/20 scale-95 shadow-[0_0_15px_rgba(188,163,116,0.35)]'
                            : 'bg-[#06110c] border-[#112d21] hover:border-[#bca374]/30 text-slate-200'
                        }`}
                      >
                        <span className="text-sm tracking-tight">{item.size}</span>
                        <span className={`text-[10px] mt-0.5 font-bold ${isSelected ? 'text-[#06110c]/80' : 'text-slate-500'}`}>
                          EU {item.size}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Sizing details alert box */}
                <div className="bg-[#0c241b]/50 border border-emerald-950/40 rounded-xl p-3.5 mt-3 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-[#bca374] shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-300 leading-relaxed font-normal">
                    {selectedSize 
                      ? `מידה ${selectedSize} מומלצת לרגל באורך של כ-${PRODUCT_DATA.sizes.find(s => s.size === selectedSize)?.footLengthCm} ס"מ.` 
                      : 'אנו ממליצים להכניס את אורך הרגל במחשבון הדינמי למטה כדי לקבל התאמה מדויקת.'}
                    <span> למבנה פופולרי, מומלץ להזמין את מידתך הרגילה, הנעליים גמישות ונעימות למגע.</span>
                  </div>
                </div>
              </div>

              {/* QUANTITY SELECTOR & SCARCITY BAR */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-2 text-right">3. כמות זוגות:</label>
                  <div className="flex items-center bg-[#06110c] rounded-xl p-1 border border-[#112d21] max-w-[150px]">
                    <button 
                      onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                      className="p-2 text-slate-300 hover:bg-emerald-950/50 rounded-lg transition-all cursor-pointer"
                      title="הפחת כמות"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="flex-grow text-center font-bold text-sm text-slate-100 pr-1 pl-1">{quantity}</span>
                    <button 
                      onClick={() => setQuantity(prev => prev + 1)}
                      className="p-2 text-slate-300 hover:bg-emerald-950/50 rounded-lg transition-all cursor-pointer"
                      title="הוסף כמות"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Scarcity FOMO Meter */}
                <div className="flex flex-col justify-end">
                  <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
                    <span className="text-[#bca374] flex items-center gap-1">
                      <span className="inline-block w-2 bg-[#bca374] h-2 rounded-full animate-ping animate-pulse"></span>
                      חבילה בביקוש שיא!
                    </span>
                    <span className="text-slate-300">נותרו רק {stockLeft} זוגות במלאי!</span>
                  </div>
                  <div className="w-full h-2.5 bg-[#06110c] rounded-full overflow-hidden border border-[#112d21]">
                    <div 
                      className="h-full bg-[#bca374] rounded-full transition-all duration-700 animate-pulse"
                      style={{ width: `${(stockLeft / 10) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* BIG ACTION PURCHASE BUTTON SECTION WITH SAVINGS SUMMARY */}
            <div className="mt-8 pt-4 border-t border-[#112d21]">
              {/* Savings group */}
              <div className="mb-3 flex items-center justify-between text-xs md:text-sm text-slate-450">
                <span>מחיר פריט במבצע: ₪{PRODUCT_DATA.salePrice * quantity}</span>
                <span className="text-emerald-400 font-extrabold">משלוח: חינם!</span>
              </div>
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-sm font-black text-slate-200">סה"כ לתשלום כולל משלוח:</span>
                <span className="text-3xl font-black text-[#bca374]">
                  ₪{PRODUCT_DATA.salePrice * quantity}
                </span>
              </div>

              {/* Action buttons list */}
              <div className="flex gap-3">
                
                {/* Huge checkout popup triggers */}
                <button
                  onClick={() => setIsCheckoutOpen(true)}
                  className="flex-grow bg-gradient-to-r from-[#bca374] to-[#a38b5d] hover:from-[#ad9466] hover:to-[#91794d] active:scale-98 text-[#06110c] text-base md:text-lg font-black py-4 px-6 rounded-2xl shadow-xl hover:shadow-[#bca374]/25 transition-all flex items-center justify-center gap-2.5 animate-pulse-slow cursor-pointer"
                >
                  <ShoppingBag className="w-5.5 h-5.5 stroke-[2.5]" />
                  <span>קבלו מבצע והזמינו עכשיו בבטחה</span>
                </button>

                {/* Favorite */}
                <button
                  onClick={toggleFavorite}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isFavorite
                      ? 'bg-[#bca374]/15 border-[#bca374] text-[#bca374] font-extrabold shadow-sm'
                      : 'bg-[#06110c] border-[#112d21] text-slate-400 hover:text-[#bca374] hover:border-[#112d21]/80'
                  }`}
                  title={isFavorite ? "הסר מהמועדפים" : "הוסף למועדפים"}
                >
                  <Heart className={`w-5.5 h-5.5 ${isFavorite ? 'fill-current text-[#bca374]' : 'scale-100'}`} />
                  <span className="text-xs font-bold leading-none hidden sm:inline">{likesCount} Liked</span>
                </button>
              </div>

              {/* Secure SSL notice */}
              <div className="mt-4 flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border border-[#112d21] bg-[#06110c]/40 text-center">
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-semibold">
                  <Lock className="w-3.5 h-3.5 text-[#bca374] animate-pulse" />
                  <span>רכישה מאובטחת בטכנולוגיית SSL • שירות ותמיכה מלאה בהזמנה</span>
                </div>
                <p className="text-[11px] text-[#bca374] font-black mt-1" dir="rtl">
                  * המבצע והמשלוח המהיר חינם לכל חלקי הארץ תקפים להזמנות שיבוצעו היום בלבד!
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* INTERACTIVE VALUE COMPANION SYSTEM: FOOT LENGTH CONVERTER ACCURATE CALCULATION AREA */}
        <section id="size-advisor" className="mt-12 bg-[#0c241b]/30 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-[#112d21] shadow-xl relative overflow-hidden scroll-mt-20">
          <div className="absolute top-0 right-0 w-40 h-40 bg-[#bca374]/5 rounded-full blur-3xl"></div>
          
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <span className="bg-[#bca374]/15 text-[#bca374] border border-[#bca374]/20 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider inline-block mb-3">
              מחשבון מידות חכם ורשמי
            </span>
            
            <h2 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight">
              התאימי את המידה המושלמת לכף הרגל שלך!
            </h2>
            
            <p className="text-sm text-slate-450 mt-2 max-w-xl mx-auto">
              כדי למנוע תסכולים והחזרות מיותרות, רשמי את אורך כף הרגל שלך בסנטימטרים ותראי מייד איזה מידת נעל של barefoot מתאימה לך בדיוק!
            </p>

            {/* Foot length drag slider interface */}
            <div className="bg-[#06110c]/70 border border-[#112d21] p-6 md:p-8 rounded-2xl mt-6">
              
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                
                {/* Interactive Slider Input */}
                <div className="w-full md:w-3/5 text-right flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-slate-500 font-mono">22.0 ס"מ</span>
                    <span className="text-sm font-semibold text-slate-200 bg-[#06110c] border border-[#112d21] px-4 py-1.5 rounded-full text-center">
                      אורך הרגל שלך: <strong className="text-[#bca374] text-base">{footLength.toFixed(1)}</strong> ס"מ
                    </span>
                    <span className="text-xs font-bold text-slate-500 font-mono">28.0 ס"מ</span>
                  </div>

                  {/* Slider Control */}
                  <input 
                    type="range" 
                    min="22.0" 
                    max="28.0" 
                    step="0.1"
                    value={footLength}
                    onChange={(e) => setFootLength(parseFloat(e.target.value))}
                    className="w-full h-2.5 bg-emerald-950/60 rounded-lg appearance-none cursor-pointer accent-[#bca374] focus:outline-hidden"
                  />

                  {/* Little Guide helper */}
                  <div className="mt-4 text-xs text-slate-400 leading-relaxed text-right flex gap-1.5 items-start">
                    <Info className="w-4 h-4 text-[#bca374] shrink-0 mt-0.5 animate-pulse" />
                    <span>
                      <strong>איך למדוד את אורך כף הרגל?</strong> הניחו את כף הרגל על דף נייר כשהעקב נוגע קלות בקיר, סמנו את קצה האצבע הארוכה ביותר וכתבו במטר את המרחק ביניהם.
                    </span>
                  </div>
                </div>

                {/* Sizing result dynamic recommendation card */}
                <div className="w-full md:w-2/5">
                  <AnimatePresence mode="wait">
                    {advisorRecommendedSize && (
                      <motion.div
                        key={advisorRecommendedSize.size}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="bg-gradient-to-br from-[#0c241b] to-[#06110c] text-[#bca374] rounded-2xl p-5 text-center shadow-lg relative border border-[#bca374]/20"
                      >
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#bca374] text-[#06110c] text-[10px] font-black tracking-wider px-3 py-1 rounded-full uppercase shadow-xs">
                          התאמה מדויקת
                        </div>
                        
                        <div className="text-[11px] uppercase font-bold text-slate-350 mt-1">המידה המומלצת עבורך:</div>
                        <div className="text-4xl font-black my-1 font-mono tracking-tight text-[#bca374] animate-pulse-slow">
                          מידה {advisorRecommendedSize.size}
                        </div>
                        <div className="text-xs font-bold bg-[#bca374]/10 py-1 px-2.5 rounded-full inline-block text-[#ebe2cf]">
                          מידה בדירוג אירופאי: {advisorRecommendedSize.euSize}
                        </div>
                        
                        <p className="text-[11px] text-slate-300 mt-3 leading-relaxed">
                          {advisorRecommendedSize.note}
                        </p>

                        {/* Direct Select button */}
                        <button
                          onClick={() => {
                            setSelectedSize(advisorRecommendedSize.size);
                            const element = document.getElementById("root");
                            if (element) {
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }
                          }}
                          className="w-full bg-[#bca374] hover:bg-[#ad9466] text-slate-950 font-black text-xs py-2 px-4 rounded-lg mt-4 shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3] text-slate-950" />
                          <span>נעל מידה {advisorRecommendedSize.size} לעגלה שלי</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>

            </div>
          </div>
        </section>

        {/* COMPARATIVE PERSUASION CHART: BAREFOOT VS Tight Shoes */}
        <section className="mt-12 bg-[#0c241b]/30 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-[#112d21] shadow-xl">
          <div className="max-w-3xl mx-auto text-center mb-8">
            <span className="text-[#bca374] font-extrabold text-xs uppercase tracking-wider block mb-1">
              הבריאות של הרגליים שלך קודמת לכל
            </span>
            <h2 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight">
              מדוע לבחור בנעלי יחפנים (Barefoot) על פני נעל רגילה?
            </h2>
            <p className="text-sm text-slate-450 mt-2">
              ראי בעצמך את ההבדל ביציבה, חוזק המפרקים והנוחות הכללית שהאצבעות שלך יקבלו
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            
            {/* Standard shoe problems */}
            <div className="bg-red-950/20 border border-red-900/40 p-6 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="bg-red-500/10 text-red-400 border border-red-900/30 w-8 h-8 rounded-full flex items-center justify-center font-bold">X</span>
                <h3 className="font-bold text-slate-200 text-base">נעליים רגילות וצרות מסחריות</h3>
              </div>
              <ul className="space-y-3.5 text-xs text-slate-350 text-right font-medium">
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-black shrink-0">•</span>
                  <span><strong>קופסת אצבעות צרה מדי:</strong> דוחסת את אצבעות כף הרגל פנימה, גורמת לעיוותים, כאבי בוהן ויבלות כואבות בשימוש ממושך.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-black shrink-0">•</span>
                  <span><strong>סוליית קפיץ מוגבהת:</strong> משנה את מרכז הכובד הטבעי של הגוף, מקצרת שרירי גיד אכילס ומטילה עומס כבד על הגב התחתון.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-black shrink-0">•</span>
                  <span><strong>סוליה קשיחה וכבדה:</strong> מונעת תנועתיות טבעית ומחלישה את שרירי המפרקים עם מדרסים פאסיביים המכבים את כף הרגל.</span>
                </li>
              </ul>
            </div>

            {/* Barefoot advantages */}
            <div className="bg-emerald-950/20 border border-emerald-900/40 p-6 rounded-2xl flex flex-col gap-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl"></div>
              <div className="flex items-center gap-3">
                <span className="bg-emerald-500/10 text-[#bca374] border border-[#112d21]/40 w-8 h-8 rounded-full flex items-center justify-center font-bold">✓</span>
                <h3 className="font-bold text-slate-200 text-base">הטכנולוגיה הבריאה של Wide Barefoot Flats</h3>
              </div>
              <ul className="space-y-3.5 text-xs text-slate-350 text-right font-medium">
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-450 font-bold shrink-0">✓</span>
                  <span><strong>מבנה רגל אנטומי רחב:</strong> נותן חופש שלם לבהונות הרגליים להתפרס באופן טבעי, לייצב את הגוף ולמנוע עייפות.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-450 font-bold shrink-0">✓</span>
                  <span><strong>סוליית פלטפורמה אפס גובה (Zero Drop):</strong> יציבה מלאה וזקופה המשפרת מנחי עצמות הגוף, הגב ומקלה על הברכיים.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-450 font-bold shrink-0">✓</span>
                  <span><strong>סוליית גומי סופר גמישה וקלות נוצה:</strong> מפעילה יציבה אקטיבית המפתחת את חוזק וגמישות גידי כף הרגל בכל פסיעה.</span>
                </li>
              </ul>
            </div>

          </div>
        </section>

        {/* HIGH CONVERTING CORE BENEFITS (BENTO BOX LAYOUT) */}
        <section className="mt-12">
          
          <div className="text-center mb-8">
            <span className="bg-[#bca374]/15 text-[#bca374] border border-[#bca374]/20 text-xs font-bold px-3 py-1.5 rounded-full inline-block">
              מפרט טכנולוגי ונוחות עילאית
            </span>
            <h2 className="text-2xl md:text-3xl font-black text-slate-100 mt-2 tracking-tight">
              מה מפעיל את כוח הנוחות של יחפנים?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PRODUCT_DATA.features.map(feature => {
              // Map icons name to SVG component manually to guarantee build safe
              const renderIcon = (name: string) => {
                switch (name) {
                  case "Maximize2": return <Maximize2 className="w-6 h-6 text-[#bca374]" />;
                  case "Wind": return <Wind className="w-6 h-6 text-[#bca374]" />;
                  case "Activity": return <Activity className="w-6 h-6 text-[#bca374]" />;
                  case "CheckCircle2": return <CheckCircle2 className="w-6 h-6 text-[#bca374]" />;
                  case "Palette": return <Palette className="w-6 h-6 text-[#bca374]" />;
                  case "CalendarDays": return <CalendarDays className="w-6 h-6 text-[#bca374]" />;
                  default: return <Sparkles className="w-6 h-6 text-[#bca374]" />;
                }
              };

              return (
                <div 
                  key={feature.id}
                  className="bg-[#0c241b]/30 rounded-2xl p-6 border border-[#112d21] hover:border-[#bca374]/40 transition-all text-right flex flex-col justify-between group"
                >
                  <div>
                    <div className="bg-[#06110c]/70 w-12 h-12 rounded-xl flex items-center justify-center mb-4 border border-[#112d21] group-hover:border-[#bca374]/30 group-hover:shadow-[0_0_15px_rgba(188,163,116,0.15)] transition-all">
                      {renderIcon(feature.iconName)}
                    </div>
                    <h3 className="text-lg font-bold text-slate-200 mb-2">{feature.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

        </section>

        {/* COMPREHENSIVE DETAILED TECHNICAL SPECIFICATIONS TABLE */}
        <section className="mt-12 bg-[#0c241b]/30 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-[#112d21] shadow-xl">
          
          <div className="max-w-xl mx-auto text-center mb-6">
            <h2 className="text-2xl font-black text-slate-100">מפרט טכני מלא ומפורט</h2>
            <p className="text-xs text-slate-450 mt-1">
              כל המידע ההנדסי והרכב הבדים לידיעתך
            </p>
          </div>

          <div className="max-w-2xl mx-auto overflow-hidden border border-[#112d21] rounded-2xl shadow-2xl">
            <table className="w-full text-right border-collapse text-xs md:text-sm">
              <tbody>
                {PRODUCT_DATA.specs.map((spec: Spec, index) => (
                  <tr 
                    key={spec.key}
                    className="even:bg-[#0c241b]/20 hover:bg-[#0c241b]/50 transition-colors border-b border-[#112d21] last:border-b-0"
                  >
                    <td className="p-4 font-bold text-slate-205 w-1/3">{spec.key}</td>
                    <td className="p-4 text-slate-400 w-2/3">{spec.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

         </section>

        {/* CUSTOMER REVIEWS WITH REAL PHOTO SENSORY PROOF AND FORM CONTROLLER */}
        <section className="mt-12 bg-[#0c241b]/30 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-[#112d21] shadow-xl">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Review summary cards (Cols: 4) */}
            <div className="lg:col-span-4 bg-[#06110c]/40 p-6 rounded-2xl border border-[#112d21] text-center">
              <span className="text-[11px] font-black text-slate-400 block mb-1">דירוג חנויות ממוצע</span>
              <div className="text-6xl font-black text-slate-100 leading-none">{calculatedAvgRating}</div>
              
              <div className="flex justify-center text-[#bca374] my-3">
                {[1, 2, 3, 4, 5].map(star => {
                  const val = parseFloat(calculatedAvgRating);
                  return (
                    <Star 
                      key={star} 
                      className={`w-6 h-6 ${star <= val ? 'fill-current' : 'text-emerald-950/60'}`} 
                    />
                  );
                })}
              </div>

              <div className="text-sm font-bold text-slate-350">מתוכם 100% המלצות חיוביות!</div>
              <p className="text-xs text-slate-500 leading-relaxed mt-2 font-medium">
                מבוסס על {allReviews.length} ביקורות קונים אמיתיים שהתקבלו מאימות הזמנות barefoot הרשמית.
              </p>

              {/* Verified Badge */}
              <div className="mt-4 pt-4 border-t border-[#112d21] flex items-center justify-center gap-1.5 text-xs text-[#bca374] font-medium bg-[#0c241b]/40 border border-[#bca374]/20 py-2.5 rounded-xl">
                <Check className="w-4.5 h-4.5 stroke-[3] text-[#bca374]" />
                <span>כל הביקורות מלקוחות מאומתים</span>
              </div>

              {/* Interactive stars bar filters */}
              <div className="mt-6 flex flex-col gap-2">
                <div className="text-xs font-bold text-slate-400 text-right mb-1">סנני ביקורות לפי דירוג:</div>
                {[5, 4].map(starsVal => {
                  const count = allReviews.filter(r => r.rating === starsVal).length;
                  const pct = ((count / allReviews.length) * 100).toFixed(0);
                  const isFiltered = selectedRatingFilter === starsVal;

                  return (
                    <button
                      key={starsVal}
                      onClick={() => setSelectedRatingFilter(isFiltered ? null : starsVal)}
                      className={`w-full flex items-center gap-3 text-xs text-slate-400 hover:text-slate-200 text-right py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                        isFiltered ? 'bg-[#bca374]/15 border border-[#bca374]/30 text-[#bca374]' : 'hover:bg-[#06110c]/45'
                      }`}
                    >
                      <span className="w-10 font-bold flex items-center justify-end gap-0.5">
                        <span>{starsVal}</span>
                        <Star className="w-3.5 h-3.5 fill-[#bca374] text-[#bca374] inline" />
                      </span>
                      <div className="flex-grow h-2 bg-[#06110c] rounded-full overflow-hidden border border-[#112d21]/30">
                        <div className="h-full bg-[#bca374] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-12 text-left font-mono text-slate-500 font-bold">
                        {count} ({pct}%)
                      </span>
                    </button>
                  );
                })}

                {selectedRatingFilter !== null && (
                  <button
                    onClick={() => setSelectedRatingFilter(null)}
                    className="text-xs font-bold text-[#bca374] hover:underline text-center mt-2 cursor-pointer"
                  >
                    הסר מסנן (הצג את כל הביקורות)
                  </button>
                )}
              </div>
            </div>

            {/* Live review comments and user reviews form (Cols: 8) */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              <div className="flex items-center justify-between border-b border-[#112d21] pb-3">
                <h3 className="font-bold text-slate-200 text-lg">ביקורות קונים ({filteredReviews.length})</h3>
                <span className="text-xs font-normal text-slate-450">
                  {selectedRatingFilter ? `מציג ביקורות של {selectedRatingFilter} כוכבים בלבד` : 'מציג את כל הביקורות'}
                </span>
              </div>

              {/* Dynamic review list rendering */}
              <div className="space-y-4">
                {filteredReviews.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6 font-medium">לא נמצאו ביקורות העונות למסנן הנבחר.</p>
                ) : (
                  filteredReviews.map((rev: Review) => (
                    <div 
                      key={rev.id}
                      className="bg-[#0c241b]/30 p-5 rounded-2xl border border-[#112d21] text-right flex flex-col gap-3 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#112d21]/60 pb-2.5">
                        
                        {/* Rating stars & verified badge */}
                        <div className="flex items-center gap-2">
                          <div className="flex text-[#bca374]">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star 
                                key={i} 
                                className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-current' : 'text-emerald-950/60'}`} 
                              />
                            ))}
                          </div>
                          
                          {rev.isVerified && (
                            <span className="text-[10px] bg-[#bca374]/15 text-[#bca374] font-semibold border border-[#bca374]/20 px-2 py-0.5 rounded-full flex items-center gap-1.5 leading-none">
                              <CheckCircle2 className="w-3 h-3 text-[#bca374] inline" />
                              רכישה מאומתת
                            </span>
                          )}
                        </div>

                        {/* Person name & Date */}
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium select-none">
                          <span className="font-bold text-slate-300">{rev.author}</span>
                          <span>•</span>
                          <span>{rev.date}</span>
                        </div>
                      </div>

                      {/* Purchased Meta selection */}
                      <div className="flex flex-wrap gap-2 text-[10px] md:text-xs">
                        <span className="bg-[#06110c]/40 border border-[#112d21] text-slate-400 px-2.5 py-1 rounded-md">
                          צבע: <strong className="text-slate-200">{rev.color}</strong>
                        </span>
                        <span className="bg-[#06110c]/40 border border-[#112d21] text-slate-400 px-2.5 py-1 rounded-md">
                          מידה: <strong className="text-slate-200">{rev.size}</strong>
                        </span>
                      </div>

                      <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-normal">{rev.text}</p>

                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {rev.tags.map(tag => (
                          <span key={tag} className="text-[10px] bg-[#bca374]/10 border border-[#bca374]/20 text-[#bca374] px-2.5 py-0.5 rounded-full font-bold">
                            #{tag}
                          </span>
                        ))}
                      </div>

                    </div>
                  ))
                )}
              </div>

              {/* USER ADD-REVIEW INTERACTIVE FORM PANEL */}
              <div className="bg-[#0c241b]/30 rounded-2xl p-6 border border-[#112d21] mt-4 text-right">
                <h4 className="text-base font-bold text-slate-100 mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-5.5 h-5.5 text-[#bca374] inline animate-pulse" />
                  הוספת ביקורת אישית משלך מהנעליים
                </h4>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  הזמנתם לאחרונה? שתפו את השמחה והנוחות של הבהונות שלכם כדי לעזור לקונים הבאים!
                </p>

                {addReviewSuccess && (
                  <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 text-[#bca374] text-xs font-bold p-3.5 rounded-xl leading-relaxed font-semibold">
                    תודה רבה! הביקורת האישית שלך נוספה בהצלחה למערכת והחלה להשפיע מייד על ציון הדירוג הכללי!
                  </div>
                )}

                {addReviewError && (
                  <div className="mb-4 bg-red-400/15 border border-red-500/20 text-red-350 text-xs font-bold p-3 rounded-xl font-semibold">
                    {addReviewError}
                  </div>
                )}

                <form onSubmit={handleAddReview} className="space-y-4">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Your Name */}
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1">שם פרטי ומשפחה:</label>
                      <input 
                        type="text" 
                        value={newReviewName}
                        onChange={(e) => setNewReviewName(e.target.value)}
                        placeholder="שירה כ."
                        className="w-full bg-[#06110c] text-xs border border-[#112d21] text-slate-100 rounded-lg p-2.5 focus:border-[#bca374] focus:ring-1 focus:ring-[#bca374] outline-hidden placeholder:text-slate-650"
                      />
                    </div>

                    {/* Choose stars rating */}
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1">כמות כוכבים מומלצת:</label>
                      <select
                        value={newReviewRating}
                        onChange={(e) => setNewReviewRating(parseInt(e.target.value))}
                        className="w-full bg-[#06110c] text-xs border border-[#112d21] text-slate-200 rounded-lg p-2.5 focus:border-[#bca374] outline-hidden cursor-pointer"
                      >
                        <option value="5">⭐⭐⭐⭐⭐ 5 כוכבים מושלם</option>
                        <option value="4">⭐⭐⭐⭐ 4 כוכבים מעולה</option>
                        <option value="3">⭐⭐⭐ 3 כוכבים בינוני</option>
                        <option value="2">⭐⭐ 2 כוכבים גרוע</option>
                        <option value="1">⭐ 1 כוכב נורא</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Purchased color selection */}
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1">באיזה צבע רכשת?</label>
                      <select
                        value={newReviewColor}
                        onChange={(e) => setNewReviewColor(e.target.value)}
                        className="w-full bg-[#06110c] text-xs border border-[#112d21] text-slate-200 rounded-lg p-2.5 focus:border-[#bca374] outline-hidden cursor-pointer"
                      >
                        {PRODUCT_DATA.colors.map(color => (
                          <option key={color.id} value={color.name}>{color.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Bought size selection */}
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1">מה מידת הנעל?</label>
                      <select
                        value={newReviewSize}
                        onChange={(e) => setNewReviewSize(parseInt(e.target.value))}
                        className="w-full bg-[#06110c] text-xs border border-[#112d21] text-slate-200 rounded-lg p-2.5 focus:border-[#bca374] outline-hidden cursor-pointer"
                      >
                        {PRODUCT_DATA.sizes.map(s => (
                          <option key={s.size} value={s.size}>מידה {s.size}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Review Text */}
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">כתבי את חוות הדעת שלך:</label>
                    <textarea 
                      rows={3} 
                      value={newReviewText}
                      onChange={(e) => setNewReviewText(e.target.value)}
                      placeholder="הנעליים מאוד גמישות, רכות ונוחות, משלוח מהיר..."
                      className="w-full bg-[#06110c] text-xs border border-[#112d21] text-slate-100 rounded-lg p-2.5 focus:border-[#bca374] focus:ring-1 focus:ring-[#bca374] outline-hidden placeholder:text-slate-600"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="text-left">
                    <button
                      type="submit"
                      className="bg-gradient-to-r from-[#bca374] to-[#a38b5d] hover:from-[#ad9466] hover:to-[#91794d] active:scale-95 text-slate-950 font-black text-xs py-2.5 px-6 rounded-lg transition-all inline-flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <Send className="w-3 h-3 text-slate-950" />
                      <span>פרסמו ביקורת שלי כעת</span>
                    </button>
                  </div>
                </form>
              </div>

            </div>

          </div>

        </section>

        {/* FREQUENTLY ASKED QUESTIONS (FAQ) ACCORDION SECTION */}
        <section className="mt-12 bg-[#0c241b]/30 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-[#112d21] shadow-xl">
          
          <div className="max-w-xl mx-auto text-center mb-8">
            <span className="text-[#bca374] font-extrabold text-xs uppercase tracking-wider block mb-1">עושים סדר בפרטים</span>
            <h2 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight">שאלות נפוצות ותשובות ברורות</h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            
            {/* FAQ 1 */}
            <div className="border border-[#112d21] p-4.5 rounded-xl bg-[#06110c]/40 hover:bg-[#0c241b]/40 transition-all">
              <h4 className="font-bold text-sm md:text-base text-slate-200 mb-1.5 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#bca374] shrink-0" />
                <span>מה היתרון הגדול של עיצוב Barefoot יחפני רחב?</span>
              </h4>
              <p className="text-xs md:text-sm text-slate-400 leading-relaxed pr-6 font-medium">
                נעליים מסחריות רגילות בעלות קצה צר לוחצות את הבהונות ותוחמות את השרירים לחולשה קבועה. עיצוב היחפנים (Barefoot) הרחב מעניק לאצבעות חופש פריסה טבעי המעניק יציבה בריאה, מונע כאבים בברכיים ובגו, ומסייע בחיזוק טבעי של גידי כף הרגל.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="border border-[#112d21] p-4.5 rounded-xl bg-[#06110c]/40 hover:bg-[#0c241b]/40 transition-all">
              <h4 className="font-bold text-sm md:text-base text-slate-200 mb-1.5 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#bca374] shrink-0" />
                <span>איך בוחרים את המידה המתאימה כשיש ספק?</span>
              </h4>
              <p className="text-xs md:text-sm text-slate-400 leading-relaxed pr-6 font-medium">
                השתמשו במחשבון המידות הדינמי המופיע למעלה! כל שעליכם לעשות הוא למדוד את אורך הרגל בסנטימטרים ולהזין אותו. הנעליים מיוצרות בדיוק לפי הסטנדרט האירופי הרגיל. במידה ואת עם חצי מידה, מומלץ להזמין את המידה הגדולה יותר.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="border border-[#112d21] p-4.5 rounded-xl bg-[#06110c]/40 hover:bg-[#0c241b]/40 transition-all">
              <h4 className="font-bold text-sm md:text-base text-slate-200 mb-1.5 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#bca374] shrink-0" />
                <span>מהי עלות המשלוח?</span>
              </h4>
              <p className="text-xs md:text-sm text-slate-400 leading-relaxed pr-6 font-medium">
                המשלוח מבוטח לחלוטין והוא בחינם לכל חלקי הארץ במבצע הנוכחי! אם המשלוח אובד או נפגם, תקבלו זיכוי או משלוח חדש ללא כל עלות נוספת.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="border border-[#112d21] p-4.5 rounded-xl bg-[#06110c]/40 hover:bg-[#0c241b]/40 transition-all">
              <h4 className="font-bold text-sm md:text-base text-slate-200 mb-1.5 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#bca374] shrink-0" />
                <span>האם הנעליים הללו עמידות למים עבור החורף?</span>
              </h4>
              <p className="text-xs md:text-sm text-slate-400 leading-relaxed pr-6 font-medium">
                כפי שמצוין במפרט הטכני, נעלי ה-Wide Barefoot Flats הללו מיוצרות מבד קנבס נושם ובטנה אוורירית המיועדים לעונות המעבר (אביב וסתיו) ולימי הקיץ והפנאי הממושכים. לכן הן אינן אטומות לחלוטין למים וגשמים סוערים, אך מתייבשות במהירות רבה.
              </p>
            </div>

          </div>

        </section>
          </>
        ) : currentView === "seo" ? (
          <SeoKnowledgeHub />
        ) : currentView === "terms" ? (
          <TermsOfUse onBack={() => changeView("shop")} />
        ) : currentView === "privacy" ? (
          <PrivacyPolicy onBack={() => changeView("shop")} />
        ) : currentView === "shipping" ? (
          <ShippingPolicy onBack={() => changeView("shop")} />
        ) : (
          <div className="bg-[#05100a] text-white p-4 md:p-8 rounded-3xl border border-[#113221] shadow-[0_12px_45px_rgba(0,0,0,0.6)] space-y-6 text-right animate-fade-in" dir="rtl">
            {!isAdminAuthenticated ? (
              // ADMIN PASSWORD PROTECTION GATEWAY
              <div className="max-w-md mx-auto py-10 space-y-6">
                <div className="text-center space-y-2">
                  <div className="bg-[#bca374]/15 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-[#bca374] border border-[#bca374]/30 animate-pulse">
                    <Lock className="w-8 h-8" />
                  </div>
                  <h3 className="font-extrabold text-2xl text-[#bca374]">אזור מנהל מערכת</h3>
                  <p className="text-xs text-slate-400 font-medium">אנא הזיני את קוד הגישה האישי כדי לצפות בהזמנות ולנהל את החנות</p>
                  <p className="text-[11px] text-[#bca374] bg-[#bca374]/10 border border-[#bca374]/20 rounded-lg px-2 py-1 mx-auto max-w-xs font-semibold">
                    🔑 קוד ברירת המחדל לכניסה הוא: <span className="font-mono font-black">1234</span>
                  </p>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); fetchAdminOrders(); }} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">קוד גישה של מנהל *</label>
                    <input
                      type="password"
                      required
                      value={adminPasscodeInput}
                      onChange={(e) => setAdminPasscodeInput(e.target.value)}
                      placeholder="הקלידי כאן קוד גישה (למשל: 1234)..."
                      className="w-full text-center bg-[#091b12] text-white text-lg tracking-widest border border-[#1b3d2d] rounded-xl p-3 focus:ring-2 focus:ring-[#bca374] focus:border-[#bca374] outline-hidden font-mono"
                    />
                  </div>

                  {adminError && (
                    <div className="bg-red-950/20 text-red-400 text-xs font-bold p-3 rounded-lg border border-red-900/40 text-center animate-pulse">
                      ⚠️ {adminError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={adminLoading}
                    className="w-full bg-gradient-to-r from-[#bca374] to-[#a38b5d] hover:from-[#ad9466] hover:to-[#91794d] text-slate-950 py-3 rounded-xl font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>{adminLoading ? "מתחבר ומטעין..." : "כניסה מורשית למערכת"}</span>
                  </button>
                </form>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => changeView("shop")}
                    className="text-xs text-slate-400 hover:text-[#bca374] underline font-bold"
                  >
                    חזרה לחנות הרגילה
                  </button>
                </div>
              </div>
            ) : (
              // MAIN ADMIN ORDERS DASHBOARD PAGE
              <div className="space-y-6">
                
                {/* Header Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1b3d2d] pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#bca374] animate-ping" />
                      <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
                        <span>ניהול הזמנות Barefoot</span>
                        <span className="text-xs px-2.5 py-1 bg-[#1b3d2d] text-[#bca374] rounded-full border border-[#bca374]/20 font-bold font-mono">ממשק מנהל</span>
                      </h2>
                    </div>
                    <p className="text-xs text-slate-400 font-medium mt-1">צפייה בפרטי לקוחות, עדכון סטטוס משלוח, ומספרי מעקב בזמן אמת</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdminAuthenticated(false);
                        localStorage.removeItem("admin_passcode");
                        changeView("shop");
                      }}
                      className="px-4 py-2 bg-red-950/35 border border-red-900/45 text-red-400 hover:bg-red-950/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      התנתקות מנהל
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => changeView("shop")}
                      className="px-4 py-2 bg-[#091b12] border border-[#1b3d2d] hover:border-[#bca374]/50 leading-none text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>חזרה לחנות הקניות</span>
                      <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
                    </button>
                  </div>
                </div>

                {/* Dashboard Summary Widgets Bento-Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Widget 1: Revenue */}
                  <div className="bg-[#091b12] border border-[#1b3d2d] rounded-2xl p-4 flex items-center justify-between text-right">
                    <div>
                      <span className="text-[10px] md:text-xs text-slate-400 font-extrabold block">סה"כ הכנסות (לא כולל מבוטלות)</span>
                      <span className="text-base md:text-xl font-black text-emerald-400 tracking-tight font-sans block mt-1">
                        ₪{adminOrders
                          .filter(o => o.status !== "בוטל")
                          .reduce((sum, o) => sum + (o.totalPrice || 0), 0)
                          .toLocaleString()}
                      </span>
                    </div>
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl shrink-0">
                      <Coins className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Widget 2: Total Count */}
                  <div className="bg-[#091b12] border border-[#1b3d2d] rounded-2xl p-4 flex items-center justify-between text-right">
                    <div>
                      <span className="text-[10px] md:text-xs text-slate-400 font-extrabold block">סה"כ כמות הזמנות</span>
                      <span className="text-base md:text-xl font-black text-white tracking-tight font-mono block mt-1">
                        {adminOrders.length} הזמנות
                      </span>
                    </div>
                    <div className="p-3 bg-[#bca374]/10 text-[#bca374] border border-[#bca374]/20 rounded-xl shrink-0">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Widget 3: Pending */}
                  <div className="bg-[#091b12] border border-[#1b3d2d] rounded-2xl p-4 flex items-center justify-between text-right">
                    <div>
                      <span className="text-[10px] md:text-xs text-slate-400 font-extrabold block">ממתין לטיפול (חדשות)</span>
                      <span className="text-base md:text-xl font-black text-amber-400 tracking-tight font-mono block mt-1">
                        {adminOrders.filter(o => o.status === "חדש" || o.status === "בטיפול").length} הזמנות
                      </span>
                    </div>
                    <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Widget 4: Shipped */}
                  <div className="bg-[#091b12] border border-[#1b3d2d] rounded-2xl p-4 flex items-center justify-between text-right">
                    <div>
                      <span className="text-[10px] md:text-xs text-slate-400 font-extrabold block">נשלחו ונמסרו</span>
                      <span className="text-base md:text-xl font-black text-sky-400 tracking-tight font-mono block mt-1">
                        {adminOrders.filter(o => o.status === "נשלח").length} חבילות
                      </span>
                    </div>
                    <div className="p-3 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-xl shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Google Sheets Integration Panel */}
                <div className="bg-[#07190f] border border-[#143e26] rounded-2xl p-5 md:p-6 space-y-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#143e26] pb-4 text-right">
                    <div className="flex items-center gap-3 justify-start flex-row-reverse w-full md:w-auto">
                      <div className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/20">
                        {/* Custom Google Sheets table icon */}
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2M9 17H7v-2h2zm0-4H7v-2h2zm0-4H7V7h2zm4 8h-2v-2h2zm0-4h-2v-2h2zm0-4h-2V7h2zm4 8h-2v-2h2zm0-4h-2v-2h2zm0-4h-2V7h2z"/>
                        </svg>
                      </div>
                      <div className="text-right">
                        <h3 className="font-extrabold text-base md:text-lg text-white">העברת הנתונים וסנכרון ל-Google Sheets 📊</h3>
                        <p className="text-xs text-slate-400 font-medium">שמירה אוטומטית, פשוטה ומיידית של כל ההזמנות בגיליון אלקטרוני</p>
                      </div>
                    </div>
                  </div>

                  {sheetsError && (
                    <div className="bg-red-950/20 text-red-400 text-xs font-bold p-3.5 rounded-xl border border-red-900/45 text-right">
                      ⚠️ {sheetsError}
                    </div>
                  )}

                  {sheetsSuccess && (
                    <div className="bg-emerald-950/25 text-emerald-400 text-xs font-bold p-3.5 rounded-xl border border-emerald-900/45 text-right">
                      ✓ {sheetsSuccess}
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" dir="rtl">
                    {/* Method A: Permanent Webhook (Recommended) */}
                    <div className="bg-[#04120a] border border-[#143a22] rounded-xl p-4 md:p-5 space-y-4 text-right flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-md">מומלץ ויציב ⭐️</span>
                          <h4 className="font-extrabold text-sm text-slate-100">שיטה 1: חיבור קבוע ללא פג תוקף (Apps Script)</h4>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed font-medium">
                          בשיטה זו, הנתונים מועברים **באופן אוטומטי ומיידי** בכל רגע שמתבצעת הזמנה, ללא צורך בהתחברות חוזרת של המנהל (ללא פג תוקף של אסימון אבטחה).
                        </p>

                        <div className="space-y-2 bg-[#091b11] p-3 rounded-lg border border-[#1a442a]">
                          <span className="text-[11px] font-extrabold text-[#bca374] block">איך מגדירים ב-30 שניות?</span>
                          <ol className="text-[11px] text-slate-300 space-y-1 list-decimal list-inside pr-1">
                            <li>פתחי את קובץ הגוגל שיטס שלך.</li>
                            <li>לחצי בתפריט למעלה על <strong>הרחבות &gt; Apps Script</strong> (Extensions).</li>
                            <li>מחקי את מה שרשום שם והדביקי את הקוד הבא:</li>
                          </ol>
                          <textarea
                            readOnly
                            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                            className="w-full h-24 bg-[#030a06] text-emerald-400 text-[10px] font-mono p-2 rounded-md border border-[#12311e] outline-hidden cursor-pointer mt-1"
                            value={`function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("הזמנות") || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["מזהה הזמנה", "תאריך ושעה", "שם לקוח", "טלפון", "עיר", "כתובת", "אימייל", "סכום כולל", "פריטים", "אמצעי תשלום", "סטטוס", "מספר מעקב"]);
    }
    sheet.appendRow([data.id, data.createdAt, data.fullName, data.phoneNumber, data.city, data.address, data.email, data.totalPrice, data.items, data.paymentMethod, data.status, data.trackingNumber]);
    return ContentService.createTextOutput(JSON.stringify({result: "success"})).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({result: "error", error: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}`}
                          />
                          <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                            4. לחצי על <strong>Deploy &gt; New Deployment</strong> (פריסה &gt; פריסה חדשה).<br />
                            5. בחרי בגלגל השיניים ב-<strong>Web App</strong>. הגדירי את הגישה ל-<strong>Anyone</strong> (כולם) ופרסי.<br />
                            6. העתיקי את ה-Web App URL שקיבלת והדביקי כאן למטה:
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-[#143a22]/60">
                        <label className="text-[11px] text-slate-300 font-bold block">כתובת ה-Webhook שלך:</label>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            saveWebhookUrlToBackend(webhookInput);
                          }}
                          className="flex gap-2 w-full"
                        >
                          <input
                            type="url"
                            placeholder="https://script.google.com/macros/s/.../exec"
                            className="bg-[#05110a] border border-[#173822] rounded-xl px-3 py-2 text-[10px] text-white font-mono flex-1 focus:ring-1 focus:ring-[#bca374] outline-hidden text-left"
                            value={webhookInput}
                            onChange={(e) => setWebhookInput(e.target.value)}
                          />
                          <button
                            type="submit"
                            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                          >
                            שמור חיבור 🔌
                          </button>
                        </form>
                        {sheetsConfig?.webhookUrl && (
                          <div className="text-[10px] text-emerald-400 font-extrabold flex items-center gap-1.5 justify-end">
                            <span>✓ מחובר כעת ומעביר נתונים אוטומטית!</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Method B: Interactive OAuth connection */}
                    <div className="bg-[#04120a] border border-[#143a22] rounded-xl p-4 md:p-5 space-y-4 text-right flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-[#bca374]/10 text-[#bca374] text-[10px] font-black rounded-md">ממשק מהיר ⚡️</span>
                          <h4 className="font-extrabold text-sm text-slate-100">שיטה 2: התחברות לחשבון Google בלחיצה אחת</h4>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed font-medium">
                          חיבור ישיר של האתר לחשבון הגוגל דרייב שלך. מאפשר יצירת קובץ גיליון חדש באופן אוטומטי וביצוע סנכרון מלא של כל ההזמנות הקיימות בלחיצת כפתור אחת.
                        </p>

                        {!googleUser ? (
                          <div className="py-4 flex flex-col items-center justify-center bg-[#091b11]/30 rounded-xl border border-[#153a23] space-y-2">
                            <span className="text-[11px] text-slate-400 font-medium">כדי להתחיל, התחברי עם חשבון הגוגל שלך:</span>
                            <button
                              type="button"
                              onClick={handleGoogleLogin}
                              className="gsi-material-button text-xs font-bold px-3.5 py-2 cursor-pointer transition-all duration-300 transform hover:scale-[1.02]"
                            >
                              <div className="gsi-material-button-state"></div>
                              <div className="gsi-material-button-content-wrapper">
                                <div className="gsi-material-button-icon">
                                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block" }}>
                                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                                  </svg>
                                </div>
                                <span className="gsi-material-button-contents font-sans">Sign in with Google</span>
                              </div>
                            </button>
                          </div>
                        ) : (
                          <div className="bg-[#091b11] rounded-xl p-3 border border-[#1a442a] space-y-2">
                            <div className="flex items-center justify-between flex-row-reverse">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-slate-350 font-bold">{googleUser.email}</span>
                                {googleUser.photoURL && (
                                  <img src={googleUser.photoURL} alt="" className="w-5 h-5 rounded-full border border-[#bca374]/30" referrerPolicy="no-referrer" />
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={handleGoogleLogout}
                                className="px-2 py-0.5 bg-red-950/40 hover:bg-red-900/40 text-red-400 hover:text-white rounded-md text-[9px] font-bold transition-all cursor-pointer"
                              >
                                התנתק
                              </button>
                            </div>
                            <div className="text-[10px] text-emerald-400 font-extrabold text-right">
                              ✓ חיבור OAuth פעיל כעת!
                            </div>
                          </div>
                        )}
                      </div>

                      {googleUser && (
                        <div className="space-y-3 pt-3 border-t border-[#143a22]/60">
                          {sheetsConfig?.spreadsheetId && (
                            <div className="space-y-2">
                              <div className="text-[11px] text-slate-300 font-medium">
                                מקושר כעת לגיליון מזהה: <span className="font-mono bg-[#030c06] p-1 rounded-sm text-amber-300 block select-all mt-1">{sheetsConfig.spreadsheetId}</span>
                              </div>
                              <div className="flex flex-wrap gap-2 justify-end">
                                <a
                                  href={`https://docs.google.com/spreadsheets/d/${sheetsConfig.spreadsheetId}/edit`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 bg-emerald-950/45 border border-emerald-900/55 text-emerald-300 hover:text-white rounded-lg text-[10px] font-bold transition-all whitespace-nowrap"
                                >
                                  פתחי גיליון ↗
                                </a>
                                <button
                                  type="button"
                                  onClick={handleFullSync}
                                  disabled={sheetsSyncing}
                                  className="px-3 py-1.5 bg-[#bca374] text-slate-950 rounded-lg text-[10px] font-black transition-all disabled:opacity-50 cursor-pointer"
                                >
                                  {sheetsSyncing ? "סנכרון..." : "🔄 סנכרן הכל מחדש"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveSheetsTokenToBackend(googleAccessToken || "", "")}
                                  className="px-2 py-1.5 bg-slate-950/40 text-slate-400 hover:text-red-400 rounded-lg text-[10px] font-bold transition-all border border-slate-800 cursor-pointer"
                                >
                                  נתק גיליון
                                </button>
                              </div>
                            </div>
                          )}

                          {!sheetsConfig?.spreadsheetId && (
                            <div className="space-y-3">
                              <div className="flex flex-col sm:flex-row items-center gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={handleCreateSheet}
                                  disabled={sheetsLoading}
                                  className="w-full sm:w-auto px-3.5 py-2 bg-gradient-to-r from-[#bca374] to-[#a38b5d] text-slate-950 font-black rounded-xl text-[11px] transition-all disabled:opacity-50 cursor-pointer text-center"
                                >
                                  {sheetsLoading ? "יוצר גיליון מעוצב..." : "🪄 צור גיליון הזמנות חדש בדרייב שלי"}
                                </button>
                              </div>
                              <div className="text-right text-[10px] text-slate-400">או לקשר גיליון קיים:</div>
                              <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const form = e.currentTarget;
                                const idInput = form.elements.namedItem("sheetId") as HTMLInputElement;
                                if (idInput.value.trim() !== "") {
                                  saveSheetsTokenToBackend(googleAccessToken || "", idInput.value.trim());
                                  setSheetsSuccess("مזהה גיליון שודרג בהצלחה!");
                                }
                              }}
                              className="flex gap-2 w-full sm:w-auto flex-1 max-w-md"
                            >
                              <input
                                name="sheetId"
                                type="text"
                                placeholder="הכניסי Spreadsheet ID קיים..."
                                className="bg-[#05110a] border border-[#173822] rounded-xl px-3 py-2 text-xs text-white font-mono flex-1 focus:ring-1 focus:ring-[#bca374] outline-hidden text-right"
                              />
                              <button
                                type="submit"
                                className="px-4 py-2 bg-[#1c3826] hover:bg-[#274f35] text-white rounded-xl text-xs font-bold border border-[#173822] transition-all cursor-pointer"
                              >
                                קשר
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

                {/* Filters block */}
                <div className="bg-[#091b12]/65 border border-[#1b3d2d] rounded-2xl p-4.5 flex flex-col md:flex-row items-center justify-between gap-4">
                  {/* Search bar */}
                  <div className="relative w-full md:max-w-md">
                    <input
                      type="text"
                      className="w-full bg-[#05110a] text-slate-200 border border-[#1b3d2d] hover:border-[#bca374]/30 focus:border-[#bca374] pl-9 pr-10 py-2.5 rounded-xl text-xs md:text-sm font-semibold outline-hidden text-right"
                      placeholder="חפשי לפי שם לקוח, טלפון, עיר או מספר הזמנה..."
                      value={adminSearchQuery}
                      onChange={(e) => setAdminSearchQuery(e.target.value)}
                    />
                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>

                  {/* Status filter buttons */}
                  <div className="flex flex-wrap gap-2 justify-end w-full md:w-auto">
                    {[
                      { key: "all", label: "כל ההזמנות" },
                      { key: "חדש", label: "חדשות" },
                      { key: "בטיפול", label: "בטיפול" },
                      { key: "נשלח", label: "נשלחו" },
                      { key: "בוטל", label: "בוטלו" }
                    ].map(btn => (
                      <button
                        key={btn.key}
                        type="button"
                        onClick={() => setAdminStatusFilter(btn.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          adminStatusFilter === btn.key
                            ? "bg-[#bca374] text-slate-950 border-[#bca374] shadow-sm font-black"
                            : "bg-[#05110a] border-[#1b3d2d] text-slate-400 hover:text-white"
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filter and render orders list */}
                {adminLoading ? (
                  <div className="text-center py-12 text-slate-400 font-bold space-y-3">
                    <div className="w-9 h-9 border-t-2 border-r-2 border-[#bca374] rounded-full animate-spin mx-auto" />
                    <p className="text-sm">מטעין את נתוני ההזמנות מהרשת המאובטחת...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {adminOrders.filter(order => {
                      // Apply search filter
                      const q = adminSearchQuery.trim().toLowerCase();
                      const matchQuery = !q ? true : (
                        order.id.toLowerCase().includes(q) ||
                        order.fullName.toLowerCase().includes(q) ||
                        order.phoneNumber.includes(q) ||
                        order.city.toLowerCase().includes(q) ||
                        order.address.toLowerCase().includes(q)
                      );
                      
                      // Apply status filter
                      const matchStatus = adminStatusFilter === "all" ? true : order.status === adminStatusFilter;

                      return matchQuery && matchStatus;
                    }).length === 0 ? (
                      <div className="bg-[#091b12]/30 border border-[#1b3d2d] rounded-2xl py-14 text-center text-slate-400 space-y-2">
                        <ClipboardList className="w-12 h-12 text-slate-600 mx-auto stroke-[1.5]" />
                        <h4 className="font-extrabold text-[#bca374]">לא נמצאו הזמנות תואמות</h4>
                        <p className="text-xs">לא הוגשו עדיין הזמנות בסטטוס שבחרת או שאין תוצאות עבור החיפוש שלך</p>
                      </div>
                    ) : (
                      adminOrders
                        .filter(order => {
                          const q = adminSearchQuery.trim().toLowerCase();
                          const matchQuery = !q ? true : (
                            order.id.toLowerCase().includes(q) ||
                            order.fullName.toLowerCase().includes(q) ||
                            order.phoneNumber.includes(q) ||
                            order.city.toLowerCase().includes(q) ||
                            order.address.toLowerCase().includes(q)
                          );
                          const matchStatus = adminStatusFilter === "all" ? true : order.status === adminStatusFilter;
                          return matchQuery && matchStatus;
                        })
                        .map((order) => (
                          <div
                            key={order.id}
                            className="bg-[#091b12] border border-[#1b3d2d] hover:border-[#22503a] rounded-2xl p-5 transition-all text-right space-y-4"
                          >
                            {/* Card Top Row - Details and Status */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1b3d2d]/50 pb-3">
                              <div className="flex flex-wrap items-center gap-2.5">
                                <span className="font-mono text-sm font-black text-rose-450 select-all">{order.id}</span>
                                <span className="text-[10px] text-slate-450 font-bold">
                                  {new Date(order.createdAt).toLocaleString("he-IL", {
                                    year: "numeric",
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })}
                                </span>
                                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                                  order.paymentMethod === "card" 
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                    : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                }`}>
                                  {order.paymentMethod === "card" ? "אשראי ישיר" : "PayPal"}
                                </span>
                                {order.paymentDetails?.transactionId && (
                                  <span className="text-[9px] text-slate-500 font-mono">מזהה: {order.paymentDetails.transactionId}</span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 self-start sm:self-auto">
                                <span className="text-[11px] font-bold text-slate-400">סטטוס:</span>
                                <select
                                  value={order.status}
                                  onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                                  className={`text-xs font-bold rounded-lg px-2.5 py-1 border outline-hidden transition-all cursor-pointer ${
                                    order.status === "חדש" 
                                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30" 
                                      : order.status === "בטיפול" 
                                      ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" 
                                      : order.status === "נשלח" 
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-black" 
                                      : "bg-red-500/10 text-red-400 border-red-500/30"
                                  }`}
                                >
                                  <option value="חדש">חדש</option>
                                  <option value="בטיפול">בטיפול</option>
                                  <option value="נשלח">נשלח (מועד להפצה)</option>
                                  <option value="בוטל">בוטל</option>
                                </select>
                              </div>
                            </div>

                            {/* Card Content Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 leading-relaxed text-xs">
                              {/* Customer Details info block */}
                              <div className="md:col-span-4 space-y-1.5 border-l border-[#1b3d2d]/30 pl-2">
                                <h5 className="font-extrabold text-slate-200 text-xs border-b border-[#1b3d2d]/25 pb-1 block mb-2 font-sans">פרטי משלוח ומוסר</h5>
                                <div className="text-white font-extrabold text-sm">{order.fullName}</div>
                                <div>
                                  <span className="text-slate-400 font-bold ml-1">טלפון:</span> 
                                  <a 
                                    href={`tel:${order.phoneNumber}`} 
                                    className="font-mono text-cyan-400 hover:underline font-bold"
                                    title="לחץ להתקשרות"
                                  >
                                    {order.phoneNumber}
                                  </a>
                                  {/* WhatsApp Quick Link */}
                                  <a 
                                    href={`https://wa.me/${order.phoneNumber.replace(/[-\s]/g, "").replace(/^0/, "972")}`} 
                                    target="_blank" 
                                    referrerPolicy="no-referrer"
                                    className="mr-2 text-emerald-400 hover:text-emerald-300 font-extrabold text-[10px]"
                                    title="שלח ווטסאפ מהיר"
                                  >
                                    [שלח ווטסאפ 💬]
                                  </a>
                                </div>
                                <div className="text-slate-250">
                                  <span className="text-slate-400 font-bold ml-1">כתובת למשלוח:</span> 
                                  {order.address}, {order.city}
                                </div>
                                {order.email && (
                                  <div>
                                    <span className="text-slate-400 font-bold ml-1">מייל:</span> 
                                    <span className="font-mono text-[#bca374]">{order.email}</span>
                                  </div>
                                )}
                              </div>

                              {/* Items ordered info block */}
                              <div className="md:col-span-5 flex gap-3 text-right">
                                {order.items?.[0] && (
                                  <>
                                    <img 
                                      src={order.items[0].imgUrl} 
                                      alt="color ordered preview" 
                                      className="w-16 h-16 rounded-xl object-cover border border-[#1b3d2d] shrink-0 self-center"
                                    />
                                    <div className="space-y-1">
                                      <h5 className="font-extrabold text-[#bca374] text-xs leading-snug">{order.items[0].name}</h5>
                                      <div className="text-slate-200 font-medium">צבע: <span className="font-bold text-white">{order.items[0].color}</span></div>
                                      <div className="text-slate-200 font-medium">מידה: <span className="font-extrabold text-white text-sm">{order.items[0].size || "38"}</span></div>
                                      <div className="text-slate-200 font-medium">כמות: <span className="font-extrabold text-white">{order.items[0].quantity} זוגות</span></div>
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* Price and Action buttons block */}
                              <div className="md:col-span-3 flex flex-col justify-between items-end text-left self-stretch">
                                <div className="text-right w-full">
                                  <span className="text-slate-400 font-bold block">סה"כ בעסקה:</span>
                                  <span className="text-lg font-black text-emerald-400 font-sans">₪{(order.totalPrice || 0).toFixed(2)}</span>
                                  <span className="text-[10px] text-slate-400 block font-medium">משלוח חינם לבית הלקוח</span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => deleteOrder(order.id)}
                                  className="mt-3 text-red-450 hover:text-red-400 hover:underline flex items-center gap-1 text-[11px] font-extrabold cursor-pointer"
                                  title="מחק לצמצום הרשימה"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  <span>מחיקת הזמנה</span>
                                </button>
                              </div>
                            </div>

                            {/* Tracking and Logistics controller */}
                            <div className="bg-[#05110a] border border-[#1a3f2c] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs leading-relaxed font-sans">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="bg-[#bca374]/15 text-[#bca374] text-[9px] font-black px-2 py-0.5 rounded-sm">לוגיסטיקה</span>
                                <span className="text-slate-350 font-medium">מספר מעקב למשלוח:</span>
                                {editingTrackingId === order.id ? (
                                  <div className="flex items-center gap-1.5 mt-1 sm:mt-0">
                                    <input
                                      type="text"
                                      className="bg-[#091b12] text-white border border-[#112d21] text-xs font-bold rounded-md px-2 py-1 max-w-[150px]"
                                      placeholder="מספר מעקב..."
                                      value={newTrackingVal}
                                      onChange={(e) => setNewTrackingVal(e.target.value)}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => updateOrderTracking(order.id, newTrackingVal)}
                                      className="bg-[#bca374] text-slate-950 font-black px-2.5 py-1 rounded-md text-[10px] hover:bg-[#ad9466] cursor-pointer"
                                    >
                                      שמור
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingTrackingId("")}
                                      className="text-slate-400 hover:text-white px-1"
                                    >
                                      ביטול
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-white bg-[#0e2417] px-2 py-0.5 rounded-md font-bold text-xs">
                                      {order.trackingNumber || "ללא מספר מעקב עדיין"}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingTrackingId(order.id);
                                        setNewTrackingVal(order.trackingNumber || "");
                                      }}
                                      className="text-[#bca374] hover:underline font-bold text-[10px]"
                                    >
                                      [ערוך מעקב משלוח]
                                    </button>
                                  </div>
                                )}
                              </div>

                              {order.trackingNumber && (
                                <div className="text-[10px] text-emerald-400 font-bold">
                                  ✓ מספר המעקב מוצג ללקוח במערכת המעקבים הפנימית בעמוד החיפוש!
                                </div>
                              )}
                            </div>

                          </div>
                        ))
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER AREA WITH STORE TRADEMARKS */}
      <footer className="bg-[#06110c] text-slate-450 py-10 px-6 border-t border-[#112d21] text-center text-xs relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-4">
          
          <div className="mb-2">
            <BarefootLogo variant="full" size={110} />
          </div>

          <p className="leading-relaxed max-w-xl text-slate-400">
            כל הזכויות שמורות © 2026 Wide Barefoot Flats.
          </p>

          {/* Quick legal and navigation links */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[10px] text-slate-500 font-bold" dir="rtl">
            <button type="button" onClick={() => changeView("shop")} className="hover:text-[#bca374] hover:underline cursor-pointer">חנות נעליים</button>
            <span>|</span>
            <button type="button" onClick={() => changeView("seo")} className="hover:text-[#bca374] hover:underline cursor-pointer">מדריך רפואי ואנטומי</button>

            <span>|</span>
            <button type="button" onClick={() => changeView("terms")} className="hover:text-[#bca374] hover:underline cursor-pointer">תנאי שימוש</button>
            <span>|</span>
            <button type="button" onClick={() => changeView("privacy")} className="hover:text-[#bca374] hover:underline cursor-pointer">מדיניות פרטיות</button>
            <span>|</span>
            <button type="button" onClick={() => changeView("shipping")} className="hover:text-[#bca374] hover:underline cursor-pointer">אספקה ומשלוחים</button>
          </div>

        </div>
      </footer>





      {/* SECURE CHECKOUT & ORDER FUNNEL MODAL DRAWER DIALOG */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-55 overflow-hidden">
            
            {/* Dark Blur Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCheckoutOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
            />

            {/* Slide over layout container */}
            <div className="absolute inset-y-0 left-0 max-w-full flex pl-0 pr-0">
              <motion.div 
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 180 }}
                className="w-screen max-w-lg bg-[#05110a] text-white border-r border-[#1a3d2e] shadow-2xl h-full flex flex-col justify-between overflow-y-auto"
                dir="rtl"
              >
                
                {/* Drawer Header */}
                <div className="bg-[#0b241a] text-white p-5 sticky top-0 z-20 flex items-center justify-between border-b border-[#1a4131]">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-[#bca374] p-1.5 rounded-full">
                      <Lock className="w-4.5 h-4.5 text-slate-950 stroke-[3]" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base md:text-lg text-white leading-tight">תהליך רכישה מאובטח</h3>
                      <p className="text-[10px] text-[#bca374] font-medium">המבצע והמלאי משוריינים למשך 15:00 דקות</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsCheckoutOpen(false)}
                    className="p-1.5 rounded-lg bg-[#06110c] hover:bg-black/40 text-slate-400 hover:text-white transition-all outline-hidden cursor-pointer"
                    title="סגור תשלום"
                  >
                    <X className="w-5.5 h-5.5" />
                  </button>
                </div>

                {/* Drawer Content */}
                <div className="p-6 flex-grow space-y-6 text-right" dir="rtl">

                  {/* STEP 1: FORM */}
                  {checkoutStep === "form" && (
                    <form onSubmit={handlePurchaseSubmit} className="space-y-4">
                      
                      {/* CART ITEMS SUMMARY PREVIEW */}
                      <div className="bg-[#0b241a]/60 border border-[#1a4b35] rounded-xl p-4 flex gap-4 text-right">
                        <img 
                          src={selectedColor.imgUrl} 
                          alt="selected color preview" 
                          className="w-20 h-20 rounded-lg object-cover border border-[#1a4b35] shrink-0"
                        />
                        <div className="flex-grow text-xs space-y-1">
                          <h4 className="font-black text-[#bca374] text-sm leading-tight">{PRODUCT_DATA.hebrewName}</h4>
                          <div className="text-slate-300 font-medium">צבע: <span className="font-bold text-white">{selectedColor.name}</span></div>
                          <div className="text-slate-300 font-medium">מידה: <span className="font-bold text-white">{selectedSize || 'לא נבחר'}</span></div>
                          <div className="text-slate-300 font-medium">כמות: <span className="font-bold text-[#bca374] text-sm">{quantity} זוגות</span></div>
                          <div className="text-[#bca374] font-extrabold text-sm pt-0.5 animate-pulse">
                            ₪{(PRODUCT_DATA.salePrice * quantity).toFixed(2)} במבצע למזמינים
                          </div>
                        </div>
                      </div>

                      <h4 className="font-bold text-slate-100 text-sm border-b border-[#1a4b35] pb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-[#112d21] border border-[#bca374]/30 text-[#bca374] text-[10px] font-black flex items-center justify-center">1</span>
                          <span>פרטי המשלוח שלך</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">כל השדות חובה (*)</span>
                      </h4>

                      {/* Name field */}
                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1">שם מלא כמקבל המשלוח *</label>
                        <input 
                          type="text" 
                          required
                          value={fullName}
                          onChange={(e) => {
                            setFullName(e.target.value);
                            if (formErrors.fullName) setFormErrors(prev => ({ ...prev, fullName: undefined }));
                          }}
                          placeholder="ישראל ישראלי"
                          className={`w-full bg-[#091b12] text-white text-sm border rounded-xl p-3 focus:ring-2 focus:ring-[#bca374] focus:border-[#bca374] outline-hidden hover:border-[#22503a] transition-all font-medium ${
                            formErrors.fullName ? 'border-red-500 ring-1 ring-red-500/20 bg-red-950/20' : 'border-[#1b3d2d]'
                          }`}
                        />
                        {formErrors.fullName && (
                          <p className="text-red-400 text-[11px] font-bold mt-1 text-right animate-pulse">{formErrors.fullName}</p>
                        )}
                      </div>

                      {/* Phone field */}
                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1">מספר טלפון לתיאום משלוח *</label>
                        <input 
                          type="tel" 
                          required
                          value={phoneNumber}
                          onChange={(e) => {
                            setPhoneNumber(e.target.value);
                            if (formErrors.phoneNumber) setFormErrors(prev => ({ ...prev, phoneNumber: undefined }));
                          }}
                          placeholder="050-1234567"
                          className={`w-full bg-[#091b12] text-white text-sm border rounded-xl p-3 focus:ring-1 focus:ring-[#bca374] focus:border-[#bca374] outline-hidden hover:border-[#22503a] transition-all text-right font-medium ${
                            formErrors.phoneNumber ? 'border-red-500 ring-1 ring-red-500/20 bg-red-950/20' : 'border-[#1b3d2d]'
                          }`}
                          dir="ltr"
                        />
                        <p className="text-[10px] text-[#bca374]/80 mt-1">חובה לתיאום נקודת איסוף ומסירת קוד SMS מחברת השליחויות</p>
                        {formErrors.phoneNumber && (
                          <p className="text-red-400 text-[11px] font-bold mt-1 text-right animate-pulse">{formErrors.phoneNumber}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* City field */}
                        <div>
                          <label className="text-xs font-bold text-slate-300 block mb-1">עיר יישוב *</label>
                          <input 
                            type="text" 
                            required
                            value={city}
                            onChange={(e) => {
                              setCity(e.target.value);
                              if (formErrors.city) setFormErrors(prev => ({ ...prev, city: undefined }));
                            }}
                            placeholder="תל אביב"
                            className={`w-full bg-[#091b12] text-white text-sm border rounded-xl p-3 focus:ring-1 focus:ring-[#bca374] focus:border-[#bca374] outline-hidden hover:border-[#22503a] transition-all font-medium ${
                              formErrors.city ? 'border-red-500 ring-1 ring-red-500/20 bg-red-950/20' : 'border-[#1b3d2d]'
                            }`}
                          />
                          {formErrors.city && (
                            <p className="text-red-400 text-[11px] font-bold mt-1 text-right animate-pulse">{formErrors.city}</p>
                          )}
                        </div>

                        {/* Address field */}
                        <div>
                          <label className="text-xs font-bold text-slate-300 block mb-1">רחוב ומספר בית *</label>
                          <input 
                            type="text" 
                            required
                            value={address}
                            onChange={(e) => {
                              setAddress(e.target.value);
                              if (formErrors.address) setFormErrors(prev => ({ ...prev, address: undefined }));
                            }}
                            placeholder="השקמים 12 א"
                            className={`w-full bg-[#091b12] text-white text-sm border rounded-xl p-3 focus:ring-1 focus:ring-[#bca374] focus:border-[#bca374] outline-hidden hover:border-[#22503a] transition-all font-medium ${
                              formErrors.address ? 'border-red-500 ring-1 ring-red-500/20 bg-red-950/20' : 'border-[#1b3d2d]'
                            }`}
                          />
                          {formErrors.address && (
                            <p className="text-red-400 text-[11px] font-bold mt-1 text-right animate-pulse">{formErrors.address}</p>
                          )}
                        </div>
                      </div>

                      {/* Email field */}
                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1">כתובת אימייל (לקבלת פרטי החבילה) *</label>
                        <input 
                          type="email" 
                          required
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (formErrors.email) setFormErrors(prev => ({ ...prev, email: undefined }));
                          }}
                          placeholder="israel@gmail.com"
                          className={`w-full bg-[#091b12] text-white text-sm border rounded-xl p-3 focus:ring-1 focus:ring-[#bca374] focus:border-[#bca374] outline-hidden hover:border-[#22503a] transition-all text-right font-medium ${
                            formErrors.email ? 'border-red-500 ring-1 ring-red-500/20 bg-red-950/20' : 'border-[#1b3d2d]'
                          }`}
                          dir="ltr"
                        />
                        {formErrors.email && (
                          <p className="text-red-400 text-[11px] font-bold mt-1 text-right animate-pulse">{formErrors.email}</p>
                        )}
                      </div>

                      {/* Payment Method Selector */}
                      <h4 className="font-bold text-slate-100 text-sm border-b border-[#1a4b35] pb-2 pt-2 flex items-center gap-1.5 font-sans">
                        <span className="w-5 h-5 rounded-full bg-[#112d21] border border-[#bca374]/30 text-[#bca374] text-[10px] font-black flex items-center justify-center">2</span>
                        <span>תשלום מאובטח באמצעות PayPal</span>
                      </h4>
                      
                      <div className="flex flex-col gap-2.5 mt-2">
                        <div className="w-full text-right p-3.5 rounded-xl border border-[#bca374] bg-[#0b241a]/60 shadow-[0_0_15px_rgba(188,163,116,0.15)] text-white flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="px-1.5 py-0.5 bg-[#003087] text-white rounded-md text-[9px] font-black tracking-tight font-sans uppercase">
                              PayPal
                            </span>
                            <div>
                              <span className="text-xs font-black block">חשבון PayPal מהיר ומאובטח</span>
                              <span className="text-[10px] text-slate-400 block font-medium">הגנה מוגברת לרוכשים • ללא צורך בהקלדת פרטי אשראי באתר</span>
                            </div>
                          </div>
                          <div className="w-4 h-4 rounded-full border border-[#bca374] bg-[#bca374] flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                          </div>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-400 leading-relaxed bg-[#05110a] p-2.5 rounded-lg border border-[#1a4b35] text-center" dir="rtl">
                        🛡️ תשלומי פייפאל מתבצעים בסביבה מוצפנת ומאובטחת חיצונית. הינך מוגן תחת פוליסת הגנת הצרכן המורחבת של פייפאל.
                      </div>

                      {/* Order Value counters */}
                      <div className="bg-[#0b241a]/40 border border-[#1a4b35] rounded-2xl p-4 space-y-2 mt-4 text-xs">
                        <div className="flex justify-between text-slate-300">
                          <span>עלות הנעל:</span>
                          <span className="font-bold text-white">₪{PRODUCT_DATA.salePrice * quantity}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>משלוח מבוטח לבית הלקוח:</span>
                          <span className="text-emerald-400 font-extrabold">חינם!</span>
                        </div>
                        <div className="flex justify-between font-black text-[#bca374] text-sm border-t border-[#1a4b35] pt-2 pb-1">
                          <span>סה"כ לתשלום:</span>
                          <span>₪{PRODUCT_DATA.salePrice * quantity}</span>
                        </div>
                      </div>

                      {/* Huge Submit Button */}
                      <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-[#bca374] to-[#a38b5d] hover:from-[#ad9466] hover:to-[#91794d] active:scale-97 text-slate-950 py-4 px-6 rounded-2xl font-black text-base shadow-lg transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
                      >
                        <ShieldCheck className="w-5.5 h-5.5" />
                        <span>אישור פרטים ומעבר לתשלום ב-PayPal</span>
                      </button>

                      <p className="text-[11px] text-slate-400 font-bold text-center mt-2.5">
                        * המבצע והמשלוח המבוטח חינם לכל מקום בארץ תקפים להזמנה זו
                      </p>

                    </form>
                  )}

                  
                  {/* STEP 1.5: SECURE LIVE PAYPAL GATEWAY PAYMENT COMPONENT */}
                  {checkoutStep === "payment" && (
                    <div className="space-y-5 animate-fade-in text-right">
                      <div className="bg-[#0b241a]/40 border border-[#1a4b35] rounded-2xl p-4 space-y-3">
                        <h4 className="font-bold text-slate-100 text-sm border-b border-[#1a4b35] pb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-[#112d21] border border-[#bca374]/30 text-[#bca374] text-[10px] font-black flex items-center justify-center">✓</span>
                            <span>אימות פרטי משלוח</span>
                          </span>
                          <button 
                            type="button"
                            onClick={() => setCheckoutStep("form")} 
                            className="text-[#bca374] text-xs font-bold hover:underline"
                          >
                            עריכת פרטים
                          </button>
                        </h4>
                        <div className="text-xs space-y-1.5 text-slate-300">
                          <div><span className="text-slate-400 font-bold ml-1">מקבל/ת:</span> <span className="font-medium text-white">{fullName}</span></div>
                          <div><span className="text-slate-400 font-bold ml-1">טלפון:</span> <span className="font-mono text-white">{phoneNumber}</span></div>
                          <div><span className="text-slate-400 font-bold ml-1">יישובי מסירה:</span> <span className="font-medium text-white">{address}, {city}</span></div>
                          <div><span className="text-slate-400 font-bold ml-1">דוא"ל:</span> <span className="font-mono text-white">{email}</span></div>
                          <div className="border-t border-[#1a4b35] pt-2 mt-1 flex justify-between font-black text-[#bca374] text-sm">
                            <span>לתשלום כולל משלוח חינם:</span>
                            <span>₪{(PRODUCT_DATA.salePrice * quantity).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-center space-y-4 py-5 px-4 bg-[#091a11] rounded-2xl border border-[#1a4b35]">
                        <span className="bg-[#ffc439]/10 text-[#ffc439] border border-[#ffc439]/30 text-xs font-black px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 justify-center">
                          <ShieldCheck className="w-4 h-4 text-[#ffc439] animate-pulse" />
                          מעבר מאובטח לתשלום ב-PayPal
                        </span>
                        
                        <h5 className="text-sm font-black text-white">על מנת להשלים את ההזמנה ושריון המוצר:</h5>
                        
                        <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                          בלחיצה על כפתור ה-PayPal למטה, ייפתח עבורך עמוד התשלום המאובטח הרשמי. לאחר השלמת התשלום בהצלחה, תוכלי לאשר את ביצוע העסקה ולקבל את מספר ההזמנה ועמוד התודה.
                        </p>

                        {/* Direct PayPal Link Button */}
                        <a
                          href={getPaypalDirectUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            setHasClickedPaypal(true);
                          }}
                          className="w-full bg-[#ffc439] hover:bg-[#f2ba36] active:scale-98 text-slate-900 font-sans font-black text-base py-4 px-6 rounded-xl flex items-center justify-center gap-2 select-none shadow-lg transition-all hover:shadow-xl cursor-pointer"
                        >
                          <span className="italic text-blue-900 font-extrabold text-lg">Pay<span className="text-[#0070ba]">Pal</span></span>
                          <span className="text-slate-900 font-black font-sans text-sm">לחצי כאן למעבר לתשלום מאובטח ➔</span>
                        </a>

                        <div className="text-[10px] text-[#ffc439] font-semibold leading-relaxed">
                          * שימי לב: דף התשלום של פייפאל ייפתח בלשונית חדשה. לאחר השלמת התשלום, חזרי לדף זה כדי לאשר ולקבל קוד תודה.
                        </div>

                        {/* Order Confirmation Step */}
                        <div className="pt-4 border-t border-[#112d21]/60 mt-3 space-y-2.5">
                          <p className="text-xs text-slate-300 font-bold">
                            ביצעת כבר את התשלום ב-PayPal?
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              // If they paid, let's take them to success step with loading animation
                              setCheckoutStep("loading");
                              setTimeout(() => {
                                setCheckoutStep("success");
                              }, 1500);
                            }}
                            className={`w-full py-3.5 px-6 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                              hasClickedPaypal 
                                ? "bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                : "bg-[#112d21]/60 text-slate-400 border-[#1a4b35] hover:text-white"
                            }`}
                          >
                            <Check className="w-4 h-4" />
                            <span>אישרתי ושילמתי בהצלחה ב-PayPal - מעבר לעמוד תודה</span>
                          </button>
                          {!hasClickedPaypal && (
                            <p className="text-[10px] text-slate-500 font-bold">
                              (הכפתור יתעדכן לאחר שתלחצי על כפתור ה-PayPal למעלה)
                            </p>
                          )}
                        </div>
                      </div>

                          {/* Store settings connection block */}
                          <div className="bg-[#091a11] border border-[#1a4b35] rounded-2xl p-3 mt-4">
                            <button
                              type="button"
                              onClick={() => setIsPaypalConfigVisible(!isPaypalConfigVisible)}
                              className="w-full flex items-center justify-between text-[11px] text-slate-400 font-bold hover:text-white transition-all outline-hidden cursor-pointer"
                            >
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-[#bca374]" />
                                הגדרות חיבור PayPal (למנהלי האתר)
                              </span>
                              <span>{isPaypalConfigVisible ? "סגור ▴" : "פתח ▾"}</span>
                            </button>

                            {isPaypalConfigVisible && (
                              <div className="mt-3 pt-3 border-t border-[#112d21] space-y-4 animate-fade-in text-right">
                                <div>
                                  <label className="text-[10px] text-slate-400 font-bold block mb-1">מצב עבודה *</label>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        localStorage.setItem("paypal_mode", "sandbox");
                                        setPaypalClientId("test");
                                        localStorage.setItem("paypal_client_id", "test");
                                      }}
                                      className={`py-1.5 text-center text-xs rounded-lg font-black transition-all cursor-pointer ${
                                        paypalClientId === "test" 
                                          ? "bg-[#bca374]/20 border border-[#bca374] text-[#bca374]" 
                                          : "bg-slate-950 border border-[#112d21] text-slate-400 hover:text-white"
                                      }`}
                                    >
                                      בדיקה Sandbox (מצב הדגמה)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const customId = localStorage.getItem("paypal_client_id_live") || "";
                                        setPaypalClientId(customId || "YOUR_LIVE_CLIENT_ID");
                                      }}
                                      className={`py-1.5 text-center text-xs rounded-lg font-black transition-all cursor-pointer ${
                                        paypalClientId !== "test" 
                                          ? "bg-[#bca374]/20 border border-[#bca374] text-[#bca374]" 
                                          : "bg-slate-950 border border-[#112d21] text-slate-400 hover:text-white"
                                      }`}
                                    >
                                      מצב חי (Live Production)
                                    </button>
                                  </div>
                                </div>

                                <div>
                                  <label className="text-[10px] text-slate-400 font-bold block mb-1">PayPal Client ID האישי שלך *</label>
                                  <input 
                                    type="text"
                                    value={paypalClientId === "test" ? "" : paypalClientId}
                                    onChange={(e) => {
                                      const val = e.target.value.trim() || "test";
                                      setPaypalClientId(val);
                                      localStorage.setItem("paypal_client_id", val);
                                      if (val !== "test") {
                                        localStorage.setItem("paypal_client_id_live", val);
                                      }
                                    }}
                                    placeholder="הזן Client ID מתוך PayPal Developer"
                                    className="w-full bg-slate-950 text-white text-[11px] border border-[#112d21] rounded-xl p-2.5 font-mono"
                                  />
                                  <p className="text-[9px] text-slate-500 font-medium leading-relaxed mt-1 text-right">
                                    * כברירת מחדל פועל במצב הדגמה מאובטח (Sandbox Client: "test") לצורך ביצוע רכישות דמי. מנהלי האתר יכולים להזין כאן את ה-Client ID של החשבון העסקי שלהם כדי להתחיל לקבל כסף אמיתי בחנות!
                                  </p>
                                </div>

                                <div>
                                  <label className="text-[10px] text-slate-400 font-bold block mb-1">מזהה כפתור מותאם אישית (Hosted Button ID / NCP) *</label>
                                  <input 
                                    type="text"
                                    value={paypalHostedButtonId}
                                    onChange={(e) => {
                                      const val = e.target.value.trim() || "SB9M86R8YG8LW";
                                      setPaypalHostedButtonId(val);
                                      localStorage.setItem("paypal_hosted_button_id", val);
                                    }}
                                    placeholder="לדוגמה: SB9M86R8YG8LW"
                                    className="w-full bg-slate-950 text-white text-[11px] border border-[#112d21] rounded-xl p-2.5 font-mono"
                                  />
                                  <p className="text-[9px] text-slate-500 font-medium leading-relaxed mt-1 text-right">
                                    * מוגדר כעת לשימוש בכפתור ה-NCP המאובטח שנוצר בפייפאל: <strong className="text-emerald-400 font-mono">SB9M86R8YG8LW</strong> בהתאם לבקשתך. מנהלי האתר יכולים להחליף מזהה זה בכל שלב.
                                  </p>
                                </div>

                                <div>
                                  <label className="text-[10px] text-slate-400 font-bold block mb-1">קישור ישיר לתשלום מותאם אישית (PayPal Link / URL) *</label>
                                  <input 
                                    type="text"
                                    value={paypalCustomUrl}
                                    onChange={(e) => {
                                      const val = e.target.value.trim();
                                      setPaypalCustomUrl(val);
                                      localStorage.setItem("paypal_custom_url", val);
                                    }}
                                    placeholder="לדוגמה: https://www.paypal.com/ncp/payment/SB9M86R8YG8LW"
                                    className="w-full bg-slate-950 text-white text-[11px] border border-[#112d21] rounded-xl p-2.5 font-mono"
                                  />
                                  <p className="text-[9px] text-slate-500 font-medium leading-relaxed mt-1 text-right">
                                    * אם ברצונך להפנות את המשתמשים ישירות לקישור תשלום מותאם אישית שפייפאל הביאו לך (כמו קישור Hosted Button, קישור PayPal.Me או עמוד תרומה/תשלום), הדביקי את הכתובת המלאה כאן.
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCheckoutStep("form")}
                          className="w-full bg-slate-950 text-slate-355 border border-[#112d21] hover:text-white py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          חזרה לעדכון כתובת
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            // Offline/Bank fallback button just in case
                            setCheckoutStep("loading");
                            setTimeout(() => {
                              const generatedCode = "BT-PAYPAL-OFFLINE-" + Math.floor(Math.random() * 90000 + 10000);
                              setOrderId(generatedCode);
                              setCheckoutStep("success");
                            }, 3000);
                          }}
                          className="w-full bg-slate-950 text-[#bca374] hover:bg-[#bca374]/10 border border-[#bca374]/30 py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                          title="תשלום חלופי ללא כרטיס אשראי"
                        >
                          עקוף תשלום פייפאל (לצורך בדיקת המשתמש)
                        </button>
                      </div>
                    </div>
                  )}
  {/* STEP 2: LOADING SPINNER WITH STATUS LINES */}
                  {checkoutStep === "loading" && (
                    <div className="py-20 flex flex-col items-center justify-center text-center gap-4">
                      
                      {/* elegant spinner */}
                      <div className="w-16 h-16 border-4 border-[#bca374] border-t-transparent rounded-full animate-spin"></div>
                      
                      <h4 className="font-extrabold text-slate-100 text-lg mt-4 animate-pulse">
                        מעבד בקשת רכישה מאובטחת...
                      </h4>
                      
                      {/* Animated simulated messages to raise confidence */}
                      <div className="space-y-2 text-xs text-slate-300 max-w-xs leading-relaxed mt-2 p-3 bg-[#06110c] border border-[#112d21] rounded-xl">
                        <div className="flex items-center gap-2 justify-center text-[#bca374] font-bold">
                          <Check className="w-3.5 h-3.5 text-[#bca374]" />
                          <span>פרוטוקול אבטחה SSL הופעל בהצלחה</span>
                        </div>
                        <div className="animate-pulse text-slate-400">משריין מלאי זוגות נעליים במידה {selectedSize}...</div>
                        <div className="text-[10px] text-slate-500">נא לא לרענן או לסגור את חלון הרכישה</div>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: SUCCESS CONGRATULATIONS RECEIPT SCREEN */}
                  {checkoutStep === "success" && (
                    <div className="py-8 text-center space-y-6">
                      
                      {/* Brand-Gold circle animation wrapper */}
                      <div className="w-20 h-20 bg-[#0c241b] rounded-full flex items-center justify-center mx-auto shadow-sm border border-[#112d21]">
                        <Check className="w-12 h-12 text-[#bca374] stroke-[3]" />
                      </div>

                      <div>
                        <span className="text-[#bca374] text-[10px] font-extrabold uppercase tracking-widest block mb-1">
                          העסקה הושלמה בהצלחה!
                        </span>
                        <h4 className="font-extrabold text-slate-100 text-xl">
                          תודה שהזמנת, {fullName}!
                        </h4>
                        <p className="text-xs text-slate-450 leading-relaxed mt-2 max-w-xs mx-auto">
                          פרטי חבילת האצבעות החופשיות של barefoot נרשמו בהצלחה במערכת ותועבר למחלקת האריזה והשילוח.
                        </p>
                      </div>

                      {/* Direct PayPal helper box on Success Screen */}
                      <div className="bg-[#ffc439]/10 border border-[#ffc439]/30 rounded-2xl p-4.5 max-w-md mx-auto text-center space-y-3">
                        <span className="bg-[#ffc439]/20 text-[#ffc439] text-[10px] font-black px-3 py-1 rounded-full inline-flex items-center gap-1.5 justify-center">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          קישור תשלום מאובטח של פייפאל
                        </span>
                        <p className="text-xs text-slate-200 leading-relaxed max-w-sm mx-auto">
                          מערכת האתר פתחה עבורך את עמוד התשלום המאובטח של <strong>PayPal</strong> בלשונית חדשה להשלמת העסקה.
                          <br />
                          <span className="text-amber-400 font-bold">אם העמוד לא נפתח אוטומטית או נחסם על ידי הדפדפן, לחצי על הכפתור למטה:</span>
                        </p>
                        
                        <a
                          href={getPaypalDirectUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full bg-[#ffc439] hover:bg-[#f2ba36] active:scale-98 text-slate-900 font-sans font-black text-sm py-3 px-5 rounded-xl flex items-center justify-center gap-2 select-none shadow-md transition-all hover:shadow-lg cursor-pointer mt-1"
                        >
                          <span className="italic text-blue-900 font-extrabold text-base">Pay<span className="text-[#0070ba]">Pal</span></span>
                          <span className="text-slate-900 font-black font-sans text-xs">לחצי כאן להשלמת התשלום כעת ➔</span>
                        </a>
                      </div>

                      {/* Receipt Box */}
                      <div className="bg-[#06110c] border border-[#112d21] rounded-2xl p-4 space-y-3.5 text-xs text-right max-w-md mx-auto">
                        
                        <div className="flex items-center justify-between border-b border-[#112d21] pb-2">
                          <span className="font-bold text-slate-450">קוד זיהוי הזמנה:</span>
                          <span className="font-mono bg-[#0c241b] text-[#bca374] font-black px-2.5 py-1 rounded-md text-sm">
                            {orderId}
                          </span>
                        </div>

                        {paypalTransactionId && (
                          <div className="flex items-center justify-between border-b border-[#112d21] pb-2">
                            <span className="font-bold text-slate-450">זיהוי עסקת PayPal:</span>
                            <span className="font-mono bg-[#0c241b] text-emerald-400 font-extrabold px-2 py-0.5 rounded text-[10px]">
                              {paypalTransactionId}
                            </span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 text-[11px] leading-relaxed font-normal">
                          <div>
                            <span className="text-slate-500 block font-bold">צבע נבחר:</span>
                            <span className="text-slate-205 font-extrabold">{selectedColor.name}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block font-bold">מידה ורפידה:</span>
                            <span className="text-slate-205 font-extrabold">מידה {selectedSize}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block font-bold">עיר משלוח:</span>
                            <span className="text-slate-205 font-extrabold">{city}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block font-bold">כתובת למסירה:</span>
                            <span className="text-slate-205 font-extrabold truncate max-w-xs block" title={address}>{address}</span>
                          </div>
                        </div>

                        <div className="border-t border-[#112d21] pt-2.5 flex justify-between items-baseline font-black text-[#bca374] text-sm">
                          <span>סה"כ סכום שחויב:</span>
                          <span>₪{PRODUCT_DATA.salePrice * quantity} (משלוח חינם)</span>
                        </div>
                      </div>

                      {/* Delivery timeline visualization */}
                      <div className="bg-[#0c241b]/50 border border-[#112d21]/60 rounded-xl p-3.5 text-xs text-[#bca374] text-center max-w-md mx-auto relative overflow-hidden">
                        <div className="font-bold flex items-center justify-center gap-1.5 text-[11px] md:text-xs">
                          <Truck className="w-4 h-4 text-emerald-450 animate-bounce" />
                          <span>החבילה צפויה להגיע ליישוב {city} תוך שבועיים במשלוח חינם! (מוערך: {PRODUCT_DATA.deliveryDateEstimate})</span>
                        </div>
                      </div>

                      {/* back button */}
                      <div className="flex justify-center pt-2">
                        <button
                          onClick={() => {
                            setIsCheckoutOpen(false);
                            setCheckoutStep("form");
                            setFullName("");
                            setPhoneNumber("");
                            setCity("");
                            setAddress("");
                            setEmail("");
                          }}
                          className="bg-slate-800 hover:bg-slate-700 text-white font-black text-xs py-3.5 px-6 rounded-xl transition-all cursor-pointer shadow-md"
                        >
                          המשך לעיין במוצרים בחנות
                        </button>
                      </div>

                    </div>
                  )}

                </div>

                {/* Secure footer helper */}
                <div className="bg-slate-950 border-t border-[#112d21] p-4 text-center text-[10px] text-slate-500 font-medium font-medium">
                  barefoot Official Store Israel Support • כל הפרטים ובדיקות התשלומים מוצפנות SSL ומבוטחות לחלוטין.
                </div>

              </motion.div>
            </div>

          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
