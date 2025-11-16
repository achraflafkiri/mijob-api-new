// routes/messages.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  sendMessage,
  getConversationMessages,
  editMessage,
  deleteMessage,
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
router.delete('/:messageId', deleteMessage);
router.post('/:messageId/read', markAsRead);
router.post('/conversation/:conversationId/read-all', markAllAsRead);

// Upload attachment
router.post(
  '/upload',
  uploadSingle('attachment', 'messages'),
  uploadMessageAttachment
);

module.exports = router;