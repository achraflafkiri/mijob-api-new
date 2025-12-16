// models/Reclamation.js
const mongoose = require('mongoose');

const reclamationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['payment', 'cancelled', 'behavior', 'technical', 'other'],
    required: true
  },
  description: {
    type: String,
    required: [true, 'Please provide a description'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  mission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mission'
  },
  relatedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'resolved', 'closed'],
    default: 'pending'
  },
  adminResponse: {
    type: String,
    maxlength: [2000, 'Response cannot exceed 2000 characters']
  },
  responseDate: {
    type: Date
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  }
}, {
  timestamps: true
});

// Indexes for better performance
reclamationSchema.index({ user: 1, createdAt: -1 });
reclamationSchema.index({ status: 1 });
reclamationSchema.index({ type: 1 });

const Reclamation = mongoose.model('Reclamation', reclamationSchema);

module.exports = Reclamation;