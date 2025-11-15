// models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  jobOfferId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobOffer'
  },
  content: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  conversationId: String,
  sentAt: {
    type: Date,
    default: Date.now
  }
});

// Generate conversationId before saving
messageSchema.pre('save', function(next) {
  const participants = [this.senderId.toString(), this.receiverId.toString()].sort();
  this.conversationId = participants.join('_');
  next();
});

messageSchema.index({ conversationId: 1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ receiverId: 1 });
messageSchema.index({ isRead: 1 });
messageSchema.index({ conversationId: 1, sentAt: 1 });

module.exports = mongoose.model('Message', messageSchema);