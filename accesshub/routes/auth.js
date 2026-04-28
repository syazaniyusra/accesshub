const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const SECRET_KEY = "accesshub_secret"; // can move to .env later

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const email = req.body.email.trim().toLowerCase();
    const password = req.body.password;

    console.log("👉 EMAIL FROM FRONTEND:", `"${email}"`);

    const [users] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    console.log("👉 QUERY RESULT:", users);

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Wrong password" });
    }

    // 🔥 CREATE TOKEN
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      SECRET_KEY,
      { expiresIn: "2h" }
    );

    // ✅ SEND TOKEN + USER
    res.json({
      message: "Login success",
      token,
      user
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;