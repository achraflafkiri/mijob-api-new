// server.js

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIO = require('socket.io');

const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { initializeSocketIO } = require('./socket/socketHandler');

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);

// Socket.IO configuration
const io = socketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Initialize Socket.IO handlers
initializeSocketIO(io);

// Make io accessible to routes
app.set('io', io);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable for Socket.IO
}));
app.use(compression());

// Rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   message: 'Too many requests from this IP, please try again later.'
// });
// app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Static files
app.use('/uploads', express.static('uploads'));

// API Routes
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/missions', require('./routes/missions'));
app.use('/api/v1/partimers', require('./routes/partimer'));
app.use('/api/v1/messages', require('./routes/messages'));
app.use('/api/v1/conversations', require('./routes/conversations'));

// Health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'MIJOB API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0',
    socketIO: 'enabled'
  });
});

// API documentation endpoint
app.get('/api/v1', (req, res) => {
  res.json({
    success: true,
    message: 'MIJOB API v1',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      missions: '/api/v1/missions',
      messages: '/api/v1/messages',
      conversations: '/api/v1/conversations'
    }
  });
});

// 404 handler (should be before error handler)
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handling middleware (should be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(50));
  console.log(`🚀 MIJOB Server running in ${process.env.NODE_ENV} mode`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`💬 Socket.IO: Enabled`);
  console.log('='.repeat(50));
  console.log('');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log('❌ Unhandled Rejection at:', promise);
  console.log('❌ Reason:', err);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log('❌ Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated');
    mongoose.connection.close();
  });
});

module.exports = { app, server, io };