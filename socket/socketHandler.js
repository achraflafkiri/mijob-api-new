// socket/socketHandler.js - FIXED VERSION WITH BETTER ONLINE TRACKING

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

// Store online users with their socket IDs
const onlineUsers = new Map(); // userId -> { socketId, lastSeen, userName, userType, joinedAt }

// Store user connections (multiple devices support)
const userConnections = new Map(); // userId -> Set of socketIds

const initializeSocketIO = (io) => {
  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      // console.log('🔐 Socket authentication attempt...');
      
      if (!token) {
        console.error('❌ No token provided');
        return next(new Error('Authentication error: No token provided'));
      }

      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // console.log("decoded.id =============> ", decoded)
      
      const user = await User.findById(decoded.id);
      
      // console.log("user =============> ", user);

      // if (!user || !user.active) {
      //   console.error('❌ User not found or inactive:', decoded.id);
      //   return next(new Error('Authentication error: User not found or inactive'));
      // }
      
      socket.userId = user._id.toString();
      socket.userType = user.userType;
      socket.userName = user.fullName || user.nomComplet || user.email;
      
      // console.log('✅ Socket authenticated:', socket.userName, socket.userId);
      
      next();
    } catch (error) {
      console.error('❌ Socket authentication error:', error.message);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    // console.log('');
    // console.log('='.repeat(50));
    // console.log(`✅ User connected: ${socket.userName} (${userId})`);
    // console.log(`📍 Socket ID: ${socket.id}`);

    // ============================================
    // MARK USER AS ONLINE (Multi-device support)
    // ============================================
    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }
    userConnections.get(userId).add(socket.id);

    onlineUsers.set(userId, {
      socketId: socket.id,
      lastSeen: new Date(),
      userName: socket.userName,
      userType: socket.userType,
      joinedAt: new Date()
    });

    // Update user document
    User.findByIdAndUpdate(userId, {
      $set: {
        isOnline: true,
        socketId: socket.id,
        lastSeen: new Date()
      }
    }).catch(err => console.error('❌ Error updating user online status:', err));

    // console.log(`👥 Online users count: ${onlineUsers.size}`);
    // console.log(`👥 Online user IDs:`, Array.from(onlineUsers.keys()));
    // console.log(`📱 Active connections for user ${userId}:`, userConnections.get(userId).size);
    // console.log('='.repeat(50));
    // console.log('');

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Broadcast to all that this user is online
    broadcastUserStatus(io, userId, 'online', socket.userName);

    // ============================================
    // GET ALL ONLINE USERS (for initial load) - FIXED
    // ============================================
    socket.on('get:online-users', async (callback) => {
      try {
        // console.log(`👥 User ${userId} requested online users list`);
        // console.log(`👥 Current online users in Map:`, Array.from(onlineUsers.keys()));
        
        // Get online users - RETURN ARRAY OF USER IDS
        const onlineUserIds = Array.from(onlineUsers.keys());
        
        // console.log(`📋 Returning ${onlineUserIds.length} online user IDs:`, onlineUserIds);
        
        if (callback) {
          callback({
            success: true,
            onlineUsers: onlineUserIds, // ✅ RETURN ARRAY OF IDs, NOT OBJECTS
            count: onlineUserIds.length,
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error('❌ Error getting online users:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    // ============================================
    // GET USERS WITH STATUS (Online/Offline) - FIXED
    // ============================================
    socket.on('get:users-with-status', async (data, callback) => {
      try {
        const { userIds } = data;
        
        if (!Array.isArray(userIds)) {
          return callback?.({ success: false, error: 'Invalid user IDs array' });
        }

        // console.log(`👥 Getting status for ${userIds.length} users`);
        
        const users = await User.find({
          _id: { $in: userIds }
        }).select('_id firstName lastName nomComplet raisonSociale profilePicture userType isOnline lastSeen privacy');
        
        const usersWithStatus = users.map(user => {
          const userId = user._id.toString();
          const isCurrentlyOnline = onlineUsers.has(userId);
          const canShowStatus = user.privacy?.showOnlineStatus !== false;
          
          // console.log(`  👤 User ${user.fullName || user.nomComplet}: Online=${isCurrentlyOnline}, CanShow=${canShowStatus}`);
          
          return {
            _id: user._id,
            name: user.fullName,
            userType: user.userType,
            profilePicture: user.profilePicture,
            isOnline: canShowStatus ? isCurrentlyOnline : null,
            lastSeen: user.lastSeen,
            privacy: user.privacy,
            showStatus: canShowStatus
          };
        });

        // console.log(`✅ Returning ${usersWithStatus.length} users with status`);

        callback?.({
          success: true,
          users: usersWithStatus
        });
        
      } catch (error) {
        console.error('❌ Error getting users with status:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    // ============================================
    // GET ALL USERS WITH ONLINE STATUS - FIXED
    // ============================================
    socket.on('get:all-users-status', async (callback) => {
      try {
        // console.log(`👥 User ${userId} requested all users with status`);
        
        // Get all users (paginate if needed)
        const users = await User.find({
          active: true,
          _id: { $ne: userId } // Exclude current user
        }).select('_id firstName lastName nomComplet raisonSociale profilePicture userType isOnline lastSeen privacy createdAt')
          .limit(100) // Limit for performance
          .sort({ createdAt: -1 });

        const onlineUserIds = Array.from(onlineUsers.keys());
        // console.log(`📊 Currently online users:`, onlineUserIds);

        const usersWithStatus = users.map(user => {
          const userId = user._id.toString();
          const isCurrentlyOnline = onlineUsers.has(userId);
          const canShowStatus = user.privacy?.showOnlineStatus !== false;
          
          return {
            _id: user._id,
            name: user.fullName,
            userType: user.userType,
            profilePicture: user.profilePicture,
            isOnline: canShowStatus ? isCurrentlyOnline : null,
            lastSeen: user.lastSeen,
            showStatus: canShowStatus,
            active: user.active
          };
        });

        // console.log(`📋 Returning ${usersWithStatus.length} users with status`);
        // console.log(`📊 Online count: ${usersWithStatus.filter(u => u.isOnline).length}`);
        
        callback?.({
          success: true,
          users: usersWithStatus,
          totalOnline: onlineUserIds.length,
          onlineUserIds: onlineUserIds // ✅ ADD THIS FOR DEBUGGING
        });
        
      } catch (error) {
        console.error('❌ Error getting all users status:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    // ============================================
    // UPDATE PRIVACY SETTINGS
    // ============================================
    socket.on('update:privacy-settings', async (data, callback) => {
      try {
        const { showOnlineStatus, showLastSeen } = data;
        
        await User.findByIdAndUpdate(userId, {
          $set: {
            'privacy.showOnlineStatus': showOnlineStatus,
            'privacy.showLastSeen': showLastSeen
          }
        });

        // console.log(`🔒 User ${userId} updated privacy settings:`, { showOnlineStatus, showLastSeen });
        
        // Notify conversation participants about status change
        broadcastUserStatus(io, userId, showOnlineStatus ? 'online' : 'hidden');
        
        callback?.({ success: true });
        
      } catch (error) {
        console.error('❌ Error updating privacy settings:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    // ============================================
    // PING - KEEP ALIVE
    // ============================================
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
      
      // Update last seen
      const userData = onlineUsers.get(userId);
      if (userData) {
        userData.lastSeen = new Date();
        onlineUsers.set(userId, userData);
      }
    });

    // ============================================
    // JOIN CONVERSATION WITH ONLINE STATUS - FIXED
    // ============================================
    socket.on('conversation:join', async (conversationId, callback) => {
      try {
        // console.log(`📥 User ${userId} (${socket.userName}) joining conversation: ${conversationId}`);

        const conversation = await Conversation.findById(conversationId)
          .populate('participants');

        if (!conversation) {
          console.error(`❌ Conversation not found: ${conversationId}`);
          return callback?.({ 
            success: false, 
            error: 'Conversation non trouvée' 
          });
        }

        const isParticipant = conversation.participants.some(
          p => p._id.toString() === userId
        );

        if (!isParticipant) {
          console.error(`❌ User ${userId} is not a participant in ${conversationId}`);
          return callback?.({ 
            success: false, 
            error: 'Accès non autorisé' 
          });
        }

        socket.join(`conversation:${conversationId}`);
        // console.log(`✅ User ${userId} joined room: conversation:${conversationId}`);
        
        // Auto-mark messages as read
        const markedCount = await Message.markAllAsRead(conversationId, userId);
        await conversation.resetUnread(userId);

        if (markedCount > 0) {
          // console.log(`📖 Auto-marked ${markedCount} messages as read`);
          io.to(`conversation:${conversationId}`).emit('conversation:unread-reset', {
            conversationId,
            userId,
            markedAsRead: markedCount,
            timestamp: new Date()
          });
        }

        // 🆕 Emit current user's online status to conversation
        io.to(`conversation:${conversationId}`).emit('user:status-change', {
          userId,
          status: 'online',
          userName: socket.userName,
          timestamp: new Date()
        });

        // 🆕 Get and send online users in this conversation - RETURN IDs
        const onlineParticipantIds = conversation.participants
          .filter(p => {
            const participantId = p._id.toString();
            const isOnline = onlineUsers.has(participantId);
            const canShow = p.privacy?.showOnlineStatus !== false;
            
            // console.log(`  👤 Participant ${p.fullName || p.nomComplet} (${participantId}): Online=${isOnline}, CanShow=${canShow}`);
            
            return isOnline && canShow && participantId !== userId;
          })
          .map(p => p._id.toString()); // ✅ RETURN IDs, NOT OBJECTS

        // console.log(`👥 Online participants in conversation ${conversationId}:`, onlineParticipantIds);

        socket.emit('conversation:online-users', {
          conversationId,
          onlineUsers: onlineParticipantIds, // ✅ ARRAY OF IDs
          timestamp: new Date()
        });

        callback?.({ 
          success: true, 
          markedAsRead: markedCount,
          onlineUsers: onlineParticipantIds // ✅ ARRAY OF IDs
        });

      } catch (error) {
        console.error('❌ Error joining conversation:', error);
        callback?.({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // ============================================
    // LEAVE CONVERSATION
    // ============================================
    socket.on('conversation:leave', (conversationId) => {
      // console.log(`👋 User ${userId} leaving conversation: ${conversationId}`);
      socket.leave(`conversation:${conversationId}`);
    });

    // ============================================
    // SEND MESSAGE
    // ============================================
    socket.on('message:send', async (data, callback) => {
      try {
        const { conversationId, content, type = 'text', attachments = [] } = data;

        // console.log(`📤 User ${userId} sending message to ${conversationId}`);

        if (!conversationId || !content) {
          return callback?.({ 
            success: false, 
            error: 'ID de conversation et contenu requis' 
          });
        }

        const conversation = await Conversation.findById(conversationId);
        
        if (!conversation) {
          return callback?.({ 
            success: false, 
            error: 'Conversation non trouvée' 
          });
        }

        const isParticipant = conversation.participants.some(
          p => p._id.toString() === userId
        );

        if (!isParticipant) {
          return callback?.({ 
            success: false, 
            error: 'Accès non autorisé' 
          });
        }

        const validAttachments = Array.isArray(attachments) 
          ? attachments.filter(att => 
              att && 
              att.url && 
              att.type && 
              att.name && 
              typeof att.size === 'number'
            )
          : [];

        const messageData = {
          conversation: conversationId,
          sender: userId,
          content,
          type,
          readBy: [{ user: userId, readAt: new Date() }]
        };

        if (validAttachments.length > 0) {
          messageData.attachments = validAttachments;
        }

        const message = await Message.create(messageData);
        await message.populate('sender');

        await conversation.updateLastMessage(message._id);

        const otherParticipants = conversation.participants.filter(
          p => p._id.toString() !== userId
        );

        for (const participant of otherParticipants) {
          await conversation.incrementUnread(participant._id);
        }

        io.to(`conversation:${conversationId}`).emit('message:new', {
          message,
          conversationId,
          timestamp: new Date()
        });

        console.log(`✅ Message sent successfully`);

        callback?.({ 
          success: true, 
          message 
        });

      } catch (error) {
        console.error('❌ Error sending message:', error);
        callback?.({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // ============================================
    // DELETE MESSAGE FOR ME
    // ============================================
    socket.on('message:delete-for-me', async (data, callback) => {
      try {
        const { messageId } = data;

        console.log(`🗑️ User ${userId} deleting message ${messageId} for self`);

        const message = await Message.findById(messageId);
        if (!message) {
          console.error(`❌ Message not found: ${messageId}`);
          return callback?.({ success: false, error: 'Message non trouvé' });
        }

        // Verify user is in the conversation
        const conversation = await Conversation.findById(message.conversation);
        const isParticipant = conversation.participants.some(
          p => p._id.toString() === userId
        );

        if (!isParticipant) {
          console.error(`❌ User ${userId} not authorized to delete message ${messageId}`);
          return callback?.({ success: false, error: 'Non autorisé' });
        }

        await message.deleteForMe(userId);

        console.log(`✅ Message ${messageId} deleted for user ${userId}`);

        // Only notify this user
        socket.emit('message:deleted-for-me', {
          messageId,
          conversationId: message.conversation.toString(),
          timestamp: new Date()
        });

        callback?.({ success: true });
      } catch (error) {
        console.error('❌ Delete for me error:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    // ============================================
    // DELETE MESSAGE FOR EVERYONE
    // ============================================
    socket.on('message:delete-for-everyone', async (data, callback) => {
      try {
        const { messageId } = data;

        console.log(`🗑️ User ${userId} deleting message ${messageId} for everyone`);

        const message = await Message.findById(messageId);
        if (!message) {
          console.error(`❌ Message not found: ${messageId}`);
          return callback?.({ success: false, error: 'Message non trouvé' });
        }

        // Verify sender
        if (message.sender.toString() !== userId) {
          console.error(`❌ User ${userId} is not the sender of message ${messageId}`);
          return callback?.({ success: false, error: 'Non autorisé' });
        }

        // Check if can delete for everyone (within 48 hours)
        if (!message.canDeleteForEveryone(userId)) {
          console.error(`❌ Message ${messageId} is too old to delete for everyone`);
          return callback?.({ 
            success: false, 
            error: 'Délai de suppression dépassé (48h)' 
          });
        }

        await message.deleteForEveryone(userId);

        console.log(`✅ Message ${messageId} deleted for everyone`);

        // Notify all users in conversation
        io.to(`conversation:${message.conversation}`).emit('message:deleted-for-everyone', {
          messageId,
          conversationId: message.conversation.toString(),
          deletedBy: userId,
          timestamp: new Date()
        });

        callback?.({ success: true });
      } catch (error) {
        console.error('❌ Delete for everyone error:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    // ============================================
    // TYPING INDICATORS
    // ============================================
    socket.on('typing:start', (conversationId) => {
      socket.to(`conversation:${conversationId}`).emit('user:typing', {
        userId,
        userName: socket.userName,
        conversationId,
        timestamp: new Date()
      });
    });

    socket.on('typing:stop', (conversationId) => {
      socket.to(`conversation:${conversationId}`).emit('user:stopped-typing', {
        userId,
        conversationId,
        timestamp: new Date()
      });
    });

    // ============================================
    // MARK ALL AS READ
    // ============================================
    socket.on('conversation:mark-all-read', async (data, callback) => {
      try {
        const { conversationId } = data;

        const conversation = await Conversation.findById(conversationId);
        
        if (!conversation) {
          return callback?.({ 
            success: false, 
            error: 'Conversation non trouvée' 
          });
        }

        const count = await Message.markAllAsRead(conversationId, userId);
        await conversation.resetUnread(userId);

        io.to(`conversation:${conversationId}`).emit('conversation:unread-reset', {
          conversationId,
          userId,
          markedAsRead: count,
          timestamp: new Date()
        });

        callback?.({ 
          success: true, 
          count 
        });

      } catch (error) {
        console.error('❌ Error marking messages as read:', error);
        callback?.({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // ============================================
    // GET ONLINE USERS FOR CONVERSATION - FIXED
    // ============================================
    socket.on('conversation:get-online-users', async (conversationId, callback) => {
      try {
        console.log(`👥 Getting online users for conversation: ${conversationId}`);
        console.log(`📊 Current online users in system:`, Array.from(onlineUsers.keys()));
        
        const conversation = await Conversation.findById(conversationId)
          .populate('participants');
        
        if (!conversation) {
          console.error(`❌ Conversation not found: ${conversationId}`);
          return callback?.({ 
            success: false, 
            error: 'Conversation non trouvée' 
          });
        }

        const onlineParticipants = conversation.participants
          .filter(p => {
            const participantId = p._id.toString();
            const isOnline = onlineUsers.has(participantId);
            console.log(`  - ${p.fullName || p.nomComplet} (${participantId}): ${isOnline ? '🟢 ONLINE' : '⚫ OFFLINE'}`);
            return isOnline;
          })
          .map(p => p._id.toString()); // ✅ RETURN IDs

        console.log(`✅ Online participants in conversation:`, onlineParticipants);

        callback?.({ 
          success: true, 
          onlineUsers: onlineParticipants // ✅ ARRAY OF IDs
        });

      } catch (error) {
        console.error('❌ Error getting online users:', error);
        callback?.({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // ============================================
    // DISCONNECT - MARK USER AS OFFLINE
    // ============================================
    socket.on('disconnect', (reason) => {
      console.log('');
      console.log('='.repeat(50));
      console.log(`❌ User disconnected: ${socket.userName} (${userId})`);
      console.log(`📍 Socket ID: ${socket.id}`);
      console.log(`📍 Reason: ${reason}`);
      
      // Remove this socket from user's connections
      if (userConnections.has(userId)) {
        const connections = userConnections.get(userId);
        connections.delete(socket.id);
        
        // If no more connections, mark user as offline
        if (connections.size === 0) {
          userConnections.delete(userId);
          onlineUsers.delete(userId);
          
          // Update user document
          User.findByIdAndUpdate(userId, {
            $set: {
              isOnline: false,
              lastSeen: new Date()
            }
          }).catch(err => console.error('❌ Error updating user offline status:', err));
          
          console.log(`👤 User ${userId} is now offline (no more connections)`);
          
          // Broadcast user offline status
          broadcastUserStatus(io, userId, 'offline', socket.userName);
        } else {
          console.log(`📱 User ${userId} still has ${connections.size} active connection(s)`);
        }
      }
      
      console.log(`👥 Online users count: ${onlineUsers.size}`);
      console.log(`👥 Remaining online users:`, Array.from(onlineUsers.keys()));
      console.log('='.repeat(50));
      console.log('');
    });

    // ============================================
    // MANUAL STATUS UPDATE
    // ============================================
    socket.on('update:status', async (data, callback) => {
      try {
        const { status } = data; // 'online', 'away', 'busy', 'offline'
        
        const validStatuses = ['online', 'away', 'busy', 'offline'];
        if (!validStatuses.includes(status)) {
          return callback?.({ success: false, error: 'Invalid status' });
        }

        console.log(`🔄 User ${userId} manually updated status to: ${status}`);
        
        // Broadcast new status
        broadcastUserStatus(io, userId, status, socket.userName);
        
        callback?.({ success: true, status });
        
      } catch (error) {
        console.error('❌ Error updating status:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    // ============================================
    // ERROR HANDLING
    // ============================================
    socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });
  });

  console.log('');
  console.log('='.repeat(50));
  console.log('💬 Socket.IO initialized with online status tracking');
  console.log('='.repeat(50));
  console.log('');
};

// ============================================
// HELPER: BROADCAST USER STATUS
// ============================================
const broadcastUserStatus = async (io, userId, status, userName = null) => {
  try {
    // console.log(`📡 Broadcasting ${status} status for user ${userId}`);
    
    // Find all conversations this user is in
    const conversations = await Conversation.find({
      'participants': userId
    }).select('_id participants');

    // console.log(`📡 Found ${conversations.length} conversations for user ${userId}`);

    for (const conversation of conversations) {
      const roomName = `conversation:${conversation._id}`;
      
      io.to(roomName).emit('user:status-change', {
        userId,
        status,
        userName: userName || 'User',
        timestamp: new Date()
      });
      
      // console.log(`  ✅ Emitted to conversation: ${roomName}`);
    }

    // Also broadcast to all users who might be viewing users list
    io.emit('global:user-status-change', {
      userId,
      status,
      timestamp: new Date()
    });

    // console.log(`✅ Broadcasted ${status} status for user ${userId}`);
  } catch (error) {
    console.error('❌ Error broadcasting user status:', error);
  }
};

// ============================================
// EXPORT ONLINE USERS HELPERS
// ============================================
const getOnlineUsers = () => {
  return Array.from(onlineUsers.keys());
};

const getOnlineUsersDetailed = () => {
  return Array.from(onlineUsers.entries()).map(([userId, data]) => ({
    userId,
    userName: data.userName,
    userType: data.userType,
    socketId: data.socketId,
    lastSeen: data.lastSeen,
    joinedAt: data.joinedAt
  }));
};

const isUserOnline = (userId) => {
  return onlineUsers.has(userId.toString());
};

const getOnlineUsersCount = () => {
  return onlineUsers.size;
};

const getUserConnectionsCount = (userId) => {
  return userConnections.has(userId) ? userConnections.get(userId).size : 0;
};

module.exports = { 
  initializeSocketIO,
  getOnlineUsers,
  getOnlineUsersDetailed,
  isUserOnline,
  getOnlineUsersCount,
  getUserConnectionsCount
};