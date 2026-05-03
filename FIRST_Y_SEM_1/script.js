window.buyNote = async function(noteName, price) {
  try {
    let email = localStorage.getItem("email");

    if (!email) {
      email = prompt("Enter email:");
      if (!email) return;
      localStorage.setItem("email", email);
    }

    const orderRes = await fetch("https://backend-kxr2.onrender.com/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(price) * 100 })
    });

    const orderData = await orderRes.json();

    if (!orderData.order) {
      alert("Order failed");
      return;
    }

    const options = {
      key: orderData.key,
      amount: orderData.order.amount,
      currency: "INR",
      order_id: orderData.order.id,
      name: "Legal Addict",
      description: noteName,

      handler: async function (response) {

        const verifyRes = await fetch("https://backend-kxr2.onrender.com/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            email,
            noteName
          })
        });

        const verifyData = await verifyRes.json();

        if (verifyData.success) {
          window.location.href =
            `https://backend-kxr2.onrender.com/notes?email=${email}&noteName=${encodeURIComponent(noteName)}`;
        } else {
          alert("Payment verification failed");
        }
      },

      theme: { color: "#3399cc" }
    };

    const rzp = new Razorpay(options);

    rzp.on("payment.failed", function (response) {
      console.log(response.error);
      alert("Payment failed");
    });

    rzp.open();

  } catch (err) {
    console.log(err);
    alert("Error occurred");
  }
};
