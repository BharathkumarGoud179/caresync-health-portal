const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Load environment variables
dotenv.config();

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET is not set. Tokens are signed with an insecure development fallback.');
}

// Connect to Database
connectDB();

const app = express();

// Basic security headers (no extra dependency needed for this small app)
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Middlewares
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(cors());

// Serve static assets from 'public'
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/prescriptions', require('./routes/prescriptionRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/doctors', require('./routes/doctorRoutes'));

// JSON 404 for unknown API routes (including non-GET requests)
app.use('/api', notFound);

// Route views
app.get('/patient', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'patient-dashboard.html'));
});

app.get('/doctor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'doctor-dashboard.html'));
});

app.get('*', (req, res) => {
  // If not an API route and not static file, serve index.html
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ success: false, message: 'API endpoint not found' });
  }
});

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`
======================================================
  🩺 CareSync - Medical Records & Care Compliance Portal
======================================================
  🚀 Server running in ${process.env.NODE_ENV || 'development'} mode
  🌐 Web Application: http://localhost:${PORT}
  👨‍⚕️ Doctor Portal:   http://localhost:${PORT}/doctor
  🧑‍🦱 Patient Portal:  http://localhost:${PORT}/patient
======================================================
`);
});

// Graceful shutdown so nodemon/terminal restarts close the HTTP server cleanly.
const shutdown = (signal) => {
  console.log(`\n${signal} received. Closing server...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Rejection: ${err && err.message ? err.message : err}`);
});
