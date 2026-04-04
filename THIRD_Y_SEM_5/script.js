// STEP 1: Generate a unique userId for this browser
let userId = localStorage.getItem("userId");
if (!userId) {
  userId = "user_" + Date.now(); // simple unique ID
  localStorage.setItem("userId", userId);
}

// STEP 2: Buy note function
async function buyNote(noteName, price) {
  try {
    // STEP 2a: Check if user already purchased this note
    const checkRes = await fetch(`https://backend-kxr2.onrender.com/check-purchase?userId=${userId}&noteName=${encodeURIComponent(noteName)}`);
    const checkData = await checkRes.json();
    if (checkData.purchased) {
      // Already purchased → open note
      window.location.href = `https://backend-kxr2.onrender.com/notes/${encodeURIComponent(noteName)}.html`;
      return;
    }

    // STEP 2b: Create order
    const orderRes = await fetch("https://backend-kxr2.onrender.com/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: price * 100 }) // Razorpay expects paise
    });

    if (!orderRes.ok) throw new Error("Order creation failed");
    const orderData = await orderRes.json();

    // STEP 2c: Razorpay options
    const options = {
      key: orderData.key,
      amount: orderData.order.amount,
      currency: "INR",
      order_id: orderData.order.id,
      name: "Legal Addict Notes",
      description: noteName,
      handler: async function (response) {
        // STEP 2d: Verify payment
        const verifyRes = await fetch("https://backend-kxr2.onrender.com/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            userId,         // 👈 use this to track user
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

// STEP 3: Hide Buy buttons if already purchased
document.querySelectorAll("button").forEach(async btn => {
  const noteName = btn.innerText;
  try {
    const res = await fetch(`https://backend-kxr2.onrender.com/check-purchase?userId=${userId}&noteName=${encodeURIComponent(noteName)}`);
    const data = await res.json();
    if (data.purchased) btn.style.display = "none";
  } catch (e) {
    console.error("Check purchase error:", e);
  }
});
