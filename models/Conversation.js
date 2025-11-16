// models/Conversation.js

const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],

  // Related mission (if conversation started from a mission)
  relatedMission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mission'
  },

  // Last message reference
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },

  lastMessageAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Unread counts per participant
  unreadCounts: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    count: {
      type: Number,
      default: 0
    },
    _id: false
  }],

  // Archived status per user
  archivedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Muted status per user
  mutedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    mutedUntil: Date,
    _id: false
  }],

  // Blocked status
  blocked: {
    type: Boolean,
    default: false
  },

  blockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Conversation type
  type: {
    type: String,
    enum: ['mission', 'direct'],
    default: 'direct'
  },

  // Active status
  active: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================================
// INDEXES
// ============================================================

conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ relatedMission: 1 });
conversationSchema.index({ 'participants': 1, 'lastMessageAt': -1 });

// Compound unique index to prevent duplicate conversations
conversationSchema.index(
  { participants: 1, relatedMission: 1 },
  { 
    unique: true,
    partialFilterExpression: { relatedMission: { $exists: true } }
  }
);

// ============================================================
// VIRTUAL FIELDS
// ============================================================

// Get other participant (for direct conversations)
conversationSchema.virtual('otherParticipant').get(function() {
  return (userId) => {
    return this.participants.find(
      p => p._id.toString() !== userId.toString()
    );
  };
});

// ============================================================
// MIDDLEWARE
// ============================================================

// Auto-populate participants on find
conversationSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'participants',
    select: 'firstName lastName nomComplet profilePicture companyLogo userType email'
  });
  next();
});

// ============================================================
// INSTANCE METHODS
// ============================================================

// Update last message
conversationSchema.methods.updateLastMessage = async function(messageId) {
  this.lastMessage = messageId;
  this.lastMessageAt = new Date();
  await this.save();
  return this;
};

// Increment unread count for user
conversationSchema.methods.incrementUnread = async function(userId) {
  const userUnread = this.unreadCounts.find(
    uc => uc.user.toString() === userId.toString()
  );

  if (userUnread) {
    userUnread.count += 1;
  } else {
    this.unreadCounts.push({ user: userId, count: 1 });
  }

  await this.save();
  return this;
};

// Reset unread count for user
conversationSchema.methods.resetUnread = async function(userId) {
  const userUnread = this.unreadCounts.find(
    uc => uc.user.toString() === userId.toString()
  );

  if (userUnread) {
    userUnread.count = 0;
    await this.save();
  }

  return this;
};

// Get unread count for user
conversationSchema.methods.getUnreadCount = function(userId) {
  const userUnread = this.unreadCounts.find(
    uc => uc.user.toString() === userId.toString()
  );
  return userUnread ? userUnread.count : 0;
};

// Archive conversation for user
conversationSchema.methods.archive = async function(userId) {
  if (!this.archivedBy.includes(userId)) {
    this.archivedBy.push(userId);
    await this.save();
  }
  return this;
};

// Unarchive conversation for user
conversationSchema.methods.unarchive = async function(userId) {
  this.archivedBy = this.archivedBy.filter(
    id => id.toString() !== userId.toString()
  );
  await this.save();
  return this;
};

// Mute conversation for user
conversationSchema.methods.mute = async function(userId, duration = null) {
  const existingMute = this.mutedBy.find(
    m => m.user.toString() === userId.toString()
  );

  const mutedUntil = duration 
    ? new Date(Date.now() + duration * 60 * 60 * 1000)
    : new Date('2099-12-31');

  if (existingMute) {
    existingMute.mutedUntil = mutedUntil;
  } else {
    this.mutedBy.push({ user: userId, mutedUntil });
  }

  await this.save();
  return this;
};

// Unmute conversation for user
conversationSchema.methods.unmute = async function(userId) {
  this.mutedBy = this.mutedBy.filter(
    m => m.user.toString() !== userId.toString()
  );
  await this.save();
  return this;
};

// Check if conversation is muted for user
conversationSchema.methods.isMuted = function(userId) {
  const mute = this.mutedBy.find(
    m => m.user.toString() === userId.toString()
  );
  
  if (!mute) return false;
  
  return new Date() < new Date(mute.mutedUntil);
};

// Block conversation
conversationSchema.methods.blockConversation = async function(userId) {
  this.blocked = true;
  this.blockedBy = userId;
  await this.save();
  return this;
};

// Unblock conversation
conversationSchema.methods.unblockConversation = async function() {
  this.blocked = false;
  this.blockedBy = null;
  await this.save();
  return this;
};

// ============================================================
// STATIC METHODS
// ============================================================

// Find or create conversation between users
conversationSchema.statics.findOrCreate = async function(participant1, participant2, missionId = null) {
  const participants = [participant1, participant2].sort();

  let query = { participants: { $all: participants, $size: 2 } };
  
  if (missionId) {
    query.relatedMission = missionId;
  } else {
    query.relatedMission = { $exists: false };
  }

  let conversation = await this.findOne(query);

  if (!conversation) {
    conversation = await this.create({
      participants,
      relatedMission: missionId || undefined,
      type: missionId ? 'mission' : 'direct',
      unreadCounts: participants.map(p => ({ user: p, count: 0 }))
    });
  }

  return conversation;
};

// Get user conversations with filters
conversationSchema.statics.getUserConversations = async function(userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    archived = false,
    search = ''
  } = options;

  const skip = (page - 1) * limit;

  const query = {
    participants: userId,
    active: true
  };

  if (archived) {
    query.archivedBy = userId;
  } else {
    query.archivedBy = { $ne: userId };
  }

  let conversations = await this.find(query)
    .populate('lastMessage')
    .sort({ lastMessageAt: -1 })
    .skip(skip)
    .limit(limit);

  // Apply search filter if provided
  if (search) {
    conversations = conversations.filter(conv => {
      const otherUser = conv.participants.find(
        p => p._id.toString() !== userId.toString()
      );
      
      const searchLower = search.toLowerCase();
      const fullName = otherUser.userType === 'partimer'
        ? `${otherUser.firstName} ${otherUser.lastName}`.toLowerCase()
        : (otherUser.nomComplet || otherUser.raisonSociale || '').toLowerCase();
      
      return fullName.includes(searchLower);
    });
  }

  return conversations;
};

// Get total unread count for user
conversationSchema.statics.getTotalUnread = async function(userId) {
  const conversations = await this.find({
    participants: userId,
    active: true,
    archivedBy: { $ne: userId }
  });

  return conversations.reduce((total, conv) => {
    return total + conv.getUnreadCount(userId);
  }, 0);
};

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;