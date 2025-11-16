// socket/socketHandler.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// Store connected users: userId -> socketId
const connectedUsers = new Map();

// Socket.IO authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user || !user.active) {
      return next(new Error('User not found or inactive'));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Invalid authentication token'));
  }
};

// Initialize Socket.IO
const initializeSocketIO = (io) => {
  // Apply authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.userId}`);
    
    // Store connected user
    connectedUsers.set(socket.userId, socket.id);
    
    // Notify user is online
    socket.broadcast.emit('user:online', {
      userId: socket.userId,
      timestamp: new Date()
    });

    // ============================================================
    // JOIN CONVERSATION ROOM
    // ============================================================
    socket.on('conversation:join', async (data) => {
      try {
        const { conversationId } = data;
        
        // Verify user is participant
        const conversation = await Conversation.findById(conversationId);
        
        if (!conversation) {
          return socket.emit('error', {
            message: 'Conversation non trouvée'
          });
        }

        const isParticipant = conversation.participants.some(
          p => p._id.toString() === socket.userId
        );

        if (!isParticipant) {
          return socket.emit('error', {
            message: 'Accès non autorisé à cette conversation'
          });
        }

        // Join room
        socket.join(`conversation:${conversationId}`);
        
        // Mark messages as read
        await Message.markAllAsRead(conversationId, socket.userId);
        await conversation.resetUnread(socket.userId);

        socket.emit('conversation:joined', {
          conversationId,
          timestamp: new Date()
        });

        console.log(`User ${socket.userId} joined conversation ${conversationId}`);
      } catch (error) {
        console.error('Join conversation error:', error);
        socket.emit('error', {
          message: 'Erreur lors de la connexion à la conversation'
        });
      }
    });

    // ============================================================
    // LEAVE CONVERSATION ROOM
    // ============================================================
    socket.on('conversation:leave', (data) => {
      const { conversationId } = data;
      socket.leave(`conversation:${conversationId}`);
      
      socket.emit('conversation:left', {
        conversationId,
        timestamp: new Date()
      });

      console.log(`User ${socket.userId} left conversation ${conversationId}`);
    });

    // ============================================================
    // SEND MESSAGE
    // ============================================================
    socket.on('message:send', async (data) => {
      try {
        const { conversationId, content, type = 'text', attachments = [] } = data;

        // Verify conversation exists and user is participant
        const conversation = await Conversation.findById(conversationId);
        
        if (!conversation) {
          return socket.emit('error', {
            message: 'Conversation non trouvée'
          });
        }

        const isParticipant = conversation.participants.some(
          p => p._id.toString() === socket.userId
        );

        if (!isParticipant) {
          return socket.emit('error', {
            message: 'Accès non autorisé'
          });
        }

        // Check if conversation is blocked
        if (conversation.blocked) {
          return socket.emit('error', {
            message: 'Cette conversation est bloquée'
          });
        }

        // Create message
        const message = await Message.create({
          conversation: conversationId,
          sender: socket.userId,
          content,
          type,
          attachments,
          readBy: [{ user: socket.userId, readAt: new Date() }]
        });

        // Populate sender info
        await message.populate('sender', 'firstName lastName nomComplet profilePicture userType');

        // Update conversation
        await conversation.updateLastMessage(message._id);

        // Increment unread count for other participants
        const otherParticipants = conversation.participants.filter(
          p => p._id.toString() !== socket.userId
        );

        for (const participant of otherParticipants) {
          await conversation.incrementUnread(participant._id);
        }

        // Emit to conversation room
        io.to(`conversation:${conversationId}`).emit('message:new', {
          message,
          conversationId,
          timestamp: new Date()
        });

        // Send push notification to offline users
        otherParticipants.forEach(participant => {
          const participantSocketId = connectedUsers.get(participant._id.toString());
          
          if (!participantSocketId) {
            // User is offline - send push notification
            // TODO: Implement push notification service
            console.log(`📧 Send push notification to user ${participant._id}`);
          } else {
            // Send notification to online user
            io.to(participantSocketId).emit('notification:new-message', {
              conversationId,
              message: {
                id: message._id,
                content: content.substring(0, 100),
                sender: socket.user.firstName || socket.user.nomComplet,
                timestamp: message.createdAt
              }
            });
          }
        });

        console.log(`Message sent in conversation ${conversationId}`);
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', {
          message: 'Erreur lors de l\'envoi du message'
        });
      }
    });

    // ============================================================
    // TYPING INDICATOR
    // ============================================================
    socket.on('typing:start', (data) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit('typing:user-typing', {
        userId: socket.userId,
        userName: socket.user.firstName || socket.user.nomComplet,
        conversationId,
        timestamp: new Date()
      });
    });

    socket.on('typing:stop', (data) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit('typing:user-stopped', {
        userId: socket.userId,
        conversationId,
        timestamp: new Date()
      });
    });

    // ============================================================
    // MARK MESSAGE AS READ
    // ============================================================
    socket.on('message:read', async (data) => {
      try {
        const { messageId, conversationId } = data;

        const message = await Message.findById(messageId);
        
        if (message) {
          await message.markAsRead(socket.userId);
          
          // Notify sender
          socket.to(`conversation:${conversationId}`).emit('message:read-receipt', {
            messageId,
            userId: socket.userId,
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error('Mark as read error:', error);
      }
    });

    // ============================================================
    // EDIT MESSAGE
    // ============================================================
    socket.on('message:edit', async (data) => {
      try {
        const { messageId, newContent, conversationId } = data;

        const message = await Message.findById(messageId);
        
        if (!message) {
          return socket.emit('error', {
            message: 'Message non trouvé'
          });
        }

        // Verify sender
        if (message.sender.toString() !== socket.userId) {
          return socket.emit('error', {
            message: 'Vous ne pouvez modifier que vos propres messages'
          });
        }

        await message.editMessage(newContent);

        // Broadcast to conversation
        io.to(`conversation:${conversationId}`).emit('message:edited', {
          messageId,
          newContent,
          edited: true,
          editedAt: message.editedAt,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Edit message error:', error);
        socket.emit('error', {
          message: 'Erreur lors de la modification du message'
        });
      }
    });

    // ============================================================
    // DELETE MESSAGE
    // ============================================================
    socket.on('message:delete', async (data) => {
      try {
        const { messageId, conversationId } = data;

        const message = await Message.findById(messageId);
        
        if (!message) {
          return socket.emit('error', {
            message: 'Message non trouvé'
          });
        }

        // Verify sender
        if (message.sender.toString() !== socket.userId) {
          return socket.emit('error', {
            message: 'Vous ne pouvez supprimer que vos propres messages'
          });
        }

        await message.deleteForUser(socket.userId);

        // Broadcast to conversation
        io.to(`conversation:${conversationId}`).emit('message:deleted', {
          messageId,
          deletedBy: socket.userId,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Delete message error:', error);
        socket.emit('error', {
          message: 'Erreur lors de la suppression du message'
        });
      }
    });

    // ============================================================
    // GET ONLINE USERS
    // ============================================================
    socket.on('users:get-online', () => {
      const onlineUsers = Array.from(connectedUsers.keys());
      socket.emit('users:online-list', {
        users: onlineUsers,
        count: onlineUsers.length,
        timestamp: new Date()
      });
    });

    // ============================================================
    // DISCONNECT
    // ============================================================
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.userId}`);
      
      // Remove from connected users
      connectedUsers.delete(socket.userId);
      
      // Notify others
      socket.broadcast.emit('user:offline', {
        userId: socket.userId,
        timestamp: new Date()
      });
    });

    // ============================================================
    // ERROR HANDLING
    // ============================================================
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  console.log('💬 Socket.IO initialized successfully');
};

// Get connected users (for routes)
const getConnectedUsers = () => {
  return Array.from(connectedUsers.entries());
};

// Get user socket ID
const getUserSocketId = (userId) => {
  return connectedUsers.get(userId.toString());
};

// Check if user is online
const isUserOnline = (userId) => {
  return connectedUsers.has(userId.toString());
};

module.exports = {
  initializeSocketIO,
  getConnectedUsers,
  getUserSocketId,
  isUserOnline
};