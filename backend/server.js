require("dotenv").config();

const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");

// =========================
// CRASH HANDLERS
// =========================

process.on("uncaughtException", err => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", err => {
  console.error("UNHANDLED REJECTION:", err);
});

// =========================
// APP INIT
// =========================

const app = express();

// =========================
// MIDDLEWARE
// =========================

app.use(express.json());

// ⚠️ Production: replace "*" with your frontend URL
app.use(cors({ origin: "*" }));

// =========================
// ENV CHECK
// =========================

const {
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY
} = process.env;

if (
  !RAZORPAY_KEY_ID ||
  !RAZORPAY_KEY_SECRET ||
  !FIREBASE_PROJECT_ID ||
  !FIREBASE_CLIENT_EMAIL ||
  !FIREBASE_PRIVATE_KEY
) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

// =========================
// FIREBASE INIT
// =========================

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  }),
  databaseURL:
    "https://legal-addict-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.database();

// =========================
// FILE WHITELIST
// =========================

const fileMap = {
  "English I": "English_I.html",
  "Economics": "Economics.html",
  "LOGIC - I": "LOGIC - I.html"
};

const validNotes = Object.keys(fileMap);

// =========================
// RAZORPAY INIT
// =========================

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET
});

// =========================
// HELPERS
// =========================

function isValidString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

// =========================
// CREATE ORDER (FIXED: PAISE)
// =========================

app.post("/create-order", async (req, res) => {
  try {
    const amount = Number(req.body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid amount"
      });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // ✅ FIXED (PAISE)
      currency: "INR",
      receipt: "receipt_" + Date.now()
    });

    return res.json({
      success: true,
      key: RAZORPAY_KEY_ID,
      order
    });

  } catch (err) {
    console.error("Create order error:", err);
    return res.status(500).json({
      success: false,
      error: "Order creation failed"
    });
  }
});

// =========================
// VERIFY PAYMENT (FIXED LOGIC)
// =========================

app.post("/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId,
      noteName
    } = req.body;

    if (
      !isValidString(razorpay_order_id) ||
      !isValidString(razorpay_payment_id) ||
      !isValidString(razorpay_signature) ||
      !isValidString(userId) ||
      !isValidString(noteName)
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing fields"
      });
    }

    if (!validNotes.includes(noteName)) {
      return res.status(400).json({
        success: false,
        error: "Invalid note"
      });
    }

    // =========================
    // SIGNATURE VERIFY
    // =========================

    const generatedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: "Invalid signature"
      });
    }

    // =========================
 // =========================
// PREVENT DUPLICATE PAYMENT
// =========================
const result = await paymentRef.transaction(current => {
  if (current === null) {
    return {
      userId,
      noteName,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      createdAt: Date.now()
    };
  }

  return; // already processed
});

if (!result.committed) {
  return res.status(400).json({
    success: false,
    error: "Payment already processed"
  });
}

// =========================
// SAVE PURCHASE
// =========================

await db
  .ref(`purchases/${userId}/${noteName}`)
  .set({
    purchased: true,
    paymentId: razorpay_payment_id,
    orderId: razorpay_order_id,
    noteName,
    purchasedAt: Date.now()
  });
    
// Save purchase
    const paymentRef = db.ref(`payments/${razorpay_payment_id}`);

if (existing.exists()) {
  return res.status(400).json({
    success: false,
    error: "Payment already processed"
  });
}
    const paymentRef = db.ref(`payments/${razorpay_payment_id}`);

const result = await paymentRef.transaction(current => {
  if (current === null) {
    return {
      userId,
      noteName,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      createdAt: Date.now()
    };
  }

  return; // abort
});

if (!result.committed) {
  return res.status(400).json({
    success: false,
    error: "Payment already processed"
  });
}
    return res.json({ success: true });

  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).json({
      success: false,
      error: "Verification failed"
    });
  }
});

// =========================
// CHECK PURCHASE
// =========================

app.get("/check-purchase", async (req, res) => {
  try {
    const { userId, noteName } = req.query;

    if (!isValidString(userId) || !isValidString(noteName)) {
      return res.json({ purchased: false });
    }

    const snap = await db
      .ref(`purchases/${userId}/${noteName}`)
      .once("value");

    return res.json({ purchased: snap.exists() });

  } catch (err) {
    console.error(err);
    return res.json({ purchased: false });
  }
});

// =========================
// NOTES ACCESS (SECURE FILE SERVER)
// =========================

app.get("/notes", async (req, res) => {
  try {
    const userId = req.query.userId;
    const noteName = decodeURIComponent(req.query.noteName || "");

    if (!isValidString(userId) || !isValidString(noteName)) {
      return res.status(400).send("Missing data");
    }

    if (!validNotes.includes(noteName)) {
      return res.status(404).send("Invalid note");
    }

    const snap = await db
      .ref(`purchases/${userId}/${noteName}`)
      .once("value");

    if (!snap.exists()) {
      return res.status(403).send("❌ Access denied");
    }

    const fileName = fileMap[noteName];

    const filePath = path.resolve(
      __dirname,
      "..",
      "FIRST_Y_SEM_1",
      fileName
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).send("File missing");
    }

    return res.sendFile(filePath);

  } catch (err) {
    console.error("Notes error:", err);
    return res.status(500).send("Server error");
  }
});

// =========================
// ROOT
// =========================

app.get("/", (req, res) => {
  res.send("Backend running ✅");
});

// =========================
// START SERVER
// =========================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
