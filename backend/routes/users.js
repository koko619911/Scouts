const express = require("express");
const { db } = require("../firebaseAdmin");
const router = express.Router();

router.get("/top-users", async (req, res) => {
  try {
    const usersRef = db.collection("users");

    // Query to get the top 10 non-admin users ordered by points
    const snapshot = await usersRef
      .where("isAdmin", "==", false) // Filter out admins
      .orderBy("points", "desc") // Order by points in descending order
      .limit(10) // Limit to top 10 users
      .get();

    const topUsers = snapshot.docs.map((doc) => ({
      FullName: doc.data().name,
      points: doc.data().points,
    }));

    res.json({ users: topUsers });
  } catch (error) {
    console.error("Error fetching top users:", error);
    res.status(500).json({ error: "Error fetching top users" });
  }
});

router.get("/all-users", async (req, res) => {
  try {
    const user = req.user; // Assuming the user info is stored in req.user (after login)
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Access forbidden" });
    }

    const usersRef = db.collection("users");
    const snapshot = await usersRef.get();
    const allUsers = snapshot.docs.map((doc) => ({
      id: doc.id,
      FullName: doc.data().name,
      points: doc.data().points,
      email: doc.data().email,
      lastNoteDate: doc.data().lastNoteDate,
      photo: doc.data().photo,
    }));

    res.json({ users: allUsers });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Error fetching users" });
  }
});
// Get user details by ID
router.get("/users/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const userRef = db.collection("users").doc(id);
    const doc = await userRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = doc.data();
    res.json({ user: { ...user, id } });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ error: "Error fetching user details" });
  }
});

router.post("/reset-points", async (req, res) => {
  const { uid } = req.body;

  if (!uid) return res.status(400).json({ error: "Missing user ID" });

  try {
    await db.collection("users").doc(uid).update({ points: 0 });
    res.json({ success: true });
  } catch (error) {
    console.error("Reset points error:", error);
    res.status(500).json({ error: "Could not reset points" });
  }
});

// Delete user route
router.delete("/delete-user", async (req, res) => {
  const { uid } = req.body;

  if (!uid) return res.status(400).json({ error: "Missing user ID" });

  try {
    await db.collection("users").doc(uid).delete();
    res.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Could not delete user" });
  }
});

module.exports = router;
