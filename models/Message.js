// models/Message.js - COMPLETE WITH ALL DELETE METHODS

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

  attachments: [{
    url: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['image', 'pdf', 'document'],
      required: true
    },
    name: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    mimeType: String,
    _id: false
  }],

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

  relatedMission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mission'
  },

  systemMessageType: {
    type: String,
    enum: ['application_sent', 'application_accepted', 'application_rejected', 'mission_completed', null],
    default: null
  },

  // DELETE FOR ME - Array of user IDs who deleted this message for themselves
  deletedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // DELETE FOR EVERYONE - When true, message is deleted for all users
  deletedForEveryone: {
    type: Boolean,
    default: false
  },

  // WHO DELETED FOR EVERYONE
  deletedForEveryoneBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // WHEN WAS IT DELETED FOR EVERYONE
  deletedForEveryoneAt: {
    type: Date,
    default: null
  },

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
messageSchema.index({ deletedForEveryone: 1 });

// ============================================================
// VIRTUAL FIELDS
// ============================================================

// Check if message is read by specific user
messageSchema.virtual('isReadBy').get(function () {
  return (userId) => {
    return this.readBy.some(read => read.user.toString() === userId.toString());
  };
});

// ============================================================
// INSTANCE METHODS
// ============================================================

/**
 * Mark message as read by user
 * @param {string|ObjectId} userId - User ID
 * @returns {Promise<Message>}
 */
messageSchema.methods.markAsRead = async function (userId) {
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

/**
 * Edit message content
 * @param {string} newContent - New content
 * @returns {Promise<Message>}
 */
messageSchema.methods.editMessage = async function (newContent) {
  if (!this.originalContent) {
    this.originalContent = this.content;
  }
  this.content = newContent;
  this.edited = true;
  this.editedAt = new Date();
  await this.save();
  return this;
};

/**
 * Delete message for specific user (soft delete)
 * @param {string|ObjectId} userId - User ID
 * @returns {Promise<Message>}
 */
messageSchema.methods.deleteForMe = async function (userId) {
  const userIdString = userId.toString();
  
  // Check if already in deletedBy array
  const alreadyDeleted = this.deletedBy.some(
    id => id.toString() === userIdString
  );
  
  if (!alreadyDeleted) {
    this.deletedBy.push(userId);
    await this.save();
  }
  
  return this;
};

/**
 * Delete message for everyone (hard delete)
 * @param {string|ObjectId} userId - User ID who is deleting
 * @returns {Promise<Message>}
 */
messageSchema.methods.deleteForEveryone = async function (userId) {
  this.deletedForEveryone = true;
  this.deletedForEveryoneBy = userId;
  this.deletedForEveryoneAt = new Date();
  this.content = 'Ce message a été supprimé';
  this.attachments = [];
  await this.save();
  return this;
};

/**
 * Check if user can delete message for everyone (within 48 hours)
 * @param {string|ObjectId} userId - User ID
 * @returns {boolean}
 */
messageSchema.methods.canDeleteForEveryone = function (userId) {
  // Must be sender
  if (this.sender.toString() !== userId.toString()) {
    return false;
  }

  // Already deleted for everyone
  if (this.deletedForEveryone) {
    return false;
  }

  // Check if within 48 hours
  const hoursSinceSent = (Date.now() - this.createdAt) / (1000 * 60 * 60);
  return hoursSinceSent <= 48;
};

/**
 * Soft delete message for user (alias for deleteForMe)
 * @param {string|ObjectId} userId - User ID
 * @returns {Promise<Message>}
 */
messageSchema.methods.deleteForUser = async function (userId) {
  return this.deleteForMe(userId);
};

// ============================================================
// STATIC METHODS
// ============================================================

/**
 * Get conversation messages with pagination
 * @param {string|ObjectId} conversationId - Conversation ID
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @param {string|ObjectId|null} userId - User ID (for filtering deleted messages)
 * @returns {Promise<Message[]>}
 */
messageSchema.statics.getConversationMessages = function (conversationId, page = 1, limit = 50, userId = null) {
  const skip = (page - 1) * limit;

  let query = { conversation: conversationId };

  // Exclude messages deleted by the current user (delete for me)
  if (userId) {
    query.deletedBy = { $ne: userId };
  }

  return this.find(query)
    .populate('sender')
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(limit);
};

/**
 * Get unread count for user in conversation
 * @param {string|ObjectId} conversationId - Conversation ID
 * @param {string|ObjectId} userId - User ID
 * @returns {Promise<number>}
 */
messageSchema.statics.getUnreadCount = async function (conversationId, userId) {
  return this.countDocuments({
    conversation: conversationId,
    sender: { $ne: userId },
    'readBy.user': { $ne: userId },
    deletedBy: { $ne: userId },
    deletedForEveryone: false
  });
};

/**
 * Mark all messages as read in conversation
 * @param {string|ObjectId} conversationId - Conversation ID
 * @param {string|ObjectId} userId - User ID
 * @returns {Promise<number>} - Number of messages marked as read
 */
messageSchema.statics.markAllAsRead = async function (conversationId, userId) {
  const unreadMessages = await this.find({
    conversation: conversationId,
    sender: { $ne: userId },
    'readBy.user': { $ne: userId }
  });

  const promises = unreadMessages.map(message => message.markAsRead(userId));
  await Promise.all(promises);

  return unreadMessages.length;
};

// ============================================================
// PRE-SAVE HOOKS
// ============================================================

messageSchema.pre('save', function(next) {
  // Ensure deletedBy is always an array
  if (!Array.isArray(this.deletedBy)) {
    this.deletedBy = [];
  }
  next();
});

// ============================================================
// MODEL CREATION
// ============================================================

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;