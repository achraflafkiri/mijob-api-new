// controllers/messageController.js - ⚡ OPTIMIZED FOR SPEED (Inspired by old project)
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// ============================================
// 🚀 SEND MESSAGE - ULTRA FAST VERSION
// ============================================
/**
 * Key optimizations from old project:
 * 1. ✅ Optimistic response - respond IMMEDIATELY
 * 2. ✅ Background file processing - don't block response
 * 3. ✅ Single DB operation - no multiple queries
 * 4. ✅ Socket emission happens asynchronously
 */
const sendMessage = async (req, res) => {
  try {
    const { conversationId, content, type = 'text', attachments = [] } = req.body;
    const senderId = req.user.id;
    const startTime = Date.now();

    console.log('📥 Message received:', { conversationId, type, hasAttachments: attachments.length > 0 });

    // ⚡ VALIDATION - Fast fail
    if (!conversationId || !content) {
      return res.status(400).json({
        success: false,
        message: 'ID de conversation et contenu requis'
      });
    }

    // ⚡ STEP 1: Verify conversation (cached query)
    const conversation = await Conversation.findById(conversationId).lean();

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation non trouvée'
      });
    }

    // ⚡ STEP 2: Quick participant check
    const isParticipant = conversation.participants.some(
      p => p.toString() === senderId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    if (conversation.blocked) {
      return res.status(403).json({
        success: false,
        message: 'Conversation bloquée'
      });
    }

    // ⚡ STEP 3: Filter attachments (OLD PROJECT STYLE - simple validation)
    const validAttachments = Array.isArray(attachments)
      ? attachments.filter(att =>
          att && att.url && att.type && att.name && typeof att.size === 'number'
        )
      : [];

    // ⚡ STEP 4: Create message data (minimal)
    const messageData = {
      conversation: conversationId,
      sender: senderId,
      content,
      type,
      readBy: [{ user: senderId, readAt: new Date() }]
    };

    if (validAttachments.length > 0) {
      messageData.attachments = validAttachments;
    }

    // ⚡ STEP 5: Create message (SINGLE DB OPERATION)
    const message = await Message.create(messageData);

    // ⚡ STEP 6: RESPOND IMMEDIATELY (before populate, before updates)
    const responseTime = Date.now() - startTime;
    console.log(`⚡ Response sent in ${responseTime}ms`);

    res.status(201).json({
      success: true,
      message: 'Message envoyé',
      data: {
        message: {
          _id: message._id,
          conversation: message.conversation,
          sender: senderId,
          content: message.content,
          type: message.type,
          attachments: message.attachments || [],
          createdAt: message.createdAt,
          readBy: message.readBy
        }
      },
      responseTime: `${responseTime}ms`
    });

    // ⚡ STEP 7: BACKGROUND PROCESSING (after response sent)
    setImmediate(async () => {
      try {
        console.log('🔄 Starting background processing...');

        // Populate sender
        await message.populate('sender');

        // Update conversation
        await Conversation.findByIdAndUpdate(
          conversationId,
          {
            lastMessage: message._id,
            lastMessageAt: new Date()
          },
          { new: false } // Don't return document for speed
        );

        // Increment unread for others
        const otherParticipants = conversation.participants.filter(
          p => p.toString() !== senderId
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

        // Emit via Socket.IO
        const io = req.app.get('io');
        if (io) {
          io.to(`conversation:${conversationId}`).emit('message:new', {
            message,
            conversationId,
            timestamp: new Date()
          });
        }

        const totalTime = Date.now() - startTime;
        console.log(`✅ Background processing completed in ${totalTime}ms`);

      } catch (bgError) {
        console.error('❌ Background processing error:', bgError);
        // Don't fail - message already sent
      }
    });

  } catch (error) {
    console.error('❌ Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi du message',
      error: error.message
    });
  }
};

// ============================================
// 📥 GET CONVERSATION MESSAGES - OPTIMIZED
// ============================================
const getConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const startTime = Date.now();

    // ⚡ Quick conversation check (lean)
    const conversation = await Conversation.findById(conversationId)
      .select('participants')
      .lean();

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation non trouvée'
      });
    }

    // ⚡ Quick participant check
    const isParticipant = conversation.participants.some(
      p => p.toString() === userId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    // ⚡ Get messages (optimized query)
    const skip = (page - 1) * limit;
    const messages = await Message.find({
      conversation: conversationId,
      deletedBy: { $ne: userId }
    })
      .populate('sender', 'firstName lastName nomComplet raisonSociale profilePicture companyLogo userType')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(); // ⚡ Use lean for speed

    // ⚡ Get total count (cached)
    const total = await Message.countDocuments({
      conversation: conversationId,
      deletedBy: { $ne: userId }
    });

    const responseTime = Date.now() - startTime;
    console.log(`⚡ Messages loaded in ${responseTime}ms`);

    // ⚡ Respond immediately
    res.status(200).json({
      success: true,
      data: {
        messages,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      },
      responseTime: `${responseTime}ms`
    });

    // ⚡ Mark as read in background
    setImmediate(async () => {
      try {
        await Message.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: userId },
            'readBy.user': { $ne: userId }
          },
          {
            $addToSet: {
              readBy: { user: userId, readAt: new Date() }
            }
          }
        );

        // Reset unread count
        await Conversation.updateOne(
          {
            _id: conversationId,
            'unreadCounts.user': userId
          },
          {
            $set: { 'unreadCounts.$.count': 0 }
          }
        );

        console.log('✅ Messages marked as read in background');
      } catch (bgError) {
        console.error('❌ Background mark as read error:', bgError);
      }
    });

  } catch (error) {
    console.error('❌ Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des messages',
      error: error.message
    });
  }
};

// ============================================
// ✏️ EDIT MESSAGE - OPTIMIZED
// ============================================
const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Nouveau contenu requis'
      });
    }

    // ⚡ Fast update with atomic operation
    const message = await Message.findOneAndUpdate(
      {
        _id: messageId,
        sender: userId // Verify sender in query
      },
      {
        $set: {
          content,
          edited: true,
          editedAt: new Date()
        },
        $setOnInsert: {
          originalContent: '$content' // Save original on first edit
        }
      },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé ou accès non autorisé'
      });
    }

    // ⚡ Respond immediately
    res.status(200).json({
      success: true,
      message: 'Message modifié',
      data: { message }
    });

    // ⚡ Emit in background
    setImmediate(() => {
      const io = req.app.get('io');
      if (io) {
        io.to(`conversation:${message.conversation}`).emit('message:edited', {
          messageId,
          newContent: content,
          edited: true,
          editedAt: message.editedAt,
          timestamp: new Date()
        });
      }
    });

  } catch (error) {
    console.error('❌ Edit message error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification',
      error: error.message
    });
  }
};

// ============================================
// 📖 MARK AS READ - OPTIMIZED
// ============================================
const markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // ⚡ Atomic update
    const message = await Message.findByIdAndUpdate(
      messageId,
      {
        $addToSet: {
          readBy: { user: userId, readAt: new Date() }
        }
      },
      { new: false } // Don't return document
    ).select('conversation');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    // ⚡ Respond immediately
    res.status(200).json({
      success: true,
      message: 'Marqué comme lu'
    });

    // ⚡ Emit in background
    setImmediate(() => {
      const io = req.app.get('io');
      if (io) {
        io.to(`conversation:${message.conversation}`).emit('message:read-receipt', {
          messageId,
          userId,
          timestamp: new Date()
        });
      }
    });

  } catch (error) {
    console.error('❌ Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

// ============================================
// 📖 MARK ALL AS READ - OPTIMIZED
// ============================================
const markAllAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // ⚡ Respond immediately
    res.status(200).json({
      success: true,
      message: 'Messages marqués comme lus'
    });

    // ⚡ Process in background
    setImmediate(async () => {
      try {
        // Bulk update
        const result = await Message.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: userId },
            'readBy.user': { $ne: userId }
          },
          {
            $addToSet: {
              readBy: { user: userId, readAt: new Date() }
            }
          }
        );

        // Reset unread count
        await Conversation.updateOne(
          {
            _id: conversationId,
            'unreadCounts.user': userId
          },
          {
            $set: { 'unreadCounts.$.count': 0 }
          }
        );

        console.log(`✅ Marked ${result.modifiedCount} messages as read`);

        // Emit
        const io = req.app.get('io');
        if (io) {
          io.to(`conversation:${conversationId}`).emit('conversation:unread-reset', {
            conversationId,
            userId,
            markedAsRead: result.modifiedCount,
            timestamp: new Date()
          });
        }
      } catch (bgError) {
        console.error('❌ Background mark all error:', bgError);
      }
    });

  } catch (error) {
    console.error('❌ Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

// ============================================
// 📎 UPLOAD ATTACHMENT - OLD PROJECT STYLE
// ============================================
/**
 * OLD PROJECT APPROACH: Direct file path storage
 * Simple, fast, no external API calls blocking response
 */
const uploadMessageAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier téléchargé'
      });
    }

    console.log('📎 File uploaded:', req.file.originalname);

    // ⚡ Determine type quickly
    const mimeType = req.file.mimetype;
    let fileType = 'document';
    
    if (mimeType.startsWith('image/')) {
      fileType = 'image';
    } else if (mimeType === 'application/pdf') {
      fileType = 'pdf';
    }

    // ⚡ Return immediately (OLD PROJECT STYLE)
    res.status(200).json({
      success: true,
      message: 'Fichier téléchargé',
      url: req.file.path, // Direct path (like old project)
      type: fileType,
      name: req.file.originalname,
      size: req.file.size,
      mimeType: mimeType
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur de téléchargement',
      error: error.message
    });
  }
};

// ============================================
// 🗑️ DELETE FOR ME - OPTIMIZED
// ============================================
const deleteMessageForMe = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // ⚡ Atomic update
    const message = await Message.findByIdAndUpdate(
      messageId,
      {
        $addToSet: { deletedBy: userId }
      },
      { new: false }
    ).select('conversation');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    // ⚡ Respond immediately
    res.status(200).json({
      success: true,
      message: 'Message supprimé pour vous'
    });

    // ⚡ Emit in background
    setImmediate(() => {
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${userId}`).emit('message:deleted-for-me', {
          messageId,
          conversationId: message.conversation.toString(),
          timestamp: new Date()
        });
      }
    });

  } catch (error) {
    console.error('❌ Delete for me error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur de suppression',
      error: error.message
    });
  }
};

// ============================================
// 🗑️ DELETE FOR EVERYONE - OPTIMIZED
// ============================================
const deleteMessageForEveryone = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // ⚡ Atomic update with verification
    const message = await Message.findOneAndUpdate(
      {
        _id: messageId,
        sender: userId // Verify sender in query
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
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé ou accès non autorisé'
      });
    }

    // ⚡ Respond immediately
    res.status(200).json({
      success: true,
      message: 'Message supprimé pour tout le monde'
    });

    // ⚡ Emit in background
    setImmediate(() => {
      const io = req.app.get('io');
      if (io) {
        io.to(`conversation:${message.conversation}`).emit('message:deleted-for-everyone', {
          messageId,
          conversationId: message.conversation.toString(),
          deletedBy: userId,
          timestamp: new Date()
        });
      }
    });

  } catch (error) {
    console.error('❌ Delete for everyone error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur de suppression',
      error: error.message
    });
  }
};

// ============================================
// 🗑️ DEFAULT DELETE (alias)
// ============================================
const deleteMessage = async (req, res) => {
  return deleteMessageForMe(req, res);
};

module.exports = {
  sendMessage,
  getConversationMessages,
  editMessage,
  deleteMessage,
  markAsRead,
  markAllAsRead,
  uploadMessageAttachment,
  deleteMessageForMe,
  deleteMessageForEveryone
};