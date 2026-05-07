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

app.use(cors({
  origin: "*"
}));

app.use(express.json());

// =========================
// PURCHASE FILE
// =========================

const filePath = path.join(__dirname, "purchases.json");

let purchases = {};

// =========================
// LOAD PURCHASES
// =========================

try {

  if (fs.existsSync(filePath)) {

    purchases = JSON.parse(
      fs.readFileSync(filePath, "utf-8")
    );

  } else {

    fs.writeFileSync(
      filePath,
      JSON.stringify({}, null, 2)
    );
  }

} catch (err) {

  console.log(err);

  purchases = {};
}

// =========================
// SAVE PURCHASES
// =========================

function savePurchases() {

  fs.writeFileSync(
    filePath,
    JSON.stringify(purchases, null, 2)
  );
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

    if (!amount || amount < 1) {

      return res.status(400).json({
        error: "Invalid amount"
      });
    }

    const order = await razorpay.orders.create({

      amount,

      currency: "INR",

      receipt: "rcpt_" + Date.now()
    });

    res.json({

      key: process.env.RAZORPAY_KEY_ID,

      order
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "Order failed"
    });
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
  userId,
  noteName
} = req.body;
    // =========================
    // VALIDATION
    // =========================

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !userId ||
      !noteName
    ) {

      return res.json({
        success: false
      });
    }

    // =========================
    // VERIFY SIGNATURE
    // =========================

    const body =
      razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(body.toString())
      .digest("hex");

    // =========================
    // INVALID PAYMENT
    // =========================

    if (expectedSignature !== razorpay_signature) {

      return res.json({
        success: false
      });
    }

    // =========================
    // CREATE USER
    // =========================

    if (!purchases[userId]) {

      purchases[userId] = [];
    }

    // =========================
    // PREVENT REPURCHASE
    // =========================

    if (!purchases[userId].includes(noteName)) {

      purchases[userId].push(noteName);

      savePurchases();
    }

    res.json({
      success: true
    });

  } catch (err) {

    console.log(err);

    res.json({
      success: false
    });
  }
});

// =========================
// CHECK PURCHASE
// =========================

app.get("/check-purchase", (req, res) => {

  const { userId, noteName } = req.query;

  if (!userId || !noteName) {

    return res.json({
      purchased: false
    });
  }

  const userNotes = purchases[userId] || [];

  res.json({

    purchased: userNotes.includes(noteName)
  });
});

// =========================
// NOTES ACCESS
// =========================

app.get("/notes", (req, res) => {

  const userId = req.query.userId;

  const noteName = decodeURIComponent(
    req.query.noteName || ""
  );

  // =========================
  // VALIDATION
  // =========================

  if (!userId || !noteName) {

    return res.status(400).send("Missing data");
  }

  const userNotes = purchases[userId] || [];

  // =========================
  // NOT PURCHASED
  // =========================

  if (!userNotes.includes(noteName)) {

    return res.status(403).send("❌ Access denied");
  }

  // =========================
  // FILE MAP
  // =========================

  const fileMap = {

    "English I": "English_I.html",

    "Economics": "Economics.html",

    "LOGIC - I": "LOGIC - I.html"
  };

  const fileName = fileMap[noteName];

  if (!fileName) {

    return res.status(404).send("Invalid note");
  }

  // =========================
  // FILE PATH
  // =========================

  const fullPath = path.join(

    __dirname,

    "..",

    "FIRST_Y_SEM_1",

    fileName
  );

  // =========================
  // FILE EXISTS
  // =========================

  if (!fs.existsSync(fullPath)) {

    return res.status(404).send("File missing");
  }

  // =========================
  // SEND FILE
  // =========================

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
