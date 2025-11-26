// routes/conversations.js - UPDATED WITH TOKEN DEDUCTION FOR PARTICULIERS

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Import both middleware for entreprise and particulier
const { 
  checkContactLimit, 
  requireSubscription 
} = require('../middleware/contactLimits');

const {
  checkTokenAvailability,
  deductToken
} = require('../middleware/tokenLimits');

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

// Create new conversation - WITH MULTI-USER TYPE SUPPORT
// This route now handles:
// - Entreprise users: Check subscription + contact limits
// - Particulier users: Check token availability + deduct token
// - Partimer users: No restrictions (can receive messages, not initiate)
router.post(
  '/', 
  // ENTREPRISE MIDDLEWARE (runs only for entreprise users)
  requireSubscription,     // First check if entreprise has subscription
  checkContactLimit,       // Then check monthly contact limit for entreprise
  
  // PARTICULIER MIDDLEWARE (runs only for particulier users)
  checkTokenAvailability,  // Check if particulier has tokens
  
  // CREATE CONVERSATION
  createConversation,      // Create the conversation
  
  // PARTICULIER POST-CREATION (runs only for particulier users)
  deductToken              // Deduct token AFTER successful creation
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