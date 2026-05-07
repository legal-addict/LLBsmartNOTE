window.buyNote = async function(noteName, price) {

  try {

    // =========================
    // USER ID
    // =========================

    let userId = localStorage.getItem("userId");

    if (!userId) {

      userId = btoa(
        navigator.userAgent +
        "_" +
        screen.width +
        "_" +
        screen.height
      );

      localStorage.setItem("userId", userId);
    }

    // =========================
    // CHECK EXISTING PURCHASE
    // =========================

    const checkRes = await fetch(

      `https://backend-kxr2.onrender.com/check-purchase?userId=${encodeURIComponent(userId)}&noteName=${encodeURIComponent(noteName)}`

    );

    const checkData = await checkRes.json();

    // =========================
    // ALREADY PURCHASED
    // =========================

    if (checkData.purchased) {

      window.location.href =

        `https://backend-kxr2.onrender.com/notes?userId=${encodeURIComponent(userId)}&noteName=${encodeURIComponent(noteName)}`;

      return;
    }

    // =========================
    // CREATE ORDER
    // =========================

    const orderRes = await fetch(
      "https://backend-kxr2.onrender.com/create-order",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          amount: Number(price) * 100
        })
      }
    );

    if (!orderRes.ok) {

      throw new Error("Order creation failed");
    }

    const orderData = await orderRes.json();

    if (!orderData.order || !orderData.key) {

      alert("Order failed");
      return;
    }

    // =========================
    // RAZORPAY
    // =========================

    const options = {

      key: orderData.key,

      amount: orderData.order.amount,

      currency: "INR",

      order_id: orderData.order.id,

      name: "Legal Addict",

      description: noteName,

      handler: async function(response) {

        try {

          // =========================
          // VERIFY PAYMENT
          // =========================

          const verifyRes = await fetch(
            "https://backend-kxr2.onrender.com/verify-payment",
            {
              method: "POST",

              headers: {
                "Content-Type": "application/json"
              },

              body: JSON.stringify({

                razorpay_order_id:
                  response.razorpay_order_id,

                razorpay_payment_id:
                  response.razorpay_payment_id,

                razorpay_signature:
                  response.razorpay_signature,

                userId,

                noteName
              })
            }
          );

          if (!verifyRes.ok) {

            throw new Error("Verification failed");
          }

          const verifyData =
            await verifyRes.json();

          // =========================
          // PAYMENT SUCCESS
          // =========================

          if (verifyData.success) {

            window.location.href =

              `https://backend-kxr2.onrender.com/notes?userId=${encodeURIComponent(userId)}&noteName=${encodeURIComponent(noteName)}`;

          } else {

            alert("Payment verification failed");
          }

        } catch (err) {

          console.error(err);

          alert("Verification error");
        }
      },

      prefill: {
        name: "Legal Addict User"
      },

      theme: {
        color: "#3399cc"
      }
    };

    const rzp = new Razorpay(options);

    // =========================
    // PAYMENT FAILED
    // =========================

    rzp.on("payment.failed", function(response) {

      console.error(response.error);

      alert(
        response.error.description ||
        "Payment failed"
      );
    });

    rzp.open();

  } catch (err) {

    console.error(err);

    alert("Something went wrong");
  }
};
