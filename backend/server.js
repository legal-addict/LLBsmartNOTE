app.post("/verify-payment", async (req, res) => {
try {

```
const {
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  email,
  noteName
} = req.body;

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

// VERIFY RAZORPAY SIGNATURE

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

// PREVENT DUPLICATE PAYMENT

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
          orderId:
            razorpay_order_id,
          paymentId:
            razorpay_payment_id,
          createdAt:
            Date.now()
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

// SAVE PURCHASE BY EMAIL

const emailKey = email
  .toLowerCase()
  .replace(/\./g, "_");

await db
  .ref(
    `purchases/${emailKey}/${noteName}`
  )
  .set({
    purchased: true,
    email,
    paymentId:
      razorpay_payment_id,
    orderId:
      razorpay_order_id,
    noteName,
    purchasedAt:
      Date.now()
  });

return res.json({
  success: true
});
```

} catch (err) {

```
console.error(
  "Verify error:",
  err
);

return res.status(500).json({
  success: false,
  error:
    "Verification failed"
});
```

}
});
