window.buyNote = async function(noteName, price) {

  try {

    if (!noteName || !price) {
      alert("Invalid note");
      return;
    }

    const email = document
      .getElementById("email")
      .value
      .trim()
      .toLowerCase();

    if (!email) {
      alert("Please enter your Gmail");
      return;
    }

    if (window.paymentProcessing) {
      return;
    }

    window.paymentProcessing = true;

    const checkRes = await fetch(
      `https://backend-kxr2.onrender.com/check-purchase?email=${encodeURIComponent(email)}&noteName=${encodeURIComponent(noteName)}`
    );

    if (!checkRes.ok) {
      throw new Error("Purchase check failed");
    }

    const checkData = await checkRes.json();

    if (checkData.purchased) {

      window.paymentProcessing = false;

      window.location.href =
        `https://backend-kxr2.onrender.com/notes?email=${encodeURIComponent(email)}&noteName=${encodeURIComponent(noteName)}`;

      return;
    }

    // ... rest of your code ...

  } catch (err) {

    console.error("Buy note error:", err);

    window.paymentProcessing = false;

    alert(err.message || "Something went wrong");
  }
};
