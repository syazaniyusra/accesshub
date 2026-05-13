const express    = require("express");
const cors       = require("cors");
const path       = require("path");
const helmet     = require("helmet");
const rateLimit  = require("express-rate-limit");
const compression = require("compression");
require("dotenv").config();

const db  = require("./db");
const app = express();

/* ══════════════════════════════════════
   SECURITY & PERFORMANCE MIDDLEWARE
══════════════════════════════════════ */

// Security headers
app.use(helmet({
  contentSecurityPolicy: false // disable CSP so your frontend still loads
}));

// Compress all responses — faster loading for 400 staff
app.use(compression());

// CORS
app.use(cors());

// Parse JSON
app.use(express.json());

// Rate limiting — max 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." }
});
app.use("/api/", limiter);

// Stricter limit for login — max 10 attempts per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, please try again later." }
});
app.use("/api/auth/login", loginLimiter);

/* ══════════════════════════════════════
   STATIC FILES — with cache headers
══════════════════════════════════════ */
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: "1d",  // browser caches CSS/JS for 1 day
  etag: true
}));

/* ══════════════════════════════════════
   HEALTH CHECK — for UptimeRobot
══════════════════════════════════════ */
app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1"); // test DB connection
    res.json({
      status:   "ok",
      database: "connected",
      time:     new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status:   "error",
      database: "disconnected",
      error:    err.message
    });
  }
});

/* ══════════════════════════════════════
   API ROUTES
══════════════════════════════════════ */
app.use("/api/auth",        require("./routes/auth"));
app.use("/api/users",       require("./routes/user"));
app.use("/api/departments", require("./routes/departments"));
app.use("/api/links",       require("./routes/links"));
app.use("/api/bookings",    require("./routes/booking"));
app.use("/api/access-dept", require("./routes/accessDept"));

/* ══════════════════════════════════════
   FRONTEND
══════════════════════════════════════ */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

/* ══════════════════════════════════════
   404 HANDLER
══════════════════════════════════════ */
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/* ══════════════════════════════════════
   GLOBAL ERROR HANDLER
══════════════════════════════════════ */
app.use((err, req, res, next) => {
  console.error("Global error:", err.stack);
  res.status(500).json({ error: "Something went wrong" });
});

/* ══════════════════════════════════════
   START SERVER
══════════════════════════════════════ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

/* ══════════════════════════════════════
   PREVENT CRASH ON UNHANDLED ERRORS
══════════════════════════════════════ */
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
