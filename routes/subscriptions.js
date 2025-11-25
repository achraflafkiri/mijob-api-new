// routes/subscriptions.js
// Routes for subscription management

const express = require('express');
const router = express.Router();

const {
  processFakePayment,
  getCurrentSubscription,
  cancelSubscription
} = require('../controllers/subscriptionController');

const { protect, authorize } = require('../middleware/auth');

// ============================================
// SUBSCRIPTION ROUTES
// ============================================

/**
 * @route   POST /api/v1/subscriptions/fake-payment
 * @desc    Process fake payment for testing (updates user subscription)
 * @access  Private (Entreprise only)
 * @body    { packId: 1 or 2, isAnnual: true/false }
 */
router.post(
  '/fake-payment',
  protect,
  authorize('entreprise'),
  processFakePayment
);

/**
 * @route   GET /api/v1/subscriptions/current
 * @desc    Get current subscription details
 * @access  Private (Entreprise only)
 */
router.get(
  '/current',
  protect,
  authorize('entreprise'),
  getCurrentSubscription
);

/**
 * @route   POST /api/v1/subscriptions/cancel
 * @desc    Cancel current subscription
 * @access  Private (Entreprise only)
 */
router.post(
  '/cancel',
  protect,
  authorize('entreprise'),
  cancelSubscription
);

module.exports = router;