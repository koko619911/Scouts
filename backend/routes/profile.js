const express = require("express");
const router = express.Router();
const { db } = require("../firebaseAdmin");  // Assuming this is your Firestore initialization

router.post("/complete-profile", async (req, res) => {
  try {
    console.log("User:", req.user);  // Log the user to check if uid exists
    if (!req.user || !req.user.uid) {
      return res.status(400).json({ error: "User not authenticated" });
    }

    const { FullName, Age, Rahat, PhoneNumber } = req.body;
    if (!FullName || !Age || !Rahat || !PhoneNumber) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Now use the uid to update the Firestore document
    const userRef = db.collection("users").doc(req.user.uid);
    await userRef.update({
      fullName: FullName,
      age: Age,
      rahat: Rahat,
      phoneNumber: PhoneNumber,
    });

    res.status(200).json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;
