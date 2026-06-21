const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log("REQUEST:", req.method, req.url);
  next();
});// CHECK PURCHASE
// =====================================

app.get("/check-purchase", async (req, res) => {
  try {
    const { email, noteName } = req.query;

    if (!email || !noteName) {
      return res.status(400).json({
        purchased: false
      });
    }

    const emailKey = email
      .trim()
      .toLowerCase()
      .replace(/\./g, "_");

    const snap = await db
      .ref(`purchases/${emailKey}/${noteName}`)
      .once("value");

    return res.json({
      purchased: snap.exists()
    });

  } catch (err) {

    console.error(
      "CHECK PURCHASE ERROR:",
      err
    );

    return res.status(500).json({
      purchased: false
    });
  }
});

// =====================================
// VERIFY PAYMENT
// =====================================

app.post("/verify-payment", async (req, res) => {
  try {

    console.log("VERIFY REQUEST");
    console.log(req.body);

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      email,
      noteName
    } = req.body;

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

    const generatedSignature = crypto
      .createHmac(
        "sha256",
        RAZORPAY_KEY_SECRET
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

    const paymentRef = db.ref(
      `payments/${razorpay_payment_id}`
    );

    const result =
      await paymentRef.transaction(
        current => {
          if (current === null) {
            return {
              email,
              noteName,
              orderId: razorpay_order_id,
              paymentId:
                razorpay_payment_id,
              createdAt: Date.now()
            };
          }

          return;
        }
      );

    if (!result.committed) {
      return res.status(400).json({
        success: false,
        error:
          "Payment already processed"
      });
    }

    const emailKey = email
      .trim()
      .toLowerCase()
      .replace(/\./g, "_");

    await db
      .ref(
        `purchases/${emailKey}/${noteName}`
      )
      .set({
        purchased: true,
        email: email.toLowerCase(),
        noteName,
        paymentId:
          razorpay_payment_id,
        orderId:
          razorpay_order_id,
        purchasedAt: Date.now()
      });

    return res.json({
      success: true
    });

  } catch (err) {

    console.error(
      "VERIFY PAYMENT ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// =====================================
// START SERVER
// =====================================

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("SERVER STARTED");
  console.log("PORT:", PORT);
});
