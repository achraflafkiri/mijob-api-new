// models/Message.js

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },

  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  content: {
    type: String,
    required: [true, 'Le contenu du message est requis'],
    trim: true,
    maxlength: [2000, 'Le message ne peut pas dépasser 2000 caractères']
  },

  type: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },

  // For file/image messages
  attachments: [{
    url: String,
    type: {
      type: String,
      enum: ['image', 'pdf', 'document']
    },
    name: String,
    size: Number,
    _id: false
  }],

  // Read status
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    },
    _id: false
  }],

  // Related mission (optional)
  relatedMission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mission'
  },

  // For system messages
  systemMessageType: {
    type: String,
    enum: ['application_sent', 'application_accepted', 'application_rejected', 'mission_completed', null],
    default: null
  },

  // Deleted status
  deletedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Edit history
  edited: {
    type: Boolean,
    default: false
  },

  editedAt: {
    type: Date
  },

  originalContent: String

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================================
// INDEXES
// ============================================================

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ 'readBy.user': 1 });
messageSchema.index({ createdAt: -1 });

// ============================================================
// VIRTUAL FIELDS
// ============================================================

// Check if message is read by specific user
messageSchema.virtual('isReadBy').get(function() {
  return (userId) => {
    return this.readBy.some(read => read.user.toString() === userId.toString());
  };
});

// ============================================================
// INSTANCE METHODS
// ============================================================

// Mark message as read by user
messageSchema.methods.markAsRead = async function(userId) {
  // Check if already read
  const alreadyRead = this.readBy.some(
    read => read.user.toString() === userId.toString()
  );

  if (!alreadyRead) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
    await this.save();
  }

  return this;
};

// Edit message
messageSchema.methods.editMessage = async function(newContent) {
  if (!this.originalContent) {
    this.originalContent = this.content;
  }
  this.content = newContent;
  this.edited = true;
  this.editedAt = new Date();
  await this.save();
  return this;
};

// Soft delete message for user
messageSchema.methods.deleteForUser = async function(userId) {
  if (!this.deletedBy.includes(userId)) {
    this.deletedBy.push(userId);
    await this.save();
  }
  return this;
};

// ============================================================
// STATIC METHODS
// ============================================================

// Get conversation messages with pagination
messageSchema.statics.getConversationMessages = function(conversationId, page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  
  return this.find({ conversation: conversationId })
    .populate('sender', 'firstName lastName nomComplet profilePicture userType')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Get unread count for user in conversation
messageSchema.statics.getUnreadCount = async function(conversationId, userId) {
  return this.countDocuments({
    conversation: conversationId,
    sender: { $ne: userId },
    'readBy.user': { $ne: userId },
    deletedBy: { $ne: userId }
  });
};

// Mark all messages as read in conversation
messageSchema.statics.markAllAsRead = async function(conversationId, userId) {
  const unreadMessages = await this.find({
    conversation: conversationId,
    sender: { $ne: userId },
    'readBy.user': { $ne: userId }
  });

  const promises = unreadMessages.map(message => message.markAsRead(userId));
  await Promise.all(promises);

  return unreadMessages.length;
};

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;