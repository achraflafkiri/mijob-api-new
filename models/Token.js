// models/Token.js
const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0
  },
  transactions: [{
    type: {
      type: String,
      enum: ['purchase', 'used', 'refund'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    reason: String,
    relatedJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobOffer'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

tokenSchema.index({ userId: 1 });

module.exports = mongoose.model('Token', tokenSchema);