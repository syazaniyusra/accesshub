const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const db = require("./db");
const bcrypt = require("bcryptjs");

const app = express();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= SERVE FRONTEND FILES =================
// Serve from public/public due to GitHub upload structure
app.use(express.static(path.join(__dirname, "public", "public")));
app.use(express.static(path.join(__dirname, "public")));

// ================= ROUTES =================
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/user"));
app.use("/api/departments", require("./routes/departments"));
app.use("/api/links", require("./routes/links"));

// ================= FRONTEND FALLBACK =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "public", "login.html"));
});

// ================= 404 HANDLER =================
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ================= GLOBAL ERROR HANDLER =================
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// ================= SETUP DATABASE =================
async function setupDatabase() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) DEFAULT '',
        email VARCHAR(255),
        password VARCHAR(255),
        role VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add name column if it does not exist (for existing deployments)
    try {
      await db.query("ALTER TABLE users ADD COLUMN name VARCHAR(255) DEFAULT '' AFTER id");
      console.log("Name column added to users table");
    } catch (e) {
      // Column already exists, ignore
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS links (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        url VARCHAR(255),
        department_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS user_departments (
        user_id INT,
        department_id INT
      )
    `);

    console.log("✅ All tables ready");

    const [dep] = await db.query("SELECT * FROM departments");
    if (dep.length === 0) {
      await db.query(`INSERT INTO departments (name) VALUES ('IT'), ('HR'), ('Finance')`);
      console.log("✅ Default departments created");
    }

    const [links] = await db.query("SELECT * FROM links");
    if (links.length === 0) {
      await db.query(`INSERT INTO links (name, url, department_id) VALUES ('Google', 'https://google.com', 1)`);
      console.log("✅ Sample link created");
    }

    const [users] = await db.query("SELECT * FROM users WHERE email = 'admin@gmail.com'");
    if (users.length === 0) {
      const hash = await bcrypt.hash("123456", 10);
      await db.query(`INSERT INTO users (email, password, role) VALUES (?, ?, ?)`, ["admin@gmail.com", hash, "admin"]);
      console.log("✅ Default admin created: admin@gmail.com / 123456");
    }

  } catch (err) {
    console.error("❌ DB SETUP ERROR:", err.message);
  }
}

// ================= START SERVER =================
const PORT = process.env.PORT || 3000;

setupDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 AccessHub running on port ${PORT}`);
  });
});
