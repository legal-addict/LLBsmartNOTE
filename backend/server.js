// TEMP storage (replace with DB later)
const purchases = [];
require("dotenv").config();

const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const cors = require("cors");
const path = require("path");

const app = express();

// CORS (Allow GitHub frontend)
app.use(cors({
  origin: "https://legal-addict.github.io",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
}));

app.use(express.json());

// ✅ Serve notes folder publicly
app.use("/notes", express.static(path.join(__dirname, "notes")));

app.get("/", (req, res) => {
  res.send("Backend running");
});

// Razorpay instance
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
      order,
    });

  } catch (err) {
    console.error("Create order error:", err);
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
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature === razorpay_signature) app.post("/verify-payment", (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      noteName,
      userId // 👈 MUST come from frontend
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature === razorpay_signature) {

      // ✅ SAVE PURCHASE
      purchases.push({
        userId,
        noteName
      });

      return res.json({
        success: true,
        url: `/notes/${noteName}.html`,
      });

    } else {
      return res.status(400).json({ success: false });
    }

  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ success: false });
  }
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
