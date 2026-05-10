const express = require("express");
const router  = express.Router();
const db      = require("../db");
const bcrypt  = require("bcryptjs");
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

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role))
      return res.status(403).json({ message: "Access denied" });
    next();
  };
}

// =====================================
// GET ALL USERS
// =====================================
router.get("/", verifyToken, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    let rows;

    if (req.user.role === "superadmin") {
      [rows] = await db.query(`
        SELECT u.id, u.name, u.email, u.role,
               d.id AS department_id, d.name AS department_name
        FROM users u
        LEFT JOIN user_departments ud ON u.id = ud.user_id
        LEFT JOIN departments d ON d.id = ud.department_id
        ORDER BY u.id
      `);
    } else {
      const [adminDepts] = await db.query(
        "SELECT department_id FROM user_departments WHERE user_id = ?",
        [req.user.id]
      );
      const deptIds = adminDepts.map(d => d.department_id);
      if (deptIds.length === 0) return res.json([]);

      [rows] = await db.query(`
        SELECT u.id, u.name, u.email, u.role,
               d.id AS department_id, d.name AS department_name
        FROM users u
        LEFT JOIN user_departments ud ON u.id = ud.user_id
        LEFT JOIN departments d ON d.id = ud.department_id
        WHERE u.id IN (
          SELECT DISTINCT user_id FROM user_departments WHERE department_id IN (?)
        ) AND u.role = 'user'
        ORDER BY u.id
      `, [deptIds]);
    }

    const usersMap = {};
    rows.forEach(row => {
      if (!usersMap[row.id]) {
        usersMap[row.id] = {
          id: row.id, name: row.name,
          email: row.email, role: row.role,
          departments: [], link_access: []
        };
      }
      if (row.department_id) {
        usersMap[row.id].departments.push({ id: row.department_id, name: row.department_name });
      }
    });

    const userIds = Object.keys(usersMap);
    if (userIds.length > 0) {
      const [accessRows] = await db.query(`
        SELECT uad.user_id, ad.id, ad.name
        FROM user_access_dept uad
        JOIN access_dept ad ON ad.id = uad.access_dept_id
        WHERE uad.user_id IN (?)
      `, [userIds]);

      accessRows.forEach(row => {
        if (usersMap[row.user_id]) {
          usersMap[row.user_id].link_access.push({ id: row.id, name: row.name });
        }
      });
    }

    res.json(Object.values(usersMap));

  } catch (err) {
    console.error("USERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// =====================================
// CREATE USER
// =====================================
router.post("/", verifyToken, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    let { name, email, password, role, departments, link_access } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email & password required" });
    }

    if (req.user.role === "admin") {
      role = "user";
      const [adminDepts] = await db.query(
        "SELECT department_id FROM user_departments WHERE user_id = ?",
        [req.user.id]
      );
      const allowedIds = adminDepts.map(d => String(d.department_id));
      departments = (departments || []).filter(id => allowedIds.includes(String(id)));
      link_access = (link_access || []).filter(id => allowedIds.includes(String(id)));
    }

    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
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

    if (link_access && link_access.length > 0) {
      for (const adId of link_access) {
        await db.query(
          "INSERT INTO user_access_dept (user_id, access_dept_id) VALUES (?, ?)",
          [userId, adId]
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
router.put("/:id", verifyToken, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const userId = req.params.id;
    let { name, email, password, departments, link_access } = req.body;

    if (req.user.role === "admin") {
      const [adminDepts] = await db.query(
        "SELECT department_id FROM user_departments WHERE user_id = ?",
        [req.user.id]
      );
      const allowedIds = adminDepts.map(d => String(d.department_id));
      const [targetDepts] = await db.query(
        "SELECT department_id FROM user_departments WHERE user_id = ?",
        [userId]
      );
      const targetIds = targetDepts.map(d => String(d.department_id));
      if (!targetIds.some(id => allowedIds.includes(id))) {
        return res.status(403).json({ message: "You can only edit users in your department" });
      }
      departments = (departments || []).filter(id => allowedIds.includes(String(id)));
      link_access = (link_access || []).filter(id => allowedIds.includes(String(id)));
    }

    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      await db.query("UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?",
        [name || "", email, hashed, userId]);
    } else {
      await db.query("UPDATE users SET name = ?, email = ? WHERE id = ?",
        [name || "", email, userId]);
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

    await db.query("DELETE FROM user_access_dept WHERE user_id = ?", [userId]);
    if (link_access && link_access.length > 0) {
      for (const adId of link_access) {
        await db.query(
          "INSERT INTO user_access_dept (user_id, access_dept_id) VALUES (?, ?)",
          [userId, adId]
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
router.delete("/:id", verifyToken, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const userId = req.params.id;

    if (req.user.role === "admin") {
      const [adminDepts] = await db.query(
        "SELECT department_id FROM user_departments WHERE user_id = ?", [req.user.id]);
      const allowedIds = adminDepts.map(d => String(d.department_id));
      const [targetDepts] = await db.query(
        "SELECT department_id FROM user_departments WHERE user_id = ?", [userId]);
      const targetIds = targetDepts.map(d => String(d.department_id));
      if (!targetIds.some(id => allowedIds.includes(id))) {
        return res.status(403).json({ message: "You can only delete users in your department" });
      }
    }

    await db.query("DELETE FROM user_departments WHERE user_id = ?", [userId]);
    await db.query("DELETE FROM user_access_dept WHERE user_id = ?", [userId]);
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
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.params.id;

    const [rows] = await db.query(`
      SELECT u.id, u.name, u.email, u.role,
             d.id AS department_id, d.name AS department_name
      FROM users u
      LEFT JOIN user_departments ud ON u.id = ud.user_id
      LEFT JOIN departments d ON d.id = ud.department_id
      WHERE u.id = ?
    `, [userId]);

    if (rows.length === 0) return res.status(404).json({ message: "User not found" });

    const user = {
      id: rows[0].id, name: rows[0].name,
      email: rows[0].email, role: rows[0].role,
      departments: rows.filter(r => r.department_id).map(r => ({ id: r.department_id, name: r.department_name })),
      link_access: []
    };

    const [accessRows] = await db.query(`
      SELECT ad.id, ad.name
      FROM user_access_dept uad
      JOIN access_dept ad ON ad.id = uad.access_dept_id
      WHERE uad.user_id = ?
    `, [userId]);
    user.link_access = accessRows;

    res.json(user);

  } catch (err) {
    console.error("FETCH USER ERROR:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// =====================================
// GET USER'S WORK DEPARTMENTS
// =====================================
router.get("/:id/departments", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT d.id, d.name FROM departments d
      JOIN user_departments ud ON d.id = ud.department_id
      WHERE ud.user_id = ?
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user departments" });
  }
});

// =====================================
// CHANGE PASSWORD
// =====================================
router.post("/:id/change-password", verifyToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: "Both passwords are required" });
    if (newPassword.length < 6)
      return res.status(400).json({ message: "New password must be at least 6 characters" });

    const [rows] = await db.query("SELECT password FROM users WHERE id = ?", [userId]);
    if (rows.length === 0) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(currentPassword, rows[0].password);
    if (!match) return res.status(401).json({ message: "Current password is incorrect" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query("UPDATE users SET password = ? WHERE id = ?", [hashed, userId]);
    res.json({ message: "Password updated successfully" });

  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

module.exports = router;
