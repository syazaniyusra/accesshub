const express = require("express");
const router  = express.Router();
const db      = require("../db");

// Auto-create table if it doesn't exist
async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS training_events (
      id          VARCHAR(32)   PRIMARY KEY,
      name        VARCHAR(255)  NOT NULL,
      category    VARCHAR(50)   DEFAULT 'general',
      date_start  DATE          NOT NULL,
      date_end    DATE          NULL,
      description TEXT          NULL,
      files       LONGTEXT      NULL,
      created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
ensureTable().catch(err => console.error("ensureTable training_events:", err));

// GET all events
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM training_events ORDER BY date_start ASC"
    );
    const events = rows.map(r => ({
      id:        r.id,
      name:      r.name,
      category:  r.category,
      dateStart: r.date_start,
      dateEnd:   r.date_end || "",
      desc:      r.description || "",
      files:     r.files ? JSON.parse(r.files) : [],
      createdAt: r.created_at,
    }));
    res.json(events);
  } catch (err) {
    console.error("GET /api/training:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST create event
router.post("/", async (req, res) => {
  try {
    const { id, name, category, dateStart, dateEnd, desc, files } = req.body;
    if (!id || !name || !dateStart) {
      return res.status(400).json({ error: "id, name and dateStart are required" });
    }
    await db.query(
      `INSERT INTO training_events (id, name, category, date_start, date_end, description, files)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, category || "general", dateStart, dateEnd || null, desc || null,
       files ? JSON.stringify(files) : null]
    );
    res.status(201).json({ success: true, id });
  } catch (err) {
    console.error("POST /api/training:", err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update event
router.put("/:id", async (req, res) => {
  try {
    const { name, category, dateStart, dateEnd, desc, files } = req.body;
    await db.query(
      `UPDATE training_events
       SET name=?, category=?, date_start=?, date_end=?, description=?, files=?
       WHERE id=?`,
      [name, category || "general", dateStart, dateEnd || null, desc || null,
       files ? JSON.stringify(files) : null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /api/training/:id:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE event
router.delete("/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM training_events WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/training/:id:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
