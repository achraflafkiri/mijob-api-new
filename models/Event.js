// models/Event.js
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  type: {
    type: String,
    enum: ['formation', 'evenement'],
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  heureDebut: {
    type: String,
    required: true
  },
  heureFin: {
    type: String,
    required: true
  },
  locationType: {
    type: String,
    enum: ['en_ligne', 'presentiel'],
    required: true
  },
  lieu: String,
  zoomLink: String,
  formateur: String,
  programme: [String],
  isPaid: {
    type: Boolean,
    default: false
  },
  price: Number,
  maxParticipants: Number,
  currentParticipants: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming'
  }
}, {
  timestamps: true
});

eventSchema.index({ type: 1 });
eventSchema.index({ isPaid: 1 });
eventSchema.index({ date: 1 });
eventSchema.index({ status: 1 });

module.exports = mongoose.model('Event', eventSchema);