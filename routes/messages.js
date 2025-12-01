// routes/messages.js - ADD NEW ROUTES

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  sendMessage,
  getConversationMessages,
  editMessage,
  deleteMessage,
  deleteMessageForMe,
  deleteMessageForEveryone,
  markAsRead,
  markAllAsRead,
  uploadMessageAttachment
} = require('../controllers/messageController');
const { uploadSingle } = require('../config/cloudinary');

// All routes require authentication
router.use(protect);

// Message routes
router.post('/', sendMessage);
router.get('/conversation/:conversationId', getConversationMessages);
router.put('/:messageId', editMessage);

// 🆕 DELETE ROUTES
router.delete('/:messageId', deleteMessage); // Default: delete for me
router.delete('/:messageId/for-me', deleteMessageForMe); // Explicit: delete for me
router.delete('/:messageId/for-everyone', deleteMessageForEveryone); // Delete for everyone

router.post('/:messageId/read', markAsRead);
router.post('/conversation/:conversationId/read-all', markAllAsRead);

// Upload attachment
router.post(
  '/upload',
  uploadSingle('attachment', 'messages'),
  uploadMessageAttachment
);

module.exports = router;