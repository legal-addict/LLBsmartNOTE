app.post("/verify-payment", async (req, res) => {
  try {

    console.log("VERIFY REQUEST:");
    console.log(JSON.stringify(req.body, null, 2));

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      email,
      noteName
    } = req.body;

    console.log({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      email,
      noteName
    });
    
    console.log("SERVER STARTED");
console.log("REACHED APP LISTEN");
process.on("uncaughtException", err => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", err => {
  console.error("UNHANDLED REJECTION:", err);
});
// imports

const express = require("express");
const cors = require("cors");

const app = express();
const crypto = require("crypto");
app.use(cors());
app.use(express.json());



    // VALIDATION

    if (
      !isValidString(razorpay_order_id) ||
      !isValidString(razorpay_payment_id) ||
      !isValidString(razorpay_signature) ||
      !isValidString(email) ||
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

    // VERIFY SIGNATURE

    const generatedSignature = crypto
      .createHmac(
        "sha256",
        RAZORPAY_KEY_SECRET
      )
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: "Invalid signature"
      });
    }

    // PREVENT DUPLICATE PAYMENT

    const paymentRef = db.ref(
      `payments/${razorpay_payment_id}`
    );

    const result = await paymentRef.transaction(
      current => {
        if (current === null) {
          return {
            email,
            noteName,
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            createdAt: Date.now()
          };
        }
        return;
      }
    );

    if (!result.committed) {
      return res.status(400).json({
        success: false,
        error: "Payment already processed"
      });
    }

    // SAVE PURCHASE BY EMAIL

    const emailKey = email
      .trim()
      .toLowerCase()
      .replace(/\./g, "_");

    await db
      .ref(`purchases/${emailKey}/${noteName}`)
      .set({
        purchased: true,
        email: email.toLowerCase(),
        noteName,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        purchasedAt: Date.now()
      });

    return res.json({
      success: true
    });

  } catch (err) {

    console.error(
      "Verify error:",
      err
    );

    return res.status(500).json({
      success: false,
      error: "Verification failed"
    });
  }
});
