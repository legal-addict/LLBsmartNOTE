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

    if (!validNotes.includes(noteName)) {
      return res.status(400).json({
        success: false,
        error: "Invalid note"
      });
    }

    // =========================
    // VERIFY SIGNATURE
    // =========================

    const generatedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: "Invalid signature"
      });
    }

    // =========================
    // PREVENT DUPLICATE PAYMENT
    // =========================

    const paymentRef = db.ref(
      `payments/${razorpay_payment_id}`
    );

    const result = await paymentRef.transaction(current => {
      if (current === null) {
        return {
          userId,
          noteName,
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          createdAt: Date.now()
        };
      }

      return;
    });

    // Already processed
    if (!result.committed) {
      return res.status(400).json({
        success: false,
        error: "Payment already processed"
      });
    }

    // =========================
    // SAVE PURCHASE
    // =========================

    await db
      .ref(`purchases/${userId}/${noteName}`)
      .set({
        purchased: true,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        noteName,
        purchasedAt: Date.now()
      });

    // =========================
    // SUCCESS
    // =========================

    return res.json({
      success: true
    });

  } catch (err) {
    console.error("Verify error:", err);

    return res.status(500).json({
      success: false,
      error: "Verification failed"
    });
  }
});
