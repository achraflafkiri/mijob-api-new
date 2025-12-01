// models/Token.js
const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // Current balance
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Total tokens ever purchased
  totalPurchased: {
    type: Number,
    default: 0
  },
  
  // Total tokens ever used
  totalUsed: {
    type: Number,
    default: 0
  },
  
  // Transaction history
  transactions: [{
    type: {
      type: String,
      enum: ['purchase', 'used', 'refund', 'expired'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    balanceBefore: {
      type: Number,
      required: true
    },
    balanceAfter: {
      type: Number,
      required: true
    },
    reason: {
      type: String
    },
    packageName: {
      type: String
    },
    price: {
      type: Number
    },
    relatedMissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mission'
    },
    relatedConversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation'
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Last purchase date
  lastPurchaseDate: {
    type: Date
  },
  
  // Last usage date
  lastUsageDate: {
    type: Date
  }
  
}, {
  timestamps: true
});

// Indexes for better performance
tokenSchema.index({ userId: 1 });
tokenSchema.index({ 'transactions.createdAt': -1 });
tokenSchema.index({ 'transactions.type': 1 });

// Virtual for available tokens (same as balance)
tokenSchema.virtual('available').get(function() {
  return this.balance;
});

// Instance method to add transaction
tokenSchema.methods.addTransaction = function(transactionData) {
  const balanceBefore = this.balance;
  
  // Calculate new balance
  let balanceAfter = balanceBefore;
  if (transactionData.type === 'purchase' || transactionData.type === 'refund') {
    balanceAfter += transactionData.amount;
  } else if (transactionData.type === 'used' || transactionData.type === 'expired') {
    balanceAfter -= transactionData.amount;
  }
  
  // Add transaction to history
  this.transactions.push({
    ...transactionData,
    balanceBefore,
    balanceAfter,
    createdAt: new Date()
  });
  
  // Update balance
  this.balance = Math.max(0, balanceAfter);
  
  // Update totals
  if (transactionData.type === 'purchase') {
    this.totalPurchased += transactionData.amount;
    this.lastPurchaseDate = new Date();
  } else if (transactionData.type === 'used') {
    this.totalUsed += transactionData.amount;
    this.lastUsageDate = new Date();
  }
  
  return this;
};

// Static method to find or create token document
tokenSchema.statics.findOrCreate = async function(userId) {
  let tokenDoc = await this.findOne({ userId });
  
  if (!tokenDoc) {
    tokenDoc = await this.create({
      userId,
      balance: 0,
      totalPurchased: 0,
      totalUsed: 0,
      transactions: []
    });
  }
  
  return tokenDoc;
};

// Static method to get user balance
tokenSchema.statics.getBalance = async function(userId) {
  const tokenDoc = await this.findOne({ userId });
  return tokenDoc ? tokenDoc.balance : 0;
};

// Static method to check if user has enough tokens
tokenSchema.statics.hasEnoughTokens = async function(userId, required) {
  const balance = await this.getBalance(userId);
  return balance >= required;
};

const Token = mongoose.model('Token', tokenSchema);

module.exports = Token;