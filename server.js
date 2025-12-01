// server.js - COMPLETE WITH ENHANCED DEBUGGING

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
app.use('/api/v1/subscriptions', require('./routes/subscriptions'));
app.use('/api/v1/tokens', require('./routes/tokens'));

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

/**
 * @route   GET /api/v1/debug/real-time-monitor
 * @desc    Real-time monitor HTML page (for debugging in browser)
 * @access  Public (for debugging)
 */
app.get('/api/v1/debug/real-time-monitor', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MIJOB - Real-time Socket.IO Monitor</title>
    <script src="https://cdn.jsdelivr.net/npm/socket.io-client@4.7.2/dist/socket.io.min.js"></script>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: #0f172a;
            color: #e2e8f0;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #334155;
        }
        .header h1 {
            color: #60a5fa;
            margin: 0;
            font-size: 2.5rem;
        }
        .header .subtitle {
            color: #94a3b8;
            font-size: 1.1rem;
            margin-top: 10px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: #1e293b;
            border-radius: 10px;
            padding: 20px;
            border-left: 4px solid #3b82f6;
        }
        .stat-card.online {
            border-left-color: #10b981;
        }
        .stat-card.offline {
            border-left-color: #ef4444;
        }
        .stat-card h3 {
            margin: 0 0 10px 0;
            font-size: 0.9rem;
            text-transform: uppercase;
            color: #94a3b8;
            letter-spacing: 1px;
        }
        .stat-card .value {
            font-size: 2rem;
            font-weight: bold;
            color: #ffffff;
        }
        .stat-card .label {
            font-size: 0.9rem;
            color: #cbd5e1;
            margin-top: 5px;
        }
        .users-table {
            background: #1e293b;
            border-radius: 10px;
            overflow: hidden;
            margin-bottom: 30px;
        }
        .table-header {
            background: #334155;
            padding: 15px 20px;
            font-weight: bold;
            display: grid;
            grid-template-columns: 1fr 2fr 1fr 2fr 1fr;
            gap: 15px;
        }
        .user-row {
            padding: 15px 20px;
            display: grid;
            grid-template-columns: 1fr 2fr 1fr 2fr 1fr;
            gap: 15px;
            border-bottom: 1px solid #334155;
            transition: background 0.3s;
        }
        .user-row:hover {
            background: #2d3748;
        }
        .user-row:last-child {
            border-bottom: none;
        }
        .status-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 8px;
        }
        .status-online {
            background: #10b981;
            animation: pulse 2s infinite;
        }
        .status-offline {
            background: #ef4444;
        }
        .connection-time {
            color: #94a3b8;
            font-size: 0.9rem;
        }
        .controls {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            transition: opacity 0.3s;
        }
        .btn:hover {
            opacity: 0.9;
        }
        .btn-primary {
            background: #3b82f6;
            color: white;
        }
        .btn-success {
            background: #10b981;
            color: white;
        }
        .btn-danger {
            background: #ef4444;
            color: white;
        }
        .log-container {
            background: #1e293b;
            border-radius: 10px;
            padding: 20px;
            margin-top: 20px;
            max-height: 300px;
            overflow-y: auto;
        }
        .log-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .log-header h3 {
            margin: 0;
            color: #60a5fa;
        }
        .log-entry {
            padding: 8px 0;
            border-bottom: 1px solid #334155;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.9rem;
        }
        .log-entry:last-child {
            border-bottom: none;
        }
        .log-time {
            color: #94a3b8;
            margin-right: 10px;
        }
        .log-info {
            color: #60a5fa;
        }
        .log-success {
            color: #10b981;
        }
        .log-error {
            color: #ef4444;
        }
        .log-warning {
            color: #f59e0b;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        .refresh-info {
            text-align: center;
            color: #94a3b8;
            margin-top: 20px;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 MIJOB - Real-time Socket.IO Monitor</h1>
            <div class="subtitle">Live monitoring of online users and socket connections</div>
        </div>
        
        <div class="controls">
            <button class="btn btn-primary" onclick="refreshData()">🔄 Refresh Data</button>
            <button class="btn btn-success" onclick="testBroadcast()">📢 Test Broadcast</button>
            <button class="btn btn-danger" onclick="clearLogs()">🗑️ Clear Logs</button>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card online">
                <h3>Online Users</h3>
                <div class="value" id="onlineUsersCount">0</div>
                <div class="label">Currently connected</div>
            </div>
            <div class="stat-card">
                <h3>Socket Connections</h3>
                <div class="value" id="socketConnections">0</div>
                <div class="label">Total connections</div>
            </div>
            <div class="stat-card">
                <h3>Server Uptime</h3>
                <div class="value" id="serverUptime">0s</div>
                <div class="label">Since last restart</div>
            </div>
            <div class="stat-card">
                <h3>Last Update</h3>
                <div class="value" id="lastUpdate">Just now</div>
                <div class="label">Data freshness</div>
            </div>
        </div>
        
        <div class="users-table">
            <div class="table-header">
                <div>Status</div>
                <div>User</div>
                <div>Type</div>
                <div>Socket ID</div>
                <div>Connected For</div>
            </div>
            <div id="usersList">
                <!-- Users will be populated here -->
                <div class="user-row" style="text-align: center; padding: 40px; color: #94a3b8;">
                    Loading users...
                </div>
            </div>
        </div>
        
        <div class="log-container">
            <div class="log-header">
                <h3>📋 Event Log</h3>
                <div style="color: #94a3b8; font-size: 0.9rem;">Live updates from server</div>
            </div>
            <div id="eventLog">
                <div class="log-entry log-info">
                    <span class="log-time">[00:00:00]</span>
                    Monitor initialized. Waiting for data...
                </div>
            </div>
        </div>
        
        <div class="refresh-info">
            Auto-refresh every 10 seconds • Last refresh: <span id="lastRefresh">Never</span>
        </div>
    </div>

    <script>
        let socket;
        let autoRefreshInterval;
        const SERVER_URL = window.location.origin.replace(/^http/, 'ws');
        
        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            connectSocket();
            refreshData();
            startAutoRefresh();
        });
        
        // Connect to Socket.IO
        function connectSocket() {
            try {
                socket = io(SERVER_URL, {
                    transports: ['websocket', 'polling']
                });
                
                socket.on('connect', () => {
                    addLog('✅ Connected to server via Socket.IO', 'success');
                });
                
                socket.on('disconnect', () => {
                    addLog('❌ Disconnected from server', 'error');
                });
                
                socket.on('debug:test-message', (data) => {
                    addLog("📢 Test broadcast received: ${data.message}", 'info');
                });
                
                socket.on('user:status-change', (data) => {
                    addLog("👤 User ${data.userName || data.userId} is now ${data.status}", 'info');
                });
                
                socket.on('connect_error', (error) => {
                    addLog("❌ Connection error: ${error.message}", 'error');
                });
                
            } catch (error) {
                addLog("❌ Failed to connect: ${error.message}", 'error');
            }
        }
        
        // Refresh data from server
        async function refreshData() {
            try {
                addLog('🔄 Refreshing data from server...', 'info');
                
                // Fetch online users
                const usersResponse = await fetch('/api/v1/debug/online-users');
                const usersData = await usersResponse.json();
                
                if (usersData.success) {
                    updateOnlineUsers(usersData);
                }
                
                // Fetch server stats
                const statsResponse = await fetch('/api/v1/debug/server-stats');
                const statsData = await statsResponse.json();
                
                if (statsData.success) {
                    updateServerStats(statsData);
                }
                
                updateLastRefresh();
                addLog('✅ Data refreshed successfully', 'success');
                
            } catch (error) {
                addLog("❌ Failed to refresh data: ${error.message}", 'error');
            }
        }
        
        // Update online users display
        function updateOnlineUsers(data) {
            document.getElementById('onlineUsersCount').textContent = data.count;
            
            const usersList = document.getElementById('usersList');
            
            if (data.count === 0) {
                usersList.innerHTML = "
                  <div class="user-row" style="text-align: center; padding: 40px; color: #94a3b8;">
                      No users currently online
                  </div>   
                ";
                return;
            }
            
            usersList.innerHTML = data.users.map(user => "
              <div class="user-row">
                    <div>
                        <span class="status-indicator status-online"></span>
                        Online
                    </div>
                    <div>
                        <strong>${user.userName || 'Unknown'}</strong>
                        <div style="font-size: 0.8rem; color: #94a3b8;">${user.userId}</div>
                    </div>
                    <div>
                        <span style="background: #475569; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">
                            ${user.userType || 'Unknown'}
                        </span>
                    </div>
                    <div style="font-family: monospace; font-size: 0.9rem; color: #cbd5e1;">
                        ${user.socketId}
                    </div>
                    <div class="connection-time">
                        ${formatTimeDiff(new Date(user.joinedAt))}
                    </div>
              </div>
            ").join('');
        }
        
        // Update server statistics
        function updateServerStats(data) {
            document.getElementById('socketConnections').textContent = data.socketIO.connections || 0;
            document.getElementById('serverUptime').textContent = formatSeconds(data.server.uptime);
            document.getElementById('lastUpdate').textContent = 'Just now';
        }
        
        // Test broadcast
        async function testBroadcast() {
            try {
                addLog('📢 Sending test broadcast...', 'info');
                const response = await fetch('/api/v1/debug/test-broadcast');
                const data = await response.json();
                
                if (data.success) {
                    addLog("✅ Test broadcast sent to ${ data.totalConnections } clients", 'success');
                }
            } catch (error) {
                addLog("❌ Failed to send test broadcast: ${ error.message }", 'error');
            }
        }
        
        // Add log entry
        function addLog(message, type = 'info') {
            const logContainer = document.getElementById('eventLog');
            const time = new Date().toLocaleTimeString();
            
            const logEntry = document.createElement('div');
            logEntry.className = "log - entry log - ${ type }";
            logEntry.innerHTML = "< span class="log-time" > [${ time }]</span > ${ message }";
            
            logContainer.prepend(logEntry);
            
            // Keep only last 50 logs
            const logs = logContainer.children;
            if (logs.length > 50) {
                logContainer.removeChild(logs[logs.length - 1]);
            }
        }
        
        // Clear logs
        function clearLogs() {
            document.getElementById('eventLog').innerHTML = '';
            addLog('🗑️ Logs cleared', 'warning');
        }
        
        // Start auto-refresh
        function startAutoRefresh() {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = setInterval(refreshData, 10000); // 10 seconds
        }
        
        // Update last refresh time
        function updateLastRefresh() {
            const now = new Date();
            document.getElementById('lastRefresh').textContent = now.toLocaleTimeString();
        }
        
        // Helper: Format time difference
        function formatTimeDiff(startTime) {
            const diff = Math.floor((new Date() - new Date(startTime)) / 1000);
            return formatSeconds(diff);
        }
        
        // Helper: Format seconds to human readable
        function formatSeconds(seconds) {
            if (seconds < 60) return seconds + 's';
            if (seconds < 3600) return Math.floor(seconds / 60) + 'm ' + (seconds % 60) + 's';
            return Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm';
        }
    </script>
</body>
</html>`;

  res.send(html);
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
app.get('/api/v1', (req, res) => {
  res.json({
    success: true,
    message: 'MIJOB API v1',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      missions: '/api/v1/missions',
      messages: '/api/v1/messages',
      conversations: '/api/v1/conversations',
      debug: {
        onlineUsers: '/api/v1/debug/online-users',
        socketConnections: '/api/v1/debug/socket-connections',
        serverStats: '/api/v1/debug/server-stats',
        realTimeMonitor: '/api/v1/debug/real-time-monitor'
      }
    }
  });
});

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
  console.log('');
  console.log('='.repeat(50));
  console.log(`🚀 MIJOB Server running in ${process.env.NODE_ENV} mode`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`💬 Socket.IO: Enabled`);
  console.log(`🔍 Debug endpoints available:`);
  console.log(`   • http://localhost:${PORT}/api/v1/debug/online-users`);
  console.log(`   • http://localhost:${PORT}/api/v1/debug/real-time-monitor`);
  console.log(`   • http://localhost:${PORT}/api/v1/debug/server-stats`);
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