const express = require("express");
const router = express.Router();
const db = require("../db");

// =====================================
// ✅ CREATE LINK
// =====================================
router.post("/", async (req, res) => {
  try {
    const { name, url, department_id } = req.body;

    if (!name || !url || !department_id) {
      return res.status(400).json({ message: "All fields required" });
    }

    await db.query(
      "INSERT INTO links (name, url, department_id) VALUES (?, ?, ?)",
      [name, url, department_id]
    );

    res.json({ message: "Link created successfully" });

  } catch (err) {
    console.error("🔥 CREATE LINK ERROR:", err);
    res.status(500).json({ error: "Failed to create link" });
  }
});

// =====================================
// ✅ GET ALL LINKS
// =====================================
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        l.id,
        l.name,
        l.url,
        l.department_id,
        d.name AS department_name
      FROM links l
      LEFT JOIN departments d 
      ON l.department_id = d.id
    `);

    res.json(rows);

  } catch (err) {
    console.error("🔥 FETCH LINKS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch links" });
  }
});
// =====================================
// ✅ UPDATE LINK
// =====================================
router.put("/:id", async (req, res) => {
  try {
    const { name, url, department_id } = req.body;

    await db.query(
      "UPDATE links SET name = ?, url = ?, department_id = ? WHERE id = ?",
      [name, url, department_id, req.params.id]
    );

    res.json({ message: "Link updated successfully" });

  } catch (err) {
    console.error("🔥 UPDATE LINK ERROR:", err);
    res.status(500).json({ error: "Failed to update link" });
  }
});

// =====================================
// ✅ DELETE LINK
// =====================================
router.delete("/:id", async (req, res) => {
  try {
    await db.query(
      "DELETE FROM links WHERE id = ?",
      [req.params.id]
    );

    res.json({ message: "Link deleted successfully" });

  } catch (err) {
    console.error("🔥 DELETE LINK ERROR:", err);
    res.status(500).json({ error: "Failed to delete link" });
  }
});

module.exports = router;