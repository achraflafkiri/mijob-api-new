// models/entreprise.js
const mongoose = require('mongoose');

const entrepriseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  raisonSociale: {
    type: String,
    required: true
  },
  ice: {
    type: String,
    required: true
  },
  logo: String,
  city: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  siegeSocial: {
    type: String,
    required: true
  },
  secteurActivite: {
    type: String,
    required: true
  },
  tailleEntreprise: {
    type: String,
    enum: ['1-10', '11-50', '51-200', '201-500', '500+']
  },
  raisonRecherche: String,
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

entrepriseSchema.index({ userId: 1 });
entrepriseSchema.index({ subscriptionStatus: 1 });
entrepriseSchema.index({ subscriptionPlan: 1 });
entrepriseSchema.index({ city: 1 });

module.exports = mongoose.model('entreprise', entrepriseSchema);