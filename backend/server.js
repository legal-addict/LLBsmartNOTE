require("dotenv").config();

const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const cors = require("cors");
const path = require("path");

const app = express();

// =========================
// TEMP STORAGE (replace with DB later)
// =========================
const purchases = [];

// =========================
// MIDDLEWARE
// =========================
app.use(cors({
  origin: "https://legal-addict.github.io",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
}));

app.use(express.json());

// =========================
// BASIC ROUTE
// =========================
app.get("/", (req, res) => {
  res.send("Backend running ✅");
});

// =========================
// RAZORPAY SETUP
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
      order,
    });

  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Order creation failed" });
  }
});

// =========================
// VERIFY PAYMENT + SAVE PURCHASE
// =========================
app.post("/verify-payment", (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      noteName,
      userId
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature === razorpay_signature) {

      // ✅ SAVE PURCHASE (avoid duplicate)
      const alreadyBought = purchases.find(
        (p) => p.userId === userId && p.noteName === noteName
      );

      if (!alreadyBought) {
        purchases.push({ userId, noteName });
      }

      return res.json({
        success: true,
        url: `/notes/${noteName}.html?userId=${userId}`
      });

    } else {
      return res.status(400).json({ success: false });
    }

  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ success: false });
  }
});

// =========================
// CHECK PURCHASE (optional)
// =========================
app.get("/check-purchase", (req, res) => {
  const { userId, noteName } = req.query;

  const found = purchases.find(
    (p) => p.userId === userId && p.noteName === noteName
  );

  res.json({ purchased: !!found });
});

// =========================
// SECURE NOTE ACCESS 🔐
// =========================
app.get("/notes/:name", (req, res) => {
  const userId = req.query.userId;
  const noteName = req.params.name;

  const found = purchases.find(
    (p) => p.userId === userId && p.noteName === noteName
  );

  if (found) {
    return res.sendFile(
      path.join(__dirname, "notes", noteName)
    );
  } else {
    return res.status(403).send("❌ Please purchase this note");
  }
});

// =========================
// START SERVER
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
window.addEventListener("blur", () => {
  document.body.style.filter = "blur(10px)";
});

window.addEventListener("focus", () => {
  document.body.style.filter = "none";
});
document.addEventListener("contextmenu", event => event.preventDefault());
document.addEventListener("keyup", (e) => {
  if (e.key === "PrintScreen") {
    alert("Screenshot is not allowed!");
  }
});
