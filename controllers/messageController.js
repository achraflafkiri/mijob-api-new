// controllers/messageController.js

const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// ============================================
// SEND MESSAGE (HTTP fallback)
// ============================================
const sendMessage = async (req, res) => {
  try {
    const { conversationId, content, type = 'text', attachments = [] } = req.body;
    const senderId = req.user.id;

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

    // Create message
    const message = await Message.create({
      conversation: conversationId,
      sender: senderId,
      content,
      type,
      attachments,
      readBy: [{ user: senderId, readAt: new Date() }]
    });

    await message.populate('sender');

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
    console.error('Send message error:', error);
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
// DELETE MESSAGE
// ============================================
const deleteMessage = async (req, res) => {
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

    // Verify sender
    if (message.sender.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez supprimer que vos propres messages'
      });
    }

    await message.deleteForUser(userId);

    // Emit via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${message.conversation}`).emit('message:deleted', {
        messageId,
        deletedBy: userId,
        timestamp: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message supprimé avec succès'
    });

  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du message',
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
const uploadMessageAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier téléchargé'
      });
    }

    const attachment = {
      url: req.file.path,
      type: req.file.mimetype.startsWith('image/') ? 'image' :
        req.file.mimetype === 'application/pdf' ? 'pdf' : 'document',
      name: req.file.originalname,
      size: req.file.size
    };

    res.status(200).json({
      success: true,
      message: 'Fichier téléchargé avec succès',
      data: { attachment }
    });

  } catch (error) {
    console.error('Upload attachment error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement du fichier',
      error: error.message
    });
  }
};

module.exports = {
  sendMessage,
  getConversationMessages,
  editMessage,
  deleteMessage,
  markAsRead,
  markAllAsRead,
  uploadMessageAttachment
};