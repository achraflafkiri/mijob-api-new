// models/particulier.js
const mongoose = require('mongoose');

const particulierSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  nomComplet: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  cin: {
    type: String,
    required: true,
    unique: true
  },
  cinDocument: {
    type: String,
    required: true
  },
  passport: String,
  passportDocument: String,
  subscriptionPlan: {
    type: String,
    enum: ['basic', 'premium', 'accompagnement', null],
    default: null
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'expired', 'cancelled', null],
    default: null
  },
  subscriptionStartDate: Date,
  subscriptionEndDate: Date,
  billingCycle: {
    type: String,
    enum: ['monthly', 'annual', null]
  },
  monthlyJobPostsLimit: {
    type: Number,
    default: 0
  },
  monthlyJobPostsUsed: {
    type: Number,
    default: 0
  },
  monthlyCandidateContactsLimit: {
    type: Number,
    default: 0
  },
  monthlyCandidateContactsUsed: {
    type: Number,
    default: 0
  },
  lastResetDate: Date,
  isPremiumBadge: {
    type: Boolean,
    default: false
  },
  canBoostJobs: {
    type: Boolean,
    default: false
  },
  isProfileComplete: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

particulierSchema.index({ userId: 1 });
particulierSchema.index({ cin: 1 });
particulierSchema.index({ subscriptionStatus: 1 });
particulierSchema.index({ city: 1 });

module.exports = mongoose.model('particulier', particulierSchema);