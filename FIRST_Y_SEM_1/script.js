window.buyNote = async function(noteName, price) {

  try {

    // =========================
    // STABLE USER ID
    // =========================

    let userId = localStorage.getItem("userId");

    if (!userId) {

      userId = crypto.randomUUID();

      localStorage.setItem("userId", userId);
    }

    // =========================
    // CHECK PURCHASE FIRST
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
    // PREVENT DOUBLE CLICK
    // =========================

    if (window.paymentProcessing) {
      return;
    }

    window.paymentProcessing = true;

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

      window.paymentProcessing = false;

      throw new Error("Order creation failed");
    }

    const orderData = await orderRes.json();

    // =========================
    // RAZORPAY OPTIONS
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

          const verifyData =
            await verifyRes.json();

          window.paymentProcessing = false;

          if (verifyData.success) {

            window.location.href =

              `https://backend-kxr2.onrender.com/notes?userId=${encodeURIComponent(userId)}&noteName=${encodeURIComponent(noteName)}`;

          } else {

            alert("Payment verification failed");
          }

        } catch (err) {

          console.error(err);

          window.paymentProcessing = false;

          alert("Verification error");
        }
      },

      modal: {

        ondismiss: function() {

          window.paymentProcessing = false;
        }
      },

      theme: {
        color: "#3399cc"
      }
    };

    const rzp = new Razorpay(options);

    rzp.on("payment.failed", function(response) {

      console.error(response.error);

      window.paymentProcessing = false;

      alert(
        response.error.description ||
        "Payment failed"
      );
    });

    rzp.open();

  } catch (err) {

    console.error(err);

    window.paymentProcessing = false;

    alert("Something went wrong");
  }
};
