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

// Body parsing middleware - INCREASE LIMITS FOR FILE UPLOADS
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Socket.IO configuration
const io = socketIO(server, {
  cors: {
    origin: "*",
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'POST', 'PUT'],
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Initialize Socket.IO handlers
initializeSocketIO(io);

// Store io globally for debugging
global.io = io;

// Make io accessible to routes
app.set('io', io);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable for Socket.IO
}));
app.use(compression());

// Rate limiting - disabled for debugging
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
  origin: "*",
  methods: ['GET', 'POST', 'DELETE', 'POST', 'PUT'],
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
app.use('/api/v1/subscriptions', require('./routes/subscriptions'));
app.use('/api/v1/tokens', require('./routes/tokens'));
app.use('/api/v1/support', require('./routes/support'));
app.use('/api/v1/payment', require('./routes/cmiPaymentRoutes'));
app.use('/api/v1/entreprise', require('./routes/entreprise'));
app.use('/api/v1/particulier', require('./routes/particulier'));

// ============================================
// DEBUGGING ENDPOINTS
// ============================================

/**
 * @route   GET /api/v1/debug/online-users
 * @desc    Get all currently online users with detailed information
 * @access  Public (for debugging)
 */
app.get('/api/v1/debug/online-users', (req, res) => {
  try {
    const { getOnlineUsersDetailed } = require('./socket/socketHandler');
    const onlineUsers = getOnlineUsersDetailed();

    console.log('📊 DEBUG: Online users requested');
    console.log('📊 Total online users:', onlineUsers.length);

    res.json({
      success: true,
      timestamp: new Date(),
      serverTime: new Date().toISOString(),
      count: onlineUsers.length,
      users: onlineUsers,
      stats: {
        totalUsers: onlineUsers.length,
        byUserType: onlineUsers.reduce((acc, user) => {
          acc[user.userType] = (acc[user.userType] || 0) + 1;
          return acc;
        }, {}),
        averageConnectionTime: onlineUsers.length > 0
          ? onlineUsers.reduce((sum, user) => {
            const connectionTime = new Date() - new Date(user.joinedAt);
            return sum + connectionTime;
          }, 0) / onlineUsers.length / 1000
          : 0
      }
    });
  } catch (error) {
    console.error('❌ DEBUG ERROR:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @route   GET /api/v1/debug/socket-connections
 * @desc    Get all active socket connections
 * @access  Public (for debugging)
 */
app.get('/api/v1/debug/socket-connections', (req, res) => {
  try {
    const { getOnlineUsersDetailed } = require('./socket/socketHandler');
    const onlineUsers = getOnlineUsersDetailed();

    // Get all connected sockets
    const allSockets = Array.from(io.sockets.sockets.values());

    const connections = allSockets.map(socket => ({
      id: socket.id,
      userId: socket.userId || 'Not authenticated',
      userName: socket.userName || 'Unknown',
      userType: socket.userType || 'Unknown',
      connectedAt: socket.handshake.time,
      rooms: Array.from(socket.rooms),
      transport: socket.conn.transport.name,
      remoteAddress: socket.handshake.address,
      headers: {
        'user-agent': socket.handshake.headers['user-agent'],
        origin: socket.handshake.headers.origin
      }
    }));

    console.log('📊 DEBUG: Socket connections requested');
    console.log('📊 Total socket connections:', connections.length);

    res.json({
      success: true,
      timestamp: new Date(),
      connections: {
        total: connections.length,
        authenticated: connections.filter(c => c.userId !== 'Not authenticated').length,
        anonymous: connections.filter(c => c.userId === 'Not authenticated').length,
        details: connections
      },
      onlineUsers: {
        total: onlineUsers.length,
        users: onlineUsers.map(u => ({
          userId: u.userId,
          userName: u.userName,
          userType: u.userType,
          socketId: u.socketId,
          connectedFor: Math.round((new Date() - new Date(u.joinedAt)) / 1000) + 's'
        }))
      }
    });
  } catch (error) {
    console.error('❌ DEBUG ERROR:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/debug/server-stats
 * @desc    Get server statistics
 * @access  Public (for debugging)
 */
app.get('/api/v1/debug/server-stats', async (req, res) => {
  try {
    const { getOnlineUsersDetailed, getOnlineUsersCount } = require('./socket/socketHandler');
    const User = require('./models/User');
    const Conversation = require('./models/Conversation');
    const Message = require('./models/Message');

    const onlineUsers = getOnlineUsersDetailed();

    // Get database statistics
    const totalUsers = await User.countDocuments({});
    const totalActiveUsers = await User.countDocuments({ active: true });
    const totalConversations = await Conversation.countDocuments({});
    const totalMessages = await Message.countDocuments({});

    // Memory usage
    const memoryUsage = process.memoryUsage();

    res.json({
      success: true,
      timestamp: new Date(),
      server: {
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
        }
      },
      socketIO: {
        onlineUsers: getOnlineUsersCount(),
        connections: io.engine.clientsCount,
        pendingClients: io.engine.clientsCount - getOnlineUsersCount()
      },
      database: {
        totalUsers,
        totalActiveUsers,
        totalConversations,
        totalMessages,
        onlineUsersPercentage: totalUsers > 0 ? ((onlineUsers.length / totalUsers) * 100).toFixed(2) + '%' : '0%'
      },
      onlineUsersDetails: onlineUsers.map(user => ({
        userId: user.userId,
        userName: user.userName,
        userType: user.userType,
        socketId: user.socketId,
        connectedAt: user.joinedAt,
        connectedFor: Math.round((new Date() - new Date(user.joinedAt)) / 1000) + 's',
        lastSeen: user.lastSeen
      }))
    });
  } catch (error) {
    console.error('❌ DEBUG ERROR:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/debug/test-broadcast
 * @desc    Test broadcast to all connected clients
 * @access  Public (for debugging)
 */
app.get('/api/v1/debug/test-broadcast', (req, res) => {
  try {
    const { getOnlineUsersDetailed } = require('./socket/socketHandler');
    const onlineUsers = getOnlineUsersDetailed();

    // Broadcast test message
    io.emit('debug:test-message', {
      message: 'Test broadcast from server',
      timestamp: new Date(),
      onlineUsersCount: onlineUsers.length,
      serverTime: new Date().toISOString()
    });

    console.log('📢 DEBUG: Test broadcast sent to', io.engine.clientsCount, 'clients');

    res.json({
      success: true,
      message: `Test broadcast sent to ${io.engine.clientsCount} connected clients`,
      timestamp: new Date(),
      onlineUsersCount: onlineUsers.length,
      totalConnections: io.engine.clientsCount
    });
  } catch (error) {
    console.error('❌ DEBUG ERROR:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/debug/user/:userId/status
 * @desc    Check specific user's online status
 * @access  Public (for debugging)
 */
app.get('/api/v1/debug/user/:userId/status', async (req, res) => {
  try {
    const { isUserOnline } = require('./socket/socketHandler');
    const { userId } = req.params;

    const User = require('./models/User');
    const user = await User.findById(userId).select('_id email userType nomComplet firstName lastName isOnline lastSeen');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isOnline = isUserOnline(userId);
    const { getOnlineUsersDetailed } = require('./socket/socketHandler');
    const onlineUsers = getOnlineUsersDetailed();
    const userConnection = onlineUsers.find(u => u.userId === userId);

    res.json({
      success: true,
      timestamp: new Date(),
      user: {
        _id: user._id,
        email: user.email,
        userType: user.userType,
        name: user.nomComplet || `${user.firstName} ${user.lastName}`,
        isOnlineFromDB: user.isOnline || false,
        lastSeenFromDB: user.lastSeen
      },
      socketStatus: {
        isOnline: isOnline,
        socketId: userConnection?.socketId || null,
        connectedAt: userConnection?.joinedAt || null,
        connectedFor: userConnection ? Math.round((new Date() - new Date(userConnection.joinedAt)) / 1000) + 's' : null,
        lastSeen: userConnection?.lastSeen || null
      },
      debug: {
        totalOnlineUsers: onlineUsers.length,
        userFoundInOnlineList: !!userConnection,
        serverTime: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ DEBUG ERROR:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/v1/debug/force-disconnect/:userId
 * @desc    Force disconnect a specific user (for debugging)
 * @access  Public (for debugging)
 */
app.post('/api/v1/debug/force-disconnect/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const { getOnlineUsersDetailed } = require('./socket/socketHandler');
    const onlineUsers = getOnlineUsersDetailed();

    const userConnection = onlineUsers.find(u => u.userId === userId);

    if (!userConnection) {
      return res.status(404).json({
        success: false,
        message: 'User not currently online'
      });
    }

    // Find and disconnect the socket
    const socket = io.sockets.sockets.get(userConnection.socketId);
    if (socket) {
      socket.disconnect(true);
      console.log(`🔌 DEBUG: Force disconnected user ${userId} (${userConnection.userName})`);
    }

    res.json({
      success: true,
      message: `Force disconnected user ${userId}`,
      user: {
        userId: userConnection.userId,
        userName: userConnection.userName,
        socketId: userConnection.socketId
      },
      timestamp: new Date()
    });
  } catch (error) {
    console.error('❌ DEBUG ERROR:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/', (req, res) => {
  const { getOnlineUsersCount } = require('./socket/socketHandler');

  res.json({
    success: true,
    message: 'MIJOB API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0',
    socketIO: 'enabled',
    onlineUsers: getOnlineUsersCount(),
    debugEndpoints: {
      onlineUsers: '/api/v1/debug/online-users',
      socketConnections: '/api/v1/debug/socket-connections',
      serverStats: '/api/v1/debug/server-stats',
      realTimeMonitor: '/api/v1/debug/real-time-monitor',
      testBroadcast: '/api/v1/debug/test-broadcast'
    }
  });
});

// API documentation endpoint
// app.get('/api/v1', (req, res) => {
//   res.json({
//     success: true,
//     message: 'MIJOB API v1',
//     endpoints: {
//       auth: '/api/v1/auth',
//       users: '/api/v1/users',
//       missions: '/api/v1/missions',
//       messages: '/api/v1/messages',
//       conversations: '/api/v1/conversations',
//       debug: {
//         onlineUsers: '/api/v1/debug/online-users',
//         socketConnections: '/api/v1/debug/socket-connections',
//         serverStats: '/api/v1/debug/server-stats',
//         realTimeMonitor: '/api/v1/debug/real-time-monitor'
//       }
//     }
//   });
// });

// 404 handler (should be before error handler)
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    suggestion: 'Try /api/v1/debug/online-users to see online users'
  });
});



// Error handling middleware (should be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  // console.log('');
  // console.log('='.repeat(50));
  // console.log(`🚀 MIJOB Server running in ${process.env.NODE_ENV} mode`);
  // console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`💬 Socket.IO: Enabled`);
  console.log(`🔍 Debug endpoints available:`);
  // console.log(`   • http://localhost:${PORT}/api/v1/debug/online-users`);
  // console.log(`   • http://localhost:${PORT}/api/v1/debug/real-time-monitor`);
  // console.log(`   • http://localhost:${PORT}/api/v1/debug/server-stats`);
  // console.log('='.repeat(50));
  // console.log('');
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