const express = require("express");
const session = require("express-session");
const passport = require("passport");
require("dotenv").config();
const { db } = require("./firebaseAdmin");  // Import Firestore from firebaseAdmin.js
const authRoutes = require("./routes/signinwithgoogle");
const profileRoutes = require("./routes/profile");
const noteRoutes = require("./routes/note");
const usersRoute = require('./routes/users'); // Correct path to your route file
const cors = require("cors");

const app = express();
const PORT = 5000;
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
app.use(express.json());  // This is the built-in Express middleware for JSON parsing

// Serialize and Deserialize User
passport.serializeUser((user, done) => {
  done(null, user.uid); // Only store user ID in session
});

passport.deserializeUser(async (uid, done) => {
  try {
    const userRef = db.collection("users").doc(uid);
    const doc = await userRef.get();
    if (!doc.exists) return done(null, false);

    done(null, { uid, ...doc.data() });
  } catch (err) {
    done(err, null);
  }
});


// Middleware
app.use(session({
  secret: "your-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,  // secure: true only works on HTTPS
    httpOnly: true,
    sameSite: "lax",
  },
}));


app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/auth", authRoutes);

app.use('/api', usersRoute);  // Ensure this line exists to connect your route
app.use("/api", profileRoutes);
app.use("/api/note", noteRoutes);


//logout button
// Logout route
// New logout route
app.get("/auth/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).send("Logout failed");
    }
    req.session.destroy(() => {
      res.clearCookie("connect.sid"); // Destroy session and clear cookies
      res.status(200).json({ message: "Logged out successfully" }); // Respond with success
    });
  });
});


app.get("/auth/check-session", (req, res) => {
  console.log("Session user:", req.user);
  if (req.user) {
    res.json({ authenticated: true, user: req.user });
  } else {
    res.json({ authenticated: false });
  }
});



app.get("/", (req, res) => res.send("Backend running"));

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
