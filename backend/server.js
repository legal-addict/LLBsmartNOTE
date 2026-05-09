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

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

// =========================
// ENV VALIDATION
// =========================

if (
  !process.env.RAZORPAY_KEY_ID ||
  !process.env.RAZORPAY_KEY_SECRET
) {
  console.error("❌ Missing Razorpay env variables");
  process.exit(1);
}

if (
  !process.env.FIREBASE_PROJECT_ID ||
  !process.env.FIREBASE_CLIENT_EMAIL ||
  !process.env.FIREBASE_PRIVATE_KEY
) {
  console.error("❌ Missing Firebase env variables");
  process.exit(1);
}

// =========================
// FIREBASE INIT
// =========================

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  }),
  databaseURL:
    "https://legal-addict-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.database();

// =========================
// FILE MAP
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
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// =========================
// HELPERS
// =========================

function isValidString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

// =========================
// CREATE ORDER (FIXED)
// =========================

app.post("/create-order", async (req, res) => {
  try {
    const price = Number(req.body.amount);

    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid amount"
      });
    }

    // 🔥 FIX: convert rupees → paise
    const amount = Math.round(price * 100);

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: "receipt_" + Date.now()
    });

    res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      order
    });

  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({
      success: false,
      error: "Order creation failed"
    });
  }
});

// =========================
// VERIFY PAYMENT (FIXED)
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

    const cleanNote = noteName.trim();

    if (!validNotes.includes(cleanNote)) {
      return res.status(400).json({
        success: false,
        error: "Invalid note"
      });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: "Invalid signature"
      });
    }

    // 🔥 FIX: atomic write (no race condition)
    await db.ref(`purchases/${userId}/${cleanNote}`).set({
      purchased: true,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      purchasedAt: Date.now()
    });

    res.json({ success: true });

  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({
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
      .ref(`purchases/${userId}/${noteName.trim()}`)
      .once("value");

    res.json({ purchased: snap.exists() });

  } catch (err) {
    console.error(err);
    res.json({ purchased: false });
  }
});

// =========================
// NOTES ACCESS
// =========================

app.get("/notes", async (req, res) => {
  try {
    const userId = req.query.userId;
    const noteName = decodeURIComponent(String(req.query.noteName || "").trim());

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

    const filePath = path.join(
      __dirname,
      "..",
      "FIRST_Y_SEM_1",
      fileMap[noteName]
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).send("File missing");
    }

    res.sendFile(filePath);

  } catch (err) {
    console.error("Notes error:", err);
    res.status(500).send("Server error");
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
