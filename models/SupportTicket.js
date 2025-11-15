// models/SupportTicket.js
const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  userType: {
    type: String,
    enum: ['recruteur', 'partimer']
  },
  nomEntreprise: String,
  personneContact: String,
  nomComplet: String,
  email: {
    type: String,
    required: true
  },
  telephone: String,
  sujet: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['nouveau', 'en_cours', 'resolu', 'ferme'],
    default: 'nouveau'
  },
  adminNotes: String,
  assignedTo: String,
  resolvedAt: Date
}, {
  timestamps: true
});

supportTicketSchema.index({ status: 1 });
supportTicketSchema.index({ userType: 1 });
supportTicketSchema.index({ email: 1 });
supportTicketSchema.index({ createdAt: 1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);