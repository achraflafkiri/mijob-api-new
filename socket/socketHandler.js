// socket/socketHandler.js - ⚡ OPTIMIZED VERSION (Inspired by old project)

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

// Store online users with their socket IDs
const onlineUsers = new Map();
const userConnections = new Map();

const initializeSocketIO = (io) => {
  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await User.findById(decoded.id);
      
      socket.userId = user._id.toString();
      socket.userType = user.userType;
      socket.userName = user.fullName || user.nomComplet || user.email;
      
      next();
    } catch (error) {
      console.error('❌ Socket authentication error:', error.message);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;

    // ============================================
    // MARK USER AS ONLINE
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

    // ⚡ Background DB update (don't block connection)
    setImmediate(() => {
      User.findByIdAndUpdate(userId, {
        $set: {
          isOnline: true,
          socketId: socket.id,
          lastSeen: new Date()
        }
      }).catch(err => console.error('❌ Error updating user online status:', err));
    });

    socket.join(`user:${userId}`);
    broadcastUserStatus(io, userId, 'online', socket.userName);

    // ============================================
    // 🚀 SEND MESSAGE - ULTRA FAST (OLD PROJECT STYLE)
    // ============================================
    socket.on('message:send', async (data, callback) => {
      try {
        const { conversationId, content, type = 'text', attachments = [] } = data;
        const startTime = Date.now();

        console.log(`📤 Socket message from ${userId} to ${conversationId}`);

        // ⚡ Quick validation
        if (!conversationId || !content) {
          return callback?.({ 
            success: false, 
            error: 'Conversation et contenu requis' 
          });
        }

        // ⚡ Quick conversation check (lean for speed)
        const conversation = await Conversation.findById(conversationId)
          .select('participants blocked')
          .lean();
        
        if (!conversation) {
          return callback?.({ success: false, error: 'Conversation non trouvée' });
        }

        // ⚡ Quick participant check
        const isParticipant = conversation.participants.some(
          p => p.toString() === userId
        );

        if (!isParticipant) {
          return callback?.({ success: false, error: 'Accès non autorisé' });
        }

        if (conversation.blocked) {
          return callback?.({ success: false, error: 'Conversation bloquée' });
        }

        // ⚡ Filter attachments (simple)
        const validAttachments = Array.isArray(attachments) 
          ? attachments.filter(att => att && att.url && att.type && att.name && typeof att.size === 'number')
          : [];

        // ⚡ Create message data
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

        // ⚡ Create message (SINGLE DB OPERATION)
        const message = await Message.create(messageData);

        const responseTime = Date.now() - startTime;
        console.log(`⚡ Socket message created in ${responseTime}ms`);

        // ⚡ RESPOND IMMEDIATELY (OLD PROJECT STYLE)
        callback?.({ 
          success: true, 
          message: {
            _id: message._id,
            conversation: message.conversation,
            sender: userId,
            content: message.content,
            type: message.type,
            attachments: message.attachments || [],
            createdAt: message.createdAt,
            readBy: message.readBy
          },
          responseTime: `${responseTime}ms`
        });

        // ⚡ BACKGROUND PROCESSING (don't block response)
        setImmediate(async () => {
          try {
            // Populate sender
            await message.populate('sender');

            // Update conversation
            await Conversation.findByIdAndUpdate(
              conversationId,
              {
                lastMessage: message._id,
                lastMessageAt: new Date()
              }
            );

            // Increment unread
            const otherParticipants = conversation.participants.filter(
              p => p.toString() !== userId
            );

            for (const participantId of otherParticipants) {
              await Conversation.updateOne(
                {
                  _id: conversationId,
                  'unreadCounts.user': participantId
                },
                {
                  $inc: { 'unreadCounts.$.count': 1 }
                }
              );
            }

            // Emit to conversation
            io.to(`conversation:${conversationId}`).emit('message:new', {
              message,
              conversationId,
              timestamp: new Date()
            });

            console.log(`✅ Background processing completed`);
          } catch (bgError) {
            console.error('❌ Background processing error:', bgError);
          }
        });

      } catch (error) {
        console.error('❌ Socket send message error:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    // ============================================
    // JOIN CONVERSATION - OPTIMIZED
    // ============================================
    socket.on('conversation:join', async (conversationId, callback) => {
      try {
        // ⚡ Quick check (lean)
        const conversation = await Conversation.findById(conversationId)
          .select('participants')
          .lean();

        if (!conversation) {
          return callback?.({ success: false, error: 'Conversation non trouvée' });
        }

        const isParticipant = conversation.participants.some(
          p => p.toString() === userId
        );

        if (!isParticipant) {
          return callback?.({ success: false, error: 'Accès non autorisé' });
        }

        socket.join(`conversation:${conversationId}`);
        
        // ⚡ Respond immediately
        callback?.({ 
          success: true,
          onlineUsers: Array.from(onlineUsers.keys()).filter(id => 
            conversation.participants.some(p => p.toString() === id) && id !== userId
          )
        });

        // ⚡ Background: Mark as read + emit status
        setImmediate(async () => {
          try {
            // Bulk update - mark all as read
            await Message.updateMany(
              {
                conversation: conversationId,
                sender: { $ne: userId },
                'readBy.user': { $ne: userId }
              },
              {
                $addToSet: { readBy: { user: userId, readAt: new Date() } }
              }
            );

            // Reset unread
            await Conversation.updateOne(
              {
                _id: conversationId,
                'unreadCounts.user': userId
              },
              {
                $set: { 'unreadCounts.$.count': 0 }
              }
            );

            // Emit status
            io.to(`conversation:${conversationId}`).emit('user:status-change', {
              userId,
              status: 'online',
              userName: socket.userName,
              timestamp: new Date()
            });

          } catch (bgError) {
            console.error('❌ Join background error:', bgError);
          }
        });

      } catch (error) {
        console.error('❌ Join conversation error:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    // ============================================
    // LEAVE CONVERSATION
    // ============================================
    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // ============================================
    // TYPING INDICATORS - INSTANT
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
    // DELETE FOR ME - INSTANT
    // ============================================
    socket.on('message:delete-for-me', async (data, callback) => {
      try {
        const { messageId } = data;

        // ⚡ Atomic update
        const message = await Message.findByIdAndUpdate(
          messageId,
          { $addToSet: { deletedBy: userId } },
          { new: false }
        ).select('conversation');

        if (!message) {
          return callback?.({ success: false, error: 'Message non trouvé' });
        }

        // ⚡ Respond immediately
        callback?.({ success: true });

        // ⚡ Emit
        socket.emit('message:deleted-for-me', {
          messageId,
          conversationId: message.conversation.toString(),
          timestamp: new Date()
        });

      } catch (error) {
        console.error('❌ Delete for me error:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    // ============================================
    // DELETE FOR EVERYONE - INSTANT
    // ============================================
    socket.on('message:delete-for-everyone', async (data, callback) => {
      try {
        const { messageId } = data;

        // ⚡ Atomic update with sender verification
        const message = await Message.findOneAndUpdate(
          {
            _id: messageId,
            sender: userId
          },
          {
            $set: {
              deletedForEveryone: true,
              deletedForEveryoneBy: userId,
              deletedForEveryoneAt: new Date(),
              content: 'Ce message a été supprimé',
              attachments: []
            }
          },
          { new: false }
        ).select('conversation');

        if (!message) {
          return callback?.({ success: false, error: 'Message non trouvé ou non autorisé' });
        }

        // ⚡ Respond immediately
        callback?.({ success: true });

        // ⚡ Emit to all
        io.to(`conversation:${message.conversation}`).emit('message:deleted-for-everyone', {
          messageId,
          conversationId: message.conversation.toString(),
          deletedBy: userId,
          timestamp: new Date()
        });

      } catch (error) {
        console.error('❌ Delete for everyone error:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    // ============================================
    // MARK ALL AS READ - INSTANT RESPONSE
    // ============================================
    socket.on('conversation:mark-all-read', async (data, callback) => {
      try {
        const { conversationId } = data;

        // ⚡ Respond immediately
        callback?.({ success: true });

        // ⚡ Process in background
        setImmediate(async () => {
          try {
            const result = await Message.updateMany(
              {
                conversation: conversationId,
                sender: { $ne: userId },
                'readBy.user': { $ne: userId }
              },
              {
                $addToSet: { readBy: { user: userId, readAt: new Date() } }
              }
            );

            await Conversation.updateOne(
              {
                _id: conversationId,
                'unreadCounts.user': userId
              },
              {
                $set: { 'unreadCounts.$.count': 0 }
              }
            );

            io.to(`conversation:${conversationId}`).emit('conversation:unread-reset', {
              conversationId,
              userId,
              markedAsRead: result.modifiedCount,
              timestamp: new Date()
            });

          } catch (bgError) {
            console.error('❌ Mark all background error:', bgError);
          }
        });

      } catch (error) {
        console.error('❌ Mark all as read error:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    // ============================================
    // GET ONLINE USERS - INSTANT
    // ============================================
    socket.on('get:online-users', async (callback) => {
      const onlineUserIds = Array.from(onlineUsers.keys());
      callback?.({
        success: true,
        onlineUsers: onlineUserIds,
        count: onlineUserIds.length,
        timestamp: new Date()
      });
    });

    // ============================================
    // PING - KEEP ALIVE
    // ============================================
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
      const userData = onlineUsers.get(userId);
      if (userData) {
        userData.lastSeen = new Date();
        onlineUsers.set(userId, userData);
      }
    });

    // ============================================
    // DISCONNECT - MARK OFFLINE
    // ============================================
    socket.on('disconnect', (reason) => {
      if (userConnections.has(userId)) {
        const connections = userConnections.get(userId);
        connections.delete(socket.id);
        
        if (connections.size === 0) {
          userConnections.delete(userId);
          onlineUsers.delete(userId);
          
          // ⚡ Background DB update
          setImmediate(() => {
            User.findByIdAndUpdate(userId, {
              $set: {
                isOnline: false,
                lastSeen: new Date()
              }
            }).catch(err => console.error('❌ Error updating offline status:', err));
          });
          
          broadcastUserStatus(io, userId, 'offline', socket.userName);
        }
      }
    });

    // ============================================
    // ERROR HANDLING
    // ============================================
    socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });
  });

  console.log('💬 Socket.IO initialized (OPTIMIZED)');
};

// ============================================
// HELPER: BROADCAST USER STATUS (Background)
// ============================================
const broadcastUserStatus = async (io, userId, status, userName = null) => {
  setImmediate(async () => {
    try {
      const conversations = await Conversation.find({
        'participants': userId
      }).select('_id').lean();

      for (const conversation of conversations) {
        io.to(`conversation:${conversation._id}`).emit('user:status-change', {
          userId,
          status,
          userName: userName || 'User',
          timestamp: new Date()
        });
      }

      io.emit('global:user-status-change', {
        userId,
        status,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('❌ Broadcast status error:', error);
    }
  });
};

// ============================================
// EXPORT HELPERS
// ============================================
const getOnlineUsers = () => Array.from(onlineUsers.keys());

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

const isUserOnline = (userId) => onlineUsers.has(userId.toString());

const getOnlineUsersCount = () => onlineUsers.size;

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