const express = require("express");
const router  = express.Router();
const db      = require("../db");
const jwt     = require("jsonwebtoken");

const SECRET_KEY = "accesshub_secret";

function verifyToken(req, res, next) {
  const token = (req.headers["authorization"] || "").split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    req.user = jwt.verify(token, SECRET_KEY);
    next();
  } catch {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
}

// GET all access_dept
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM access_dept ORDER BY id");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch access departments" });
  }
});

// GET a user's access_dept
router.get("/user/:userId", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ad.id, ad.name
      FROM access_dept ad
      JOIN user_access_dept uad ON ad.id = uad.access_dept_id
      WHERE uad.user_id = ?
    `, [req.params.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user access departments" });
  }
});

// PUT — save a user's access_dept (replace all)
router.put("/user/:userId", verifyToken, async (req, res) => {
  try {
    const userId      = req.params.userId;
    const { access_dept_ids } = req.body; // array of access_dept ids

    // Delete existing then re-insert
    await db.query("DELETE FROM user_access_dept WHERE user_id = ?", [userId]);

    if (access_dept_ids && access_dept_ids.length > 0) {
      for (const adId of access_dept_ids) {
        await db.query(
          "INSERT INTO user_access_dept (user_id, access_dept_id) VALUES (?, ?)",
          [userId, adId]
        );
      }
    }

    res.json({ message: "Access departments updated successfully" });
  } catch (err) {
    console.error("UPDATE ACCESS DEPT ERROR:", err);
    res.status(500).json({ error: "Failed to update access departments" });
  }
});

module.exports = router;
