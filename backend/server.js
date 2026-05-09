require("dotenv").config();

const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");

const app = express();

// =========================
// FIREBASE
// =========================

const serviceAccount = require("./firebase-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:
    "https://legal-addict-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.database();

// =========================
// MIDDLEWARE
// =========================

app.use(
  cors({
    origin: "*"
  })
);

app.use(express.json());

// =========================
// VALID NOTES
// =========================

const fileMap = {
  "English I": "English_I.html",
  "Economics": "Economics.html",
  "LOGIC - I": "LOGIC - I.html"
};

const validNotes = Object.keys(fileMap);

// =========================
// RAZORPAY
// =========================

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// =========================
// HELPERS
// =========================

function isValidString(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

// =========================
// CREATE ORDER
// =========================

app.post("/create-order", async (req, res) => {
  try {

    const amount = Number(req.body.amount);

    // =========================
    // VALIDATION
    // =========================

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid amount"
      });
    }

    // =========================
    // CREATE ORDER
    // =========================

    const order = await razorpay.orders.create({
      amount: Math.round(amount),
      currency: "INR",
      receipt:
        "receipt_" + Date.now()
    });

    return res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      order
    });

  } catch (err) {

    console.log(
      "Create order error:",
      err
    );

    return res.status(500).json({
      success: false,
      error: "Order creation failed"
    });
  }
});

// =========================
// VERIFY PAYMENT
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

    // =========================
    // VALIDATION
    // =========================

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

    if (
      !validNotes.includes(noteName)
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid note"
      });
    }

    // =========================
    // VERIFY SIGNATURE
    // =========================

    const generatedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest("hex");

    if (
      generatedSignature !==
      razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid signature"
      });
    }

    // =========================
    // PREVENT DUPLICATE ENTRY
    // =========================

    const purchaseRef = db.ref(
      `purchases/${userId}/${noteName}`
    );

    const snapshot =
      await purchaseRef.once("value");

    if (!snapshot.exists()) {

      await purchaseRef.set({
        purchased: true,
        paymentId:
          razorpay_payment_id,
        orderId:
          razorpay_order_id,
        noteName,
        purchasedAt:
          admin.database.ServerValue.TIMESTAMP
      });
    }

    return res.json({
      success: true
    });

  } catch (err) {

    console.log(
      "Verify payment error:",
      err
    );

    return res.status(500).json({
      success: false,
      error: "Verification failed"
    });
  }
});

// =========================
// CHECK PURCHASE
// =========================

app.get(
  "/check-purchase",
  async (req, res) => {

    try {

      const { userId, noteName } =
        req.query;

      // =========================
      // VALIDATION
      // =========================

      if (
        !isValidString(userId) ||
        !isValidString(noteName)
      ) {
        return res.json({
          purchased: false
        });
      }

      // =========================
      // CHECK DATABASE
      // =========================

      const snapshot = await db
        .ref(
          `purchases/${userId}/${noteName}`
        )
        .once("value");

      return res.json({
        purchased: snapshot.exists()
      });

    } catch (err) {

      console.log(
        "Check purchase error:",
        err
      );

      return res.status(500).json({
        purchased: false
      });
    }
  }
);

// =========================
// NOTES ACCESS
// =========================

app.get("/notes", async (req, res) => {

  try {

    const userId =
      req.query.userId;

    const noteName =
      decodeURIComponent(
        req.query.noteName || ""
      );

    // =========================
    // VALIDATION
    // =========================

    if (
      !isValidString(userId) ||
      !isValidString(noteName)
    ) {
      return res
        .status(400)
        .send("Missing data");
    }

    if (
      !validNotes.includes(noteName)
    ) {
      return res
        .status(404)
        .send("Invalid note");
    }

    // =========================
    // CHECK PURCHASE
    // =========================

    const snapshot = await db
      .ref(
        `purchases/${userId}/${noteName}`
      )
      .once("value");

    if (!snapshot.exists()) {
      return res
        .status(403)
        .send("❌ Access denied");
    }

    // =========================
    // FILE PATH
    // =========================

    const fileName =
      fileMap[noteName];

    const fullPath = path.join(
      __dirname,
      "..",
      "FIRST_Y_SEM_1",
      fileName
    );

    // =========================
    // FILE EXISTS?
    // =========================

    if (
      !fs.existsSync(fullPath)
    ) {
      return res
        .status(404)
        .send("File missing");
    }

    // =========================
    // SEND FILE
    // =========================

    return res.sendFile(fullPath);

  } catch (err) {

    console.log(
      "Notes access error:",
      err
    );

    return res
      .status(500)
      .send("Server error");
  }
});

// =========================
// ROOT
// =========================

app.get("/", (req, res) => {
  res.send("Backend running ✅");
});

// =========================
// 404
// =========================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found"
  });
});

// =========================
// START SERVER
// =========================

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    `Server running on port ${PORT}`
  );
});
