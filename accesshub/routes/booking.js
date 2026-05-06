const express = require("express");
const router = express.Router();
const db = require("../db");

// =====================
// GET all rooms
// =====================
router.get("/rooms", async (req, res) => {
  try {

    const [rooms] = await db.query(`
      SELECT *
      FROM rooms
      WHERE is_active = 1
      ORDER BY name ASC
    `);

    res.json(rooms);

  } catch (err) {

    console.error("GET ROOMS ERROR:", err);

    res.status(500).json({
      error: err.message
    });
  }
});

// =====================
// GET all bookings (admin)
// =====================
router.get("/", async (req, res) => {

  try {

    const [bookings] = await db.query(`
      SELECT
        b.*,
        r.name AS room_name
      FROM bookings b
      JOIN rooms r
        ON b.room_id = r.id
      ORDER BY b.date DESC, b.start_time ASC
    `);

    res.json(bookings);

  } catch (err) {

    console.error("GET BOOKINGS ERROR:", err);

    res.status(500).json({
      error: err.message
    });
  }
});

// =====================
// GET bookings by user
// =====================
router.get("/user/:userId", async (req, res) => {

  try {

    const [bookings] = await db.query(`
      SELECT
        b.*,
        r.name AS room_name
      FROM bookings b
      JOIN rooms r
        ON b.room_id = r.id
      WHERE b.user_id = ?
      ORDER BY b.date DESC, b.start_time ASC
    `, [req.params.userId]);

    res.json(bookings);

  } catch (err) {

    console.error("GET USER BOOKINGS ERROR:", err);

    res.status(500).json({
      error: err.message
    });
  }
});

// =====================
// GET booked slots
// =====================
router.get("/slots", async (req, res) => {

  const { room_id, date } = req.query;

  if (!room_id || !date) {
    return res.status(400).json({
      error: "Missing room_id or date"
    });
  }

  try {

    const [slots] = await db.query(`
      SELECT
        start_time,
        end_time,
        status
      FROM bookings
      WHERE room_id = ?
      AND date = ?
      AND status != 'rejected'
    `, [room_id, date]);

    res.json(slots);

  } catch (err) {

    console.error("GET SLOTS ERROR:", err);

    res.status(500).json({
      error: err.message
    });
  }
});

// =====================
// CREATE booking
// =====================
router.post("/", async (req, res) => {

  try {

    let {
      room_id,
      user_id,

      event_name,

      // support BOTH frontend formats
      date,
      booking_date,

      start_time,
      end_time,

      duration_hours,
      duration_minutes,
      duration_mins,

      name,
      booker_name,

      department,
      phone

    } = req.body;

    // =====================
    // NORMALIZE DATA
    // =====================

    date = date || booking_date;

    name = name || booker_name;

    if (duration_mins && !duration_minutes) {
      duration_minutes = parseInt(duration_mins);
    }

    duration_hours =
      parseInt(duration_hours || 0);

    duration_minutes =
      parseInt(duration_minutes || 0);

    // =====================
    // AUTO CALCULATE END TIME
    // =====================

    if (!end_time && start_time) {

      const totalMinutes =
        (duration_hours * 60) + duration_minutes;

      const startObj =
        new Date(`2000-01-01T${start_time}:00`);

      startObj.setMinutes(
        startObj.getMinutes() + totalMinutes
      );

      end_time =
        startObj.toTimeString().slice(0,5);
    }

    // =====================
    // VALIDATION
    // =====================

    if (
      !room_id ||
      !user_id ||
      !event_name ||
      !date ||
      !start_time ||
      !end_time ||
      !name ||
      !department ||
      !phone
    ) {

      return res.status(400).json({
        error: "Please fill all required fields"
      });
    }

    // =====================
    // CHECK CONFLICT
    // =====================

    const [conflicts] = await db.query(`
      SELECT id
      FROM bookings
      WHERE room_id = ?
      AND date = ?
      AND status != 'rejected'
      AND (
        (start_time < ? AND end_time > ?)
        OR
        (start_time < ? AND end_time > ?)
        OR
        (start_time >= ? AND end_time <= ?)
      )
    `, [
      room_id,
      date,

      end_time,
      start_time,

      end_time,
      start_time,

      start_time,
      end_time
    ]);

    if (conflicts.length > 0) {

      return res.status(409).json({
        error: "This time slot is already booked"
      });
    }

    // =====================
    // INSERT BOOKING
    // =====================

    await db.query(`
      INSERT INTO bookings (
        room_id,
        user_id,
        event_name,
        date,
        start_time,
        end_time,
        duration_hours,
        duration_minutes,
        name,
        department,
        phone,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      room_id,
      user_id,
      event_name,
      date,
      start_time,
      end_time,
      duration_hours,
      duration_minutes,
      name,
      department,
      phone,
      "pending"
    ]);

    res.json({
      success: true,
      message: "Booking submitted successfully"
    });

  } catch (err) {

    console.error("CREATE BOOKING ERROR:", err);

    res.status(500).json({
      error: err.message
    });
  }
});

// =====================
// UPDATE booking status
// =====================
router.put("/:id/status", async (req, res) => {

  const { status } = req.body;

  if (!["approved", "rejected", "pending"].includes(status)) {

    return res.status(400).json({
      error: "Invalid status"
    });
  }

  try {

    await db.query(`
      UPDATE bookings
      SET status = ?
      WHERE id = ?
    `, [status, req.params.id]);

    res.json({
      message: "Status updated"
    });

  } catch (err) {

    console.error("UPDATE STATUS ERROR:", err);

    res.status(500).json({
      error: err.message
    });
  }
});

// =====================
// DELETE booking
// =====================
router.delete("/:id", async (req, res) => {

  try {

    await db.query(`
      DELETE FROM bookings
      WHERE id = ?
    `, [req.params.id]);

    res.json({
      message: "Booking deleted"
    });

  } catch (err) {

    console.error("DELETE BOOKING ERROR:", err);

    res.status(500).json({
      error: err.message
    });
  }
});

module.exports = router;
