require("dotenv").config();

const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

// =========================
// DEBUG
// =========================
console.log("Server directory:", __dirname);

// =========================
// FILE PATH
// =========================
const filePath = path.join(__dirname, "purchases.json");

// =========================
// LOAD PURCHASES
// =========================
let purchases = [];

try {
  if (fs.existsSync(filePath)) {
    purchases = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } else {
    fs.writeFileSync(filePath, JSON.stringify([]));
  }
} catch (err) {
  console.log("Error loading purchases:", err);
}

// =========================
// MIDDLEWARE
// =========================
app.use(cors({ origin: "*" }));
app.use(express.json());

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

    if (!amount) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: "rcpt_" + Date.now(),
    });

    res.json({
      key: process.env.RAZORPAY_KEY_ID,
      order,
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Order failed" });
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
      email,
      noteName
    } = req.body;

    if (!email || !noteName) {
      return res.json({ success: false });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.json({ success: false });
    }

    const exists = purchases.find(
      p => p.email === email && p.noteName === noteName
    );

    if (!exists) {
      purchases.push({ email, noteName });
      fs.writeFileSync(filePath, JSON.stringify(purchases, null, 2));
    }

    res.json({ success: true });

  } catch (err) {
    console.log(err);
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

  res.json({ purchased: !!found });
});

// =========================
// SERVE NOTES (FIXED)
// =========================
app.get("/notes", (req, res) => {
  const email = req.query.email;
  const noteName = decodeURIComponent(req.query.noteName || "");

  if (!email || !noteName) {
    return res.status(400).send("Missing data");
  }

  const found = purchases.find(
    p => p.email === email && p.noteName === noteName
  );

  if (!found) {
    return res.status(403).send("❌ Not purchased");
  }

  const fileMap = {
    "English I": "English_I.html",
    "Economics": "Economics.html",
    "LOGIC - I": "LOGIC_I.html"
  };

  const fileName = fileMap[noteName];

  if (!fileName) {
    return res.status(404).send("Invalid note name");
  }
const fullPath = path.join(__dirname, "..", "FIRST_Y_SEM_1", fileName);

  if (!fs.existsSync(fullPath)) {
    return res.status(500).send("File not found on server");
  }

  res.sendFile(fullPath);
});

// =========================
// ROOT
// =========================
app.get("/", (req, res) => {
  res.send("Backend running ✅");
});

// =========================
// START
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
