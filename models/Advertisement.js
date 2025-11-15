// models/Advertisement.js
const mongoose = require('mongoose');

const advertisementSchema = new mongoose.Schema({
  nomEntreprise: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  telephone: {
    type: String,
    required: true
  },
  nomResponsable: {
    type: String,
    required: true
  },
  objectifCampagne: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'contacted', 'approved', 'rejected'],
    default: 'pending'
  },
  notes: String
}, {
  timestamps: true
});

advertisementSchema.index({ status: 1 });
advertisementSchema.index({ email: 1 });
advertisementSchema.index({ createdAt: 1 });

module.exports = mongoose.model('Advertisement', advertisementSchema);