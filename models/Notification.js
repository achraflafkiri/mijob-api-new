// models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'new_application', 
      'application_status', 
      'new_message', 
      'event_reminder', 
      'rating_received', 
      'subscription_expiring'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  relatedJobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobOffer'
  },
  relatedEventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  relatedApplicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  actionUrl: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

notificationSchema.index({ userId: 1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: 1 });

module.exports = mongoose.model('Notification', notificationSchema);