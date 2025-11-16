// routes/conversations.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
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

// Conversation routes
router.get('/', getConversations);
router.post('/', createConversation);
router.get('/unread-count', getUnreadCount);
router.get('/:conversationId', getConversation);
router.delete('/:conversationId', deleteConversation);

// Conversation actions
router.post('/:conversationId/archive', archiveConversation);
router.post('/:conversationId/unarchive', unarchiveConversation);
router.post('/:conversationId/mute', muteConversation);
router.post('/:conversationId/unmute', unmuteConversation);
router.post('/:conversationId/block', blockConversation);
router.post('/:conversationId/unblock', unblockConversation);

module.exports = router;