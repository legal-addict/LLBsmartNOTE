async function buyNote(noteName, price) {
  try {
    let email = localStorage.getItem("email");

    if (!email) {
      email = prompt("Enter email:");
      if (!email) return;
      localStorage.setItem("email", email);
    }

    // CREATE ORDER
    const orderRes = await fetch("https://backend-kxr2.onrender.com/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: price * 100 })
    });

    const orderData = await orderRes.json();

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

          // check purchase
          const check = await fetch(
            `https://backend-kxr2.onrender.com/check-purchase?email=${email}&noteName=${noteName}`
          );

          const data = await check.json();

          if (data.purchased) {
            window.location.href =
  `https://backend-kxr2.onrender.com/notes?email=${email}&noteName=${encodeURIComponent(noteName)}`;
                              
          } else {
            alert("Payment done but access not found");
          }

        } else {
          alert("Payment failed");
        }
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();

  } catch (err) {
    console.log(err);
    alert("Error occurred");
  }
} 
