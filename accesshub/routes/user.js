const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcryptjs");

// =====================================
// GET ALL USERS + DEPARTMENTS
// =====================================
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        d.id AS department_id,
        d.name AS department_name
      FROM users u
      LEFT JOIN user_departments ud ON u.id = ud.user_id
      LEFT JOIN departments d ON d.id = ud.department_id
    `);

    const usersMap = {};

    rows.forEach(row => {
      if (!usersMap[row.id]) {
        usersMap[row.id] = {
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.role,
          departments: []
        };
      }

      if (row.department_id) {
        usersMap[row.id].departments.push({
          id: row.department_id,
          name: row.department_name
        });
      }
    });

    res.json(Object.values(usersMap));

  } catch (err) {
    console.error("USERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// =====================================
// CREATE USER
// =====================================
router.post("/", async (req, res) => {
  try {
    const { name, email, password, role, departments } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email & password required" });
    }

    const [existing] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name || "", email, hashedPassword, role || "user"]
    );

    const userId = result.insertId;

    if (departments && departments.length > 0) {
      for (const depId of departments) {
        await db.query(
          "INSERT INTO user_departments (user_id, department_id) VALUES (?, ?)",
          [userId, depId]
        );
      }
    }

    res.json({ message: "User created successfully" });

  } catch (err) {
    console.error("CREATE USER ERROR:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// =====================================
// UPDATE USER
// =====================================
router.put("/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, password, departments } = req.body;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.query(
        "UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?",
        [name || "", email, hashedPassword, userId]
      );
    } else {
      await db.query(
        "UPDATE users SET name = ?, email = ? WHERE id = ?",
        [name || "", email, userId]
      );
    }

    await db.query("DELETE FROM user_departments WHERE user_id = ?", [userId]);

    if (departments && departments.length > 0) {
      for (const depId of departments) {
        await db.query(
          "INSERT INTO user_departments (user_id, department_id) VALUES (?, ?)",
          [userId, depId]
        );
      }
    }

    res.json({ message: "User updated successfully" });

  } catch (err) {
    console.error("UPDATE USER ERROR:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// =====================================
// DELETE USER
// =====================================
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    await db.query("DELETE FROM user_departments WHERE user_id = ?", [userId]);
    await db.query("DELETE FROM users WHERE id = ?", [userId]);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// =====================================
// GET SINGLE USER
// =====================================
router.get("/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    const [rows] = await db.query(`
      SELECT 
        u.id, u.name, u.email, u.role,
        d.id AS department_id,
        d.name AS department_name
      FROM users u
      LEFT JOIN user_departments ud ON u.id = ud.user_id
      LEFT JOIN departments d ON d.id = ud.department_id
      WHERE u.id = ?
    `, [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = {
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email,
      role: rows[0].role,
      departments: rows
        .filter(r => r.department_id)
        .map(r => ({ id: r.department_id, name: r.department_name }))
    };

    res.json(user);

  } catch (err) {
    console.error("FETCH USER ERROR:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// =====================================
// GET USER'S DEPARTMENTS
// =====================================
router.get("/:id/departments", async (req, res) => {
  try {
    const userId = req.params.id;

    const [rows] = await db.query(`
      SELECT d.id, d.name
      FROM departments d
      JOIN user_departments ud ON d.id = ud.department_id
      WHERE ud.user_id = ?
    `, [userId]);

    res.json(rows);

  } catch (err) {
    console.error("FETCH USER DEPARTMENTS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch user departments" });
  }
});

// =====================================
// CHANGE PASSWORD
// =====================================
router.post("/:id/change-password", async (req, res) => {
  try {
    const userId = req.params.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Both current and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    // Fetch current hashed password
    const [rows] = await db.query(
      "SELECT password FROM users WHERE id = ?",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const match = await bcrypt.compare(currentPassword, rows[0].password);

    if (!match) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Hash and save new password
    const hashed = await bcrypt.hash(newPassword, 10);

    await db.query(
      "UPDATE users SET password = ? WHERE id = ?",
      [hashed, userId]
    );

    res.json({ message: "Password updated successfully" });

  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// =====================================
// EXPORT
// =====================================
module.exports = router;
