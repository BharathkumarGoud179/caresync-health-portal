const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const Message = require('./models/Message');

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Make io accessible to all Express controllers
app.set('io', io);

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/sharing', require('./routes/sharingRoutes'));

// Route views
app.get('/patient', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'patient-dashboard.html'));
});

app.get('/doctor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'doctor-dashboard.html'));
});

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ success: false, message: 'API endpoint not found' });
  }
});

// Socket.io Real-time Chat & WebRTC Signaling
const onlineUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  // User registers their online presence
  socket.on('user-online', (userId) => {
    if (userId) {
      socket.userId = userId;
      onlineUsers.set(userId, socket.id);
      socket.join(userId);
    }
  });

  // 1. Text Chat Message
  socket.on('send-message', async (data) => {
    try {
      const { senderId, recipientId, text } = data;
      if (!senderId || !recipientId || !text) return;

      const savedMsg = await Message.create({
        sender: senderId,
        recipient: recipientId,
        text: text.trim()
      });

      // Emit to recipient if online
      io.to(recipientId).emit('receive-message', savedMsg);
      // Confirm back to sender
      socket.emit('message-sent', savedMsg);
    } catch (err) {
      console.error('Socket message error:', err);
    }
  });

  // 2. WebRTC Voice / Video Calling Signaling
  // A. Caller initiates call
  socket.on('call-user', (data) => {
    const { userToCall, signalData, from, callerName, callType } = data;
    io.to(userToCall).emit('incoming-call', {
      signal: signalData,
      from,
      callerName,
      callType: callType || 'video'
    });
  });

  // B. Callee answers call
  socket.on('answer-call', (data) => {
    const { to, signal } = data;
    io.to(to).emit('call-accepted', { signal });
  });

  // C. Exchange ICE Candidates
  socket.on('ice-candidate', (data) => {
    const { target, candidate } = data;
    io.to(target).emit('ice-candidate', { candidate });
  });

  // D. End or Cancel Call
  socket.on('end-call', (data) => {
    const { to } = data;
    io.to(to).emit('call-ended');
  });

  // E. Reject Incoming Call
  socket.on('reject-call', (data) => {
    const { to } = data;
    io.to(to).emit('call-rejected');
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
    }
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`
======================================================
  🩺 CareSync - Medical Records & Care Compliance Portal
======================================================
  🚀 Server running in ${process.env.NODE_ENV || 'development'} mode
  🌐 Web Application: http://localhost:${PORT}
  👨‍⚕️ Doctor Portal:   http://localhost:${PORT}/doctor
  🧑‍🦱 Patient Portal:  http://localhost:${PORT}/patient
  💬 Real-Time Chat:  Socket.io active
  📹 Video/Voice Call: WebRTC Signaling active
======================================================
`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`Error: ${err.message}`);
});
