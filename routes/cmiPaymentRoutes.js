// routes/cmiPaymentRoutes.js

const express = require('express');
const router = express.Router();
const cmiPaymentController = require('../controllers/cmiPaymentController');
const { protect } = require('../middleware/auth'); // Adjust this path to match your auth middleware

// ============================================================
// PAYMENT INITIATION
// ============================================================

/**
 * @route   POST /api/v1/payment/cmi/initiate
 * @desc    Initiate CMI payment
 * @access  Private
 */
router.post('/cmi/initiate', protect, cmiPaymentController.initiatePayment);

// ============================================================
// CMI CALLBACKS (These are called by CMI)
// ============================================================

/**
 * @route   POST /api/v1/payment/cmi/success
 * @desc    Handle successful payment callback from CMI
 * @access  Public (called by CMI)
 */
router.post('/cmi/success', cmiPaymentController.handleSuccess);

/**
 * @route   POST /api/v1/payment/cmi/fail
 * @desc    Handle failed payment callback from CMI
 * @access  Public (called by CMI)
 */
router.post('/cmi/fail', cmiPaymentController.handleFail);

/**
 * @route   POST /api/v1/payment/cmi/callback
 * @desc    Handle server-to-server callback from CMI
 * @access  Public (called by CMI server)
 */
router.post('/cmi/callback', cmiPaymentController.handleCallback);

// ============================================================
// PAYMENT METHODS MANAGEMENT
// ============================================================

/**
 * @route   POST /api/v1/payment/methods/add
 * @desc    Add a new payment method (without CMI - direct save)
 * @access  Private
 */
router.post('/methods/add', protect, cmiPaymentController.addPaymentMethodDirect);

/**
 * @route   GET /api/v1/payment/methods
 * @desc    Get user's saved payment methods
 * @access  Private
 */
router.get('/methods', protect, cmiPaymentController.getPaymentMethods);

/**
 * @route   DELETE /api/v1/payment/methods/:paymentMethodId
 * @desc    Delete a payment method
 * @access  Private
 */
router.delete('/methods/:paymentMethodId', protect, cmiPaymentController.deletePaymentMethod);

/**
 * @route   PUT /api/v1/payment/methods/:paymentMethodId/default
 * @desc    Set default payment method
 * @access  Private
 */
router.put('/methods/:paymentMethodId/default', protect, cmiPaymentController.setDefaultPaymentMethod);

module.exports = router;