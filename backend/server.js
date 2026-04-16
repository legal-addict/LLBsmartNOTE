const fs = require("fs");

let purchases = [];

if (fs.existsSync("purchases.json")) {
  const data = fs.readFileSync("purchases.json");
  purchases = JSON.parse(data);
}
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
// NOTE FILES MAPPING
// =========================
const noteFiles = {
  "English I": "FIRST_Y_SEM_1/English_I.html",
  "LOGIC - I": "FIRST_Y_SEM_1/LOGIC_I.html",
  "Economics": "FIRST_Y_SEM_1/Economics.html"
  // Add more notes here if needed
};

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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, noteName, userId } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                                    .update(body)
                                    .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: "Invalid signature" });
    }
if (!alreadyBought) {
  purchases.push({ userId, noteName });

  fs.writeFileSync("purchases.json", JSON.stringify(purchases, null, 2));
}
    
    const alreadyBought = purchases.find(
      p => p.userId === userId && p.noteName === noteName
    );

    if (!alreadyBought) purchases.push({ userId, noteName });

    const fileName = noteFiles[noteName];
    if (!fileName) return res.status(400).json({ success: false, error: "Invalid note" });

    return res.json({
      success: true,
      url: `https://backend-kxr2.onrender.com/notes/${fileName}?userId=${userId}&noteName=${encodeURIComponent(noteName)}`
    });

  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ success: false });
  }
});

// =========================
// CHECK PURCHASE
// =========================
app.get("/check-purchase", (req, res) => {
  const { userId, noteName } = req.query;
  const found = purchases.find(p => p.userId === userId && p.noteName === noteName);
  res.json({ purchased: !!found });
});

// =========================
// SECURE NOTE ACCESS
// =========================
app.get("/notes/*", (req, res) => {
  try {
    const userId = req.query.userId;
    const noteName = req.query.noteName;

    console.log("User:", userId);
    console.log("Note:", noteName);

    if (!userId || !noteName) return res.status(400).send("Missing data");

    const fileName = noteFiles[noteName];
    if (!fileName) return res.status(404).send("Invalid note");

    const found = purchases.find(
      p => p.userId === userId && p.noteName === noteName
    );

    if (!found) return res.status(403).send("❌ Please purchase this note");
    
  const fullPath = path.join(__dirname, "..", fileName);
    
    console.log("Serving:", fullPath);

    return res.sendFile(fullPath);

  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Server error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
