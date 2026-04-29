require("dotenv").config();

const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

// =========================
// LOAD PURCHASES
// =========================
let purchases = [];

if (fs.existsSync("purchases.json")) {
  purchases = JSON.parse(fs.readFileSync("purchases.json"));
}

// =========================
// NOTE FILES
// =========================
const noteFiles = {
  "English I": "FIRST_Y_SEM_1/English_I.html",
  "Economics": "FIRST_Y_SEM_1/Economics.html"
};

// =========================
// MIDDLEWARE
// =========================
app.use(cors({
  origin: "https://legal-addict.github.io",
  methods: ["GET", "POST"]
}));

app.use(express.json());

// =========================
// HOME
// =========================
app.get("/", (req, res) => {
  res.send("Backend running ✅");
});

// =========================
// RAZORPAY
// =========================
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// =========================
// CREATE ORDER
// =========================
app.post("/create-order", async (req, res) => {
  try {
    const amount = Number(req.body.amount);

    if (!amount || amount < 100) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    });

    res.json({
      key: process.env.RAZORPAY_KEY_ID,
      order
    });

  } catch (err) {
    res.status(500).json({ error: "Order creation failed" });
  }
});

// =========================
// VERIFY PAYMENT
// =========================
app.post("/verify-payment", (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      noteName,
      email
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.json({ success: false });
    }

    // Save purchase
    const exists = purchases.find(
      p => p.email === email && p.noteName === noteName
    );

    if (!exists) {
      purchases.push({ email, noteName });
      fs.writeFileSync("purchases.json", JSON.stringify(purchases, null, 2));
    }

    const fileName = noteFiles[noteName];

    return res.json({
      success: true,
      url: `https://backend-kxr2.onrender.com/notes/${fileName}?email=${encodeURIComponent(email)}&noteName=${encodeURIComponent(noteName)}`
    });

  } catch (err) {
    res.json({ success: false });
  }
});

// =========================
// CHECK PURCHASE
// =========================
app.get("/check-purchase", (req, res) => {
  const { email, noteName } = req.query;

  const found = purchases.find(
    p => p.email === email && p.noteName === noteName
  );

  if (found) {
    const fileName = noteFiles[noteName];

    return res.json({
      purchased: true,
      url: `https://backend-kxr2.onrender.com/notes/${fileName}?email=${encodeURIComponent(email)}&noteName=${encodeURIComponent(noteName)}`
    });
  }

  res.json({ purchased: false });
});

// =========================
// SERVE NOTES
// =========================
app.get("/notes/*", (req, res) => {
  try {
    const { email, noteName } = req.query;

    if (!email || !noteName) {
      return res.status(400).send("Missing data");
    }

    const fileName = noteFiles[noteName];
    if (!fileName) {
      return res.status(404).send("Invalid note");
    }

    const found = purchases.find(
      p => p.email === email && p.noteName === noteName
    );

    if (!found) {
      return res.status(403).send("❌ Please purchase this note");
    }

    const fullPath = path.join(__dirname, "..", fileName);

    return res.sendFile(fullPath);

  } catch (err) {
    res.status(500).send("Server error");
  }
});

// =========================
// START
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
