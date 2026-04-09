async function buyNote(noteName, price) {
  try {let userId = localStorage.getItem("userId");

if (!userId) {
  userId = "user_" + Date.now();
  localStorage.setItem("userId", userId);
}
    // ✅ Create order
    const orderRes = await fetch("https://backend-kxr2.onrender.com/create-order" , {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({amount: price * 100 })
    });

if (!orderRes.ok) throw new Error("Order creation failed");
const orderData = await orderRes.json();

    const options = {
  key: orderData.key,
  amount: orderData.order.amount,
  currency: "INR",
  order_id: orderData.order.id,
  name: "Legal Addict",
  description: noteName,
  handler: async function (response) {
        // verify payment
        const verifyRes = await fetch("https://backend-kxr2.onrender.com/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
             userId, 
            noteName
          })
        });

        const verifyData = await verifyRes.json();

        if (verifyData.success) {
  window.location.href = verifyData.url;
} else {
          alert("Payment verification failed.");
        }
      },

      modal: {
        ondismiss: () => alert("Payment cancelled")
      }
    };
const rzp = new Razorpay(options);
    rzp.open();

  } catch (error) {
    console.error("ERROR:", error);
    alert("Payment failed");
  }
}
