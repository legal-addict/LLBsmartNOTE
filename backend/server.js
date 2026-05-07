require("dotenv").config();

const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

// =========================
// MIDDLEWARE
// =========================

app.use(cors({ origin: "*" }));
app.use(express.json());

// =========================
// PURCHASE STORAGE
// =========================

const filePath = path.join(__dirname, "purchases.json");

let purchases = {};

// =========================
// LOAD DATA
// =========================

try {
  if (fs.existsSync(filePath)) {
    purchases = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } else {
    fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
  }
} catch (err) {
  console.log("Load error:", err);
  purchases = {};
}

// =========================
// SAVE DATA
// =========================

function savePurchases() {
  try {
    fs.writeFileSync(filePath, JSON.stringify(purchases, null, 2));
  } catch (err) {
    console.log("Save error:", err);
  }
}

// =========================
// RAZORPAY
// =========================

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// =========================
// CREATE ORDER
// =========================

app.post("/create-order", async (req, res) => {
  try {
    const amount = Number(req.body.amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid amount"
      });
    }

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: "receipt_" + Date.now()
    });

    return res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      order
    });

  } catch (err) {
    console.log("Create order error:", err);
    return res.status(500).json({
      success: false,
      error: "Order creation failed"
    });
  }
});

// =========================
// VERIFY PAYMENT (FIXED)
// =========================

app.post("/verify-payment", (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId,
      noteName
    } = req.body;

    // VALIDATION
    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !userId ||
      !noteName
    ) {
      return res.json({ success: false });
    }

    // VERIFY SIGNATURE
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.json({ success: false });
    }

    // INIT USER STRUCTURE
    if (!purchases[userId]) {
      purchases[userId] = {
        notes: [],
        payments: []
      };
    }

    // PREVENT DOUBLE PAYMENT PROCESSING
    if (purchases[userId].payments.includes(razorpay_payment_id)) {
      return res.json({
        success: true,
        alreadyProcessed: true
      });
    }

    // SAVE PAYMENT ID
    purchases[userId].payments.push(razorpay_payment_id);

    // SAVE NOTE ACCESS (FOREVER ACCESS)
    if (!purchases[userId].notes.includes(noteName)) {
      purchases[userId].notes.push(noteName);
    }

    savePurchases();

    return res.json({ success: true });

  } catch (err) {
    console.log("Verify error:", err);
    return res.json({ success: false });
  }
});

// =========================
// CHECK PURCHASE
// =========================

app.get("/check-purchase", (req, res) => {
  const { userId, noteName } = req.query;

  if (!userId || !noteName) {
    return res.json({ purchased: false });
  }

  const user = purchases[userId];

  if (!user) {
    return res.json({ purchased: false });
  }

  return res.json({
    purchased: user.notes?.includes(noteName) || false
  });
});

// =========================
// NOTES ACCESS
// =========================

app.get("/notes", (req, res) => {
  try {
    const userId = req.query.userId;
    const noteName = decodeURIComponent(req.query.noteName || "");

    if (!userId || !noteName) {
      return res.status(400).send("Missing data");
    }

    const user = purchases[userId];

    if (!user || !user.notes.includes(noteName)) {
      return res.status(403).send("❌ Access denied");
    }

    const fileMap = {
      "English I": "English_I.html",
      "Economics": "Economics.html",
      "LOGIC - I": "LOGIC - I.html"
    };

    const fileName = fileMap[noteName];

    if (!fileName) {
      return res.status(404).send("Invalid note");
    }

    const fullPath = path.join(
      __dirname,
      "..",
      "FIRST_Y_SEM_1",
      fileName
    );

    if (!fs.existsSync(fullPath)) {
      return res.status(404).send("File missing");
    }

    return res.sendFile(fullPath);

  } catch (err) {
    console.log("Notes error:", err);
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
  console.log("Server running on port", PORT);
});
