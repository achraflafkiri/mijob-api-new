// controllers/conversationController.js - FINAL FIXED VERSION

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

// ============================================
// GET USER CONVERSATIONS
// ============================================
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const archived = req.query.archived === 'true';
    const search = req.query.search || '';

    const conversations = await Conversation.getUserConversations(userId, {
      page,
      limit,
      archived,
      search
    });

    // Get total count
    const query = {
      participants: userId,
      active: true
    };

    if (archived) {
      query.archivedBy = userId;
    } else {
      query.archivedBy = { $ne: userId };
    }

    const total = await Conversation.countDocuments(query);

    // Format response with additional info - FIXED: Handle both lean and non-lean objects
    const formattedConversations = (conversations || []).map(conv => {
      // Ensure participants array exists
      if (!conv.participants || !Array.isArray(conv.participants)) {
        console.error('Conversation has no participants:', conv._id);
        return null;
      }

      const otherUser = conv.participants.find(
        p => p && p._id && p._id.toString() !== userId
      );

      // If no other user found, skip this conversation
      if (!otherUser) {
        console.error('Could not find other user in conversation:', conv._id);
        return null;
      }

      // Handle both Mongoose documents and plain objects
      const getUnreadCount = typeof conv.getUnreadCount === 'function'
        ? conv.getUnreadCount(userId)
        : getUnreadCountManual(conv, userId);

      const isMuted = typeof conv.isMuted === 'function'
        ? conv.isMuted(userId)
        : isMutedManual(conv, userId);
      
      return {
        id: conv._id,
        participants: conv.participants,
        otherUser: {
          id: otherUser._id,
          name: otherUser.userType === 'partimer'
            ? `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim()
            : otherUser.nomComplet || otherUser.raisonSociale || 'Utilisateur',
          profilePicture: otherUser.profilePicture || otherUser.companyLogo || null,
          userType: otherUser.userType
        },
        lastMessage: conv.lastMessage || null,
        lastMessageAt: conv.lastMessageAt,
        unreadCount: getUnreadCount,
        relatedMission: conv.relatedMission || null,
        type: conv.type,
        muted: isMuted,
        blocked: conv.blocked,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      };
    }).filter(conv => conv !== null);

    res.status(200).json({
      success: true,
      data: {
        conversations: formattedConversations,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des conversations',
      error: error.message
    });
  }
};

// Helper function to get unread count from plain object
const getUnreadCountManual = (conv, userId) => {
  if (!conv.unreadCounts || !Array.isArray(conv.unreadCounts)) {
    return 0;
  }
  const userUnread = conv.unreadCounts.find(
    uc => uc.user && uc.user.toString() === userId.toString()
  );
  return userUnread ? userUnread.count : 0;
};

// Helper function to check if muted from plain object
const isMutedManual = (conv, userId) => {
  if (!conv.mutedBy || !Array.isArray(conv.mutedBy)) {
    return false;
  }
  const mute = conv.mutedBy.find(
    m => m.user && m.user.toString() === userId.toString()
  );
  if (!mute) return false;
  return new Date() < new Date(mute.mutedUntil);
};

// ============================================
// GET SINGLE CONVERSATION
// ============================================
const getConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await Conversation.findById(conversationId)
      .populate('participants')
      .populate('lastMessage')
      .populate('relatedMission', 'title status budget');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation non trouvée'
      });
    }

    // Verify participants are populated
    if (!conversation.participants || !Array.isArray(conversation.participants)) {
      return res.status(500).json({
        success: false,
        message: 'Erreur de données de conversation'
      });
    }

    // Verify user is participant
    const isParticipant = conversation.participants.some(
      p => p && p._id && p._id.toString() === userId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cette conversation'
      });
    }

    const otherUser = conversation.participants.find(
      p => p && p._id && p._id.toString() !== userId
    );

    if (!otherUser) {
      return res.status(500).json({
        success: false,
        message: 'Impossible de trouver l\'autre participant'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        conversation: {
          id: conversation._id,
          participants: conversation.participants,
          otherUser: {
            id: otherUser._id,
            name: otherUser.userType === 'partimer'
              ? `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim()
              : otherUser.nomComplet || otherUser.raisonSociale || 'Utilisateur',
            profilePicture: otherUser.profilePicture || otherUser.companyLogo || null,
            userType: otherUser.userType
          },
          lastMessage: conversation.lastMessage || null,
          lastMessageAt: conversation.lastMessageAt,
          unreadCount: conversation.getUnreadCount(userId),
          relatedMission: conversation.relatedMission || null,
          type: conversation.type,
          muted: conversation.isMuted(userId),
          blocked: conversation.blocked,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la conversation',
      error: error.message
    });
  }
};

