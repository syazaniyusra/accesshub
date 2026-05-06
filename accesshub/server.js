const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const db = require("./db");
const bcrypt = require("bcryptjs");

const app = express();

app.use(cors());
app.use(express.json());

// SERVE FRONTEND
app.use(express.static(path.join(__dirname, "public")));

// ROUTES
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/user"));
app.use("/api/departments", require("./routes/departments"));
app.use("/api/links", require("./routes/links"));

const bookingRoutes = require("./routes/booking");
app.use("/api/bookings", bookingRoutes);

// FRONTEND
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});
