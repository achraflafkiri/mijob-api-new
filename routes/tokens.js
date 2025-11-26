// routes/tokens.js
// Routes for token management (particulier users only)

const express = require('express');
const router = express.Router();

const {
  getTokenBalance,
  purchaseTokens,
  useToken,
  getTokenPackages,
  getTokenHistory
} = require('../controllers/tokenController');

const { protect, authorize } = require('../middleware/auth');

// ============================================
// TOKEN ROUTES
// ============================================

/**
 * @route   GET /api/v1/tokens/balance
 * @desc    Get current token balance
 * @access  Private (Particulier only)
 */
router.get(
  '/balance',
  protect,
  authorize('particulier'),
  getTokenBalance
);

/**
 * @route   GET /api/v1/tokens/packages
 * @desc    Get available token packages
 * @access  Private (Particulier only)
 */
router.get(
  '/packages',
  protect,
  authorize('particulier'),
  getTokenPackages
);

/**
 * @route   POST /api/v1/tokens/purchase
 * @desc    Purchase tokens (fake payment for testing)
 * @access  Private (Particulier only)
 * @body    { packageId: 1-4 or 'custom', quantity?: number }
 */
router.post(
  '/purchase',
  protect,
  authorize('particulier'),
  purchaseTokens
);

/**
 * @route   POST /api/v1/tokens/use
 * @desc    Use a token (deduct from balance)
 * @access  Private (Particulier only)
 * @body    { missionId?: string, reason?: string }
 */
router.post(
  '/use',
  protect,
  authorize('particulier'),
  useToken
);

/**
 * @route   GET /api/v1/tokens/history
 * @desc    Get token usage history
 * @access  Private (Particulier only)
 */
router.get(
  '/history',
  protect,
  authorize('particulier'),
  getTokenHistory
);

module.exports = router;