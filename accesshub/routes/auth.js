const express    = require("express");
const router     = express.Router();
const db         = require("../db");
const bcrypt     = require("bcryptjs");
const jwt        = require("jsonwebtoken");

// ← Use environment variable for security
const SECRET_KEY = process.env.JWT_SECRET || "accesshub_secret";

// =====================================
// LOGIN
// =====================================
router.post("/login", async (req, res) => {
  try {
    const email    = req.body.email.trim().toLowerCase();
    const password = req.body.password;

    const [users] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user    = users[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Wrong password" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      SECRET_KEY,
      { expiresIn: "8h" }
    );

    // Return user without password
    const { password: _pw, ...safeUser } = user;

    res.json({
      message: "Login success",
      token,
      role:    user.role,
      user:    safeUser
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