// ============================================
// CREATE CONVERSATION
// ============================================
const createConversation = async (req, res) => {
  try {
    const { otherUserId, missionId } = req.body;
    const userId = req.user.id; // ! i think particluier and entreprise id

    console.log('Creating conversation:', { userId, otherUserId, missionId });

    if (!otherUserId) {
      return res.status(400).json({
        success: false,
        message: 'ID de l\'autre utilisateur requis'
      });
    }

    // Verify other user exists
    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOrCreate(
      userId,
      otherUserId,
      missionId
    );

    console.log('Conversation found/created:', conversation._id);

    // Manually populate if needed
    await conversation.populate('participants');
    if (missionId) {
      await conversation.populate('relatedMission');
    }

    // Ensure participants are loaded
    if (!conversation.participants || !Array.isArray(conversation.participants)) {
      // Reload with populate
      conversation = await Conversation.findById(conversation._id)
        .populate('participants')
        .populate('relatedMission');
    }

    const formattedOtherUser = conversation.participants.find(
      p => p && p._id && p._id.toString() !== userId
    );

    if (!formattedOtherUser) {
      console.error('Cannot find other user in participants');
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la création de la conversation'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Conversation créée avec succès',
      data: {
        conversation: {
          id: conversation._id,
          participants: conversation.participants,
          otherUser: {
            id: formattedOtherUser._id,
            name: formattedOtherUser.userType === 'partimer'
              ? `${formattedOtherUser.firstName || ''} ${formattedOtherUser.lastName || ''}`.trim()
              : formattedOtherUser.nomComplet || formattedOtherUser.raisonSociale || 'Utilisateur',
            profilePicture: formattedOtherUser.profilePicture || formattedOtherUser.companyLogo || null,
            userType: formattedOtherUser.userType
          },
          relatedMission: conversation.relatedMission || null,
          type: conversation.type,
          createdAt: conversation.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la conversation',
      error: error.message
    });
  }
};

// ============================================
// ARCHIVE CONVERSATION
// ============================================
const archiveConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

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

    await conversation.archive(userId);

    res.status(200).json({
      success: true,
      message: 'Conversation archivée avec succès'
    });

  } catch (error) {
    console.error('Archive conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'archivage de la conversation',
      error: error.message
    });
  }
};

// ============================================
// UNARCHIVE CONVERSATION
// ============================================
const unarchiveConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await Conversation.findById(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation non trouvée'
      });
    }

    await conversation.unarchive(userId);

    res.status(200).json({
      success: true,
      message: 'Conversation désarchivée avec succès'
    });

  } catch (error) {
    console.error('Unarchive conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la désarchivage de la conversation',
      error: error.message
    });
  }
};

// ============================================
// MUTE CONVERSATION
// ============================================
const muteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { duration } = req.body;
    const userId = req.user.id;

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

    await conversation.mute(userId, duration);

    res.status(200).json({
      success: true,
      message: duration 
        ? `Conversation en sourdine pour ${duration}h`
        : 'Conversation en sourdine'
    });

  } catch (error) {
    console.error('Mute conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise en sourdine',
      error: error.message
    });
  }
};

// ============================================
// UNMUTE CONVERSATION
// ============================================
const unmuteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await Conversation.findById(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation non trouvée'
      });
    }

    await conversation.unmute(userId);

    res.status(200).json({
      success: true,
      message: 'Sourdine désactivée'
    });

  } catch (error) {
    console.error('Unmute conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la désactivation de la sourdine',
      error: error.message
    });
  }
};

// ============================================
// BLOCK CONVERSATION
// ============================================
const blockConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

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

    await conversation.blockConversation(userId);

    res.status(200).json({
      success: true,
      message: 'Conversation bloquée avec succès'
    });

  } catch (error) {
    console.error('Block conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du blocage de la conversation',
      error: error.message
    });
  }
};

// ============================================
// UNBLOCK CONVERSATION
// ============================================
const unblockConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await Conversation.findById(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation non trouvée'
      });
    }

    // Verify user is blocker
    if (conversation.blockedBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Seul le bloqueur peut débloquer'
      });
    }

    await conversation.unblockConversation();

    res.status(200).json({
      success: true,
      message: 'Conversation débloquée avec succès'
    });

  } catch (error) {
    console.error('Unblock conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du déblocage de la conversation',
      error: error.message
    });
  }
};

// ============================================
// DELETE CONVERSATION
// ============================================
const deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

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

    // Soft delete - just archive
    await conversation.archive(userId);

    // Or hard delete all messages for this user
    await Message.updateMany(
      { conversation: conversationId },
      { $addToSet: { deletedBy: userId } }
    );

    res.status(200).json({
      success: true,
      message: 'Conversation supprimée avec succès'
    });

  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la conversation',
      error: error.message
    });
  }
};

// ============================================
// GET UNREAD COUNT
// ============================================
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const totalUnread = await Conversation.getTotalUnread(userId);

    res.status(200).json({
      success: true,
      data: {
        unreadCount: totalUnread
      }
    });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du nombre de non-lus',
      error: error.message
    });
  }
};

module.exports = {
  getConversations,
  getConversation,
  createConversation,
  archiveConversation,
  unarchiveConversation,
  muteConversation,
  unmuteConversation,
  blockConversation,
  unblockConversation,
  deleteConversation,
  getUnreadCount
};