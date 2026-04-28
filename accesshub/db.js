const mysql = require("mysql2/promise");

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "accesshub",
  port: process.env.DB_PORT || 3306
});

(async () => {
  try {
    const [rows] = await db.query("SELECT DATABASE() AS db");
    console.log("✅ Connected to database:", rows[0].db);
  } catch (err) {
    console.error("❌ DB CONNECTION ERROR:", err.message);
  }
})();

module.exports = db;
