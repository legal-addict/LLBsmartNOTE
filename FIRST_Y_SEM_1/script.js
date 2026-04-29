async function buyNote(noteName, price) {
  try {
    // ✅ Get email
    let email = localStorage.getItem("email");

    if (!email) {
      email = prompt("Enter your email to access notes:");

      if (!email) {
        alert("Email is required");
        return;
      }

      localStorage.setItem("email", email);
    }

    // ✅ STEP 1: Check purchase
    const checkRes = await fetch(
      `https://backend-kxr2.onrender.com/check-purchase?email=${encodeURIComponent(email)}&noteName=${encodeURIComponent(noteName)}`
    );

    const checkData = await checkRes.json();

    if (checkData.purchased) {
      window.location.href = checkData.url;
      return;
    }

    // ✅ STEP 2: Create order
    const orderRes = await fetch(
      "https://backend-kxr2.onrender.com/create-order",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: price * 100 }),
      }
    );

    if (!orderRes.ok) throw new Error("Order failed");

    const orderData = await orderRes.json();

    // ✅ STEP 3: Razorpay
    const options = {
      key: orderData.key,
      amount: orderData.order.amount,
      currency: "INR",
      order_id: orderData.order.id,
      name: "Legal Addict",
      description: noteName,

      handler: async function (response) {
        const verifyRes = await fetch(
          "https://backend-kxr2.onrender.com/verify-payment",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              email,
              noteName,
            }),
          }
        );

        const verifyData = await verifyRes.json();

        if (verifyData.success) {
          window.location.href = verifyData.url;
        } else {
          alert("Payment verification failed");
        }
      },

      modal: {
        ondismiss: () => alert("Payment cancelled"),
      },
    };

    const rzp = new Razorpay(options);
    rzp.open();

  } catch (err) {
    console.error(err);
    alert("Something went wrong");
  }
}
