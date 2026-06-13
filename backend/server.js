window.buyNote = async function (noteName, price) {
try {

```
// VALIDATION

if (!noteName || !price) {
  alert("Invalid note");
  return;
}

const emailInput =
  document.getElementById("email");

if (!emailInput) {
  alert("Email field not found");
  return;
}

const email = emailInput.value
  .trim()
  .toLowerCase();

if (!email) {
  alert("Please enter your Gmail");
  return;
}

// PREVENT DOUBLE CLICK

if (window.paymentProcessing) {
  return;
}

window.paymentProcessing = true;

// CHECK PURCHASE

const checkRes = await fetch(
  `https://backend-kxr2.onrender.com/check-purchase?email=${encodeURIComponent(email)}&noteName=${encodeURIComponent(noteName)}`
);

if (!checkRes.ok) {
  throw new Error("Purchase check failed");
}

const checkData = await checkRes.json();

// ALREADY PURCHASED

if (checkData.purchased) {

  window.paymentProcessing = false;

  window.location.href =
    `https://backend-kxr2.onrender.com/notes?email=${encodeURIComponent(email)}&noteName=${encodeURIComponent(noteName)}`;

  return;
}

// CREATE ORDER

const orderRes = await fetch(
  "https://backend-kxr2.onrender.com/create-order",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: Math.round(Number(price) * 100),
      email,
      noteName
    })
  }
);

if (!orderRes.ok) {
  const errText = await orderRes.text();
  throw new Error(
    errText || "Order creation failed"
  );
}

const orderData = await orderRes.json();

if (
  !orderData.success ||
  !orderData.order
) {
  throw new Error("Invalid order data");
}

// RAZORPAY

const options = {

  key: orderData.key,

  amount: orderData.order.amount,

  currency: "INR",

  order_id: orderData.order.id,

  name: "Legal Addict",

  description: noteName,

  prefill: {
    email: email
  },

  handler: async function (response) {

    try {

      const verifyRes = await fetch(
        "https://backend-kxr2.onrender.com/verify-payment",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            razorpay_order_id:
              response.razorpay_order_id,

            razorpay_payment_id:
              response.razorpay_payment_id,

            razorpay_signature:
              response.razorpay_signature,

            email,
            noteName
          })
        }
      );

      const verifyData =
        await verifyRes.json();

      window.paymentProcessing = false;

      if (verifyData.success) {

        window.location.href =
          `https://backend-kxr2.onrender.com/notes?email=${encodeURIComponent(email)}&noteName=${encodeURIComponent(noteName)}`;

      } else {

        alert(
          verifyData.error ||
          "Payment verification failed"
        );
      }

    } catch (err) {

      console.error(
        "Verification error:",
        err
      );

      window.paymentProcessing = false;

      alert("Verification failed");
    }
  },

  modal: {
    ondismiss: function () {
      window.paymentProcessing = false;
    }
  },

  theme: {
    color: "#3399cc"
  }
};

const rzp = new Razorpay(options);

rzp.on(
  "payment.failed",
  function (response) {

    console.error(
      "Payment failed:",
      response.error
    );

    window.paymentProcessing = false;

    alert(
      response?.error?.description ||
      "Payment failed"
    );
  }
);

rzp.open();
```

} catch (err) {

```
console.error(
  "Buy note error:",
  err
);

window.paymentProcessing = false;

alert(
  err.message ||
  "Something went wrong"
);
```

}
};
