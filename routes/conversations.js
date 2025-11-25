// routes/conversations.js - UPDATED WITH CONTACT LIMITS

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { 
  checkContactLimit, 
  requireSubscription 
} = require('../middleware/contactLimits');

const {
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
} = require('../controllers/conversationController');

// All routes require authentication
router.use(protect);

// ============================================
// CONVERSATION ROUTES
// ============================================

// Get all conversations (no limits needed)
router.get('/', getConversations);

// Create new conversation - WITH CONTACT LIMITS
// This is where entreprise users contact partimers (candidats)
router.post(
  '/', 
  requireSubscription,  // First check if has subscription
  checkContactLimit,     // Then check monthly contact limit
  createConversation
);

// Get unread count (no limits needed)
router.get('/unread-count', getUnreadCount);

// Get single conversation (no limits needed)
router.get('/:conversationId', getConversation);

// Delete conversation (no limits needed)
router.delete('/:conversationId', deleteConversation);

// ============================================
// CONVERSATION ACTIONS (no limits needed)
// ============================================

router.post('/:conversationId/archive', archiveConversation);
router.post('/:conversationId/unarchive', unarchiveConversation);
router.post('/:conversationId/mute', muteConversation);
router.post('/:conversationId/unmute', unmuteConversation);
router.post('/:conversationId/block', blockConversation);
router.post('/:conversationId/unblock', unblockConversation);

module.exports = router;