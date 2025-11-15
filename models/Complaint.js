// models/Complaint.js
const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  typeProbleme: {
    type: String,
    enum: ['paiement', 'mission_annulee', 'comportement_inapproprie', 'probleme_technique', 'autre'],
    required: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  relatedJobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobOffer'
  },
  relatedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['nouveau', 'en_cours', 'resolu', 'rejete'],
    default: 'nouveau'
  },
  resolution: String,
  resolvedAt: Date
}, {
  timestamps: true
});

complaintSchema.index({ userId: 1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ typeProbleme: 1 });
complaintSchema.index({ createdAt: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);