const express = require("express");
const passport = require("passport");
const { db } = require("../firebaseAdmin");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { DateTime } = require("luxon");

require("dotenv").config();
const router = express.Router();
const cairoTime = DateTime.now().setZone("Africa/Cairo").toISO();

// Google OAuth strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback",
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const userRef = db.collection("users").doc(profile.id);
    const doc = await userRef.get();


    const adminEmails = process.env.ADMIN_EMAILS.split(",");  // Get admin emails as an array

    // Prepare user data
    const userData = {
      name: profile.displayName,
      email: profile.emails[0].value,
      photo: profile.photos[0].value,
      points: doc.exists ? doc.data().points || 0 : 0,
      lastNoteDate: doc.exists ? doc.data().lastNoteDate || null : null,
      loginTimestamp:  cairoTime ,// Adding the login timestamp
      isAdmin: adminEmails.includes(profile.emails[0].value),  // Check if email is in the admin emails list

    };

    // If user doesn't exist, create a new document
    if (!doc.exists) {
      await userRef.set(userData);
      return done(null, { uid: profile.id, ...userData, isNew: true });

    } else {
      // Update the user data with login timestamp
      await userRef.update({ loginTimestamp: cairoTime});
      return done(null, { uid: profile.id, ...userData, isNew: false });

    }

    // Return user data for session
  } catch (err) {
    console.error("Error saving user:", err);
    return done(err, null);
  }
}));

// Auth routes
router.get("/google", passport.authenticate("google", {
  scope: ["profile", "email"]
}));

router.get("/google/callback",
    passport.authenticate("google", { failureRedirect: "/" }),
    (req, res) => {
      const { isNew, isAdmin } = req.user;

      if (isAdmin) {
        // Admins always go straight to dashboard
        res.redirect("http://localhost:3000/dashboard");
      } else if (isNew) {
        // New normal users go to complete profile
        res.redirect("http://localhost:3000/complete-profile");
      } else {
        // Existing users go to dashboard
        res.redirect("http://localhost:3000/dashboard");
      }
      
    }
  );
  

module.exports = router;
