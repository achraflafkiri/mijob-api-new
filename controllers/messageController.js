// controllers/messageController.js
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// ============================================
// SEND MESSAGE (HTTP fallback) - FINAL FIX
// ============================================
const sendMessage = async (req, res) => {
  try {
    const { conversationId, content, type = 'text', attachments = [] } = req.body;
    const senderId = req.user.id;

    console.log('📥 Received message data:', { conversationId, content, type, attachments });

    if (!conversationId || !content) {
      return res.status(400).json({
        success: false,
        message: 'ID de conversation et contenu requis'
      });
    }

    // Verify conversation exists
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation non trouvée'
      });
    }

    // Verify user is participant
    const isParticipant = conversation.participants.some(
      p => p._id.toString() === senderId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cette conversation'
      });
    }

    // Check if conversation is blocked
    if (conversation.blocked) {
      return res.status(403).json({
        success: false,
        message: 'Cette conversation est bloquée'
      });
    }

    // 🔧 FILTER AND VALIDATE ATTACHMENTS
    const validAttachments = Array.isArray(attachments)
      ? attachments.filter(att =>
        att &&
        att.url &&
        att.type &&
        att.name &&
        typeof att.size === 'number'
      )
      : [];

    console.log('✅ Valid attachments:', validAttachments);

    // 🔧 BUILD MESSAGE DATA - ONLY INCLUDE ATTACHMENTS IF NOT EMPTY
    const messageData = {
      conversation: conversationId,
      sender: senderId,
      content,
      type,
      readBy: [{ user: senderId, readAt: new Date() }]
    };

    // Only add attachments if there are valid ones
    if (validAttachments.length > 0) {
      messageData.attachments = validAttachments;
    }

    console.log('📝 Creating message with data:', messageData);

    // Create message
    const message = await Message.create(messageData);

    await message.populate('sender');

    console.log('✅ Message created:', message._id);

    // Update conversation
    await conversation.updateLastMessage(message._id);

    // Increment unread for other participants
    const otherParticipants = conversation.participants.filter(
      p => p._id.toString() !== senderId
    );

    for (const participant of otherParticipants) {
      await conversation.incrementUnread(participant._id);
    }

    // Emit via Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversationId}`).emit('message:new', {
        message,
        conversationId,
        timestamp: new Date()
      });
    }

    res.status(201).json({
      success: true,
      message: 'Message envoyé avec succès',
      data: { message }
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
// GET CONVERSATION MESSAGES - FIXED VERSION
// ============================================
const getConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    // Verify conversation exists and populate participants
    const conversation = await Conversation.findById(conversationId)
      .populate('participants');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation non trouvée'
      });
    }

    // Verify participants array exists and user is participant
    if (!conversation.participants || !Array.isArray(conversation.participants)) {
      return res.status(500).json({
        success: false,
        message: 'Erreur de données de conversation'
      });
    }

    const isParticipant = conversation.participants.some(
      p => p && p._id && p._id.toString() === userId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cette conversation'
      });
    }

    // Get messages
    const messages = await Message.getConversationMessages(conversationId, page, limit, userId);

    // Get total count
    const total = await Message.countDocuments({
      conversation: conversationId,
      deletedBy: { $ne: userId }
    });

    // Mark messages as read
    await Message.markAllAsRead(conversationId, userId);
    await conversation.resetUnread(userId);

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
      }
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des messages',
      error: error.message
    });
  }
};

// ============================================
// EDIT MESSAGE
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

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    // Verify sender
    if (message.sender.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez modifier que vos propres messages'
      });
    }

    await message.editMessage(content);

    // Emit via Socket.IO
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

    res.status(200).json({
      success: true,
      message: 'Message modifié avec succès',
      data: { message }
    });

  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification du message',
      error: error.message
    });
  }
};

// ============================================
// MARK MESSAGE AS READ
// ============================================
const markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    await message.markAsRead(userId);

    // Emit via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${message.conversation}`).emit('message:read-receipt', {
        messageId,
        userId,
        timestamp: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message marqué comme lu'
    });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du marquage du message',
      error: error.message
    });
  }
};

// ============================================
// MARK ALL MESSAGES AS READ
// ============================================
const markAllAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Verify conversation exists
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation non trouvée'
      });
    }

    // Verify user is participant
    const isParticipant = conversation.participants.some(
      p => p._id.toString() === userId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    const count = await Message.markAllAsRead(conversationId, userId);
    await conversation.resetUnread(userId);

    res.status(200).json({
      success: true,
      message: `${count} message(s) marqué(s) comme lu(s)`,
      data: { count }
    });

  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du marquage des messages',
      error: error.message
    });
  }
};

// ============================================
// UPLOAD MESSAGE ATTACHMENT
// ============================================
// ============================================
// UPLOAD MESSAGE ATTACHMENT
// ============================================
const uploadMessageAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier téléchargé'
      });
    }

    console.log('📎 File uploaded:', {
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
      originalname: req.file.originalname
    });

    // Determine file type
    let fileType = 'document';
    if (req.file.mimetype.startsWith('image/')) {
      fileType = 'image';
    } else if (req.file.mimetype === 'application/pdf') {
      fileType = 'pdf';
    } else if (
      req.file.mimetype === 'application/msword' ||
      req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      fileType = 'document';
    }

    // Return attachment data directly at root level
    res.status(200).json({
      success: true,
      message: 'Fichier téléchargé avec succès',
      url: req.file.path,
      type: fileType,
      name: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype
    });

  } catch (error) {
    console.error('❌ Upload attachment error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement du fichier',
      error: error.message
    });
  }
};


// ============================================
// DELETE MESSAGE FOR ME
// ============================================
const deleteMessageForMe = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    console.log(`🗑️ Delete for me - User: ${userId}, Message: ${messageId}`);

    const message = await Message.findById(messageId);

    if (!message) {
      console.error(`❌ Message not found: ${messageId}`);
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    // Verify user is in the conversation
    const conversation = await Conversation.findById(message.conversation);
    
    if (!conversation) {
      console.error(`❌ Conversation not found: ${message.conversation}`);
      return res.status(404).json({
        success: false,
        message: 'Conversation non trouvée'
      });
    }

    const isParticipant = conversation.participants.some(
      p => p._id.toString() === userId
    );

    if (!isParticipant) {
      console.error(`❌ User ${userId} not authorized`);
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    // Call the deleteForMe method
    await message.deleteForMe(userId);

    console.log(`✅ Message ${messageId} deleted for user ${userId}`);

    // Emit via Socket.IO - only to this user
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('message:deleted-for-me', {
        messageId,
        conversationId: message.conversation.toString(),
        timestamp: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message supprimé pour vous'
    });

  } catch (error) {
    console.error('❌ Delete message for me error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du message',
      error: error.message
    });
  }
};

// ============================================
// DELETE MESSAGE FOR EVERYONE
// ============================================
const deleteMessageForEveryone = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    console.log(`🗑️ Delete for everyone - User: ${userId}, Message: ${messageId}`);

    const message = await Message.findById(messageId).populate('sender');

    if (!message) {
      console.error(`❌ Message not found: ${messageId}`);
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    // Verify sender
    if (message.sender._id.toString() !== userId) {
      console.error(`❌ User ${userId} is not the sender`);
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez supprimer que vos propres messages'
      });
    }

    // Check if can delete for everyone (within 48 hours)
    // if (!message.canDeleteForEveryone(userId)) {
    //   console.error(`❌ Message ${messageId} cannot be deleted (too old or already deleted)`);
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Vous pouvez seulement supprimer les messages envoyés dans les dernières 48 heures'
    //   });
    // }

    // Call the deleteForEveryone method
    await message.deleteForEveryone(userId);

    console.log(`✅ Message ${messageId} deleted for everyone`);

    // Emit via Socket.IO - to all users in conversation
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${message.conversation}`).emit('message:deleted-for-everyone', {
        messageId,
        conversationId: message.conversation.toString(),
        deletedBy: userId,
        timestamp: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message supprimé pour tout le monde',
      data: { message }
    });

  } catch (error) {
    console.error('❌ Delete message for everyone error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du message',
      error: error.message
    });
  }
};

// ============================================
// BACKWARD COMPATIBILITY - DELETE MESSAGE
// ============================================
const deleteMessage = async (req, res) => {
  // This now defaults to "delete for me"
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
  deleteMessageForEveryone,
  deleteMessage,
};