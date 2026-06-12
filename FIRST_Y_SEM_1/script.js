window.buyNote = async function(noteName, price) {

  try {

    // =========================
    // VALIDATION
    // =========================

    if (!noteName || !price) {
      alert("Invalid note");
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
    // STABLE USER ID
    // =========================
const email =
document.getElementById("email").value;

body: JSON.stringify({
    amount: Math.round(Number(price) * 100),
    email,
    noteName
})CREATE TABLE purchases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    note_name VARCHAR(255) NOT NULL,
    payment_id VARCHAR(255),
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
    let userId =
      localStorage.getItem("legal_addict_user");

    if (!userId) {

      userId = crypto.randomUUID();

      localStorage.setItem(
        "legal_addict_user",
        userId
      );
    }

    // =========================
    // CHECK PURCHASE FIRST
    // =========================

    const checkRes = await fetch(
      `https://backend-kxr2.onrender.com/check-purchase?userId=${encodeURIComponent(userId)}&noteName=${encodeURIComponent(noteName)}`
    );

    if (!checkRes.ok) {
      throw new Error("Purchase check failed");
    }

    const checkData = await checkRes.json();

    // =========================
    // ALREADY PURCHASED
    // =========================

    if (checkData.purchased) {

      window.paymentProcessing = false;

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
          amount: Math.round(Number(price) * 100)
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

          // =========================
          // VERIFY PAYMENT
          // =========================

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

                userId,

                noteName
              })
            }
          );

          const verifyData =
            await verifyRes.json();

          // =========================
          // RESET PROCESS FLAG
          // =========================

          window.paymentProcessing = false;

          // =========================
          // SUCCESS
          // =========================

          if (verifyData.success) {

            window.location.href =
              `https://backend-kxr2.onrender.com/notes?userId=${encodeURIComponent(userId)}&noteName=${encodeURIComponent(noteName)}`;

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

          alert(
            "Verification failed"
          );
        }
      },

      // =========================
      // PAYMENT FAILED
      // =========================

      modal: {

        ondismiss: function() {

          window.paymentProcessing = false;
        }
      },

      prefill: {

        name: "",

        email: "",

        contact: ""
      },

      theme: {
        color: "#3399cc"
      }
    };

    // =========================
    // OPEN RAZORPAY
    // =========================

    const rzp = new Razorpay(options);

    rzp.on(
      "payment.failed",
      function(response) {

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

  } catch (err) {

    console.error(
      "Buy note error:",
      err
    );

    window.paymentProcessing = false;

    alert(
      err.message ||
      "Something went wrong"
    );
  }
};
