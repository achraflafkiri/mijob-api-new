// routes/tokens.js
// Routes for token management (particulier users only)
// WITH Token model for transaction history

const express = require('express');
const router = express.Router();

const {
  getTokenBalance,
  purchaseTokens,
  useToken,
  getTokenPackages,
  getTokenHistory,
  getTokenStats
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
 * 
 * @example
 * POST /api/v1/tokens/purchase
 * {
 *   "packageId": 2
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "25 jetons ajoutés avec succès!",
 *   "data": {
 *     "purchase": {
 *       "package": "Pack Standard",
 *       "tokensAdded": 25,
 *       "price": 200,
 *       "currency": "DH",
 *       "transactionId": "..."
 *     },
 *     "tokens": {
 *       "available": 35,
 *       "used": 0,
 *       "purchased": 25,
 *       "previousBalance": 10
 *     }
 *   }
 * }
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
 * @body    { missionId?: string, conversationId?: string, reason?: string }
 * 
 * @example
 * POST /api/v1/tokens/use
 * {
 *   "missionId": "673f...",
 *   "reason": "Création de mission"
 * }
 */
router.post(
  '/use',
  protect,
  authorize('particulier'),
  useToken
);

/**
 * @route   GET /api/v1/tokens/history
 * @desc    Get token usage history with pagination
 * @access  Private (Particulier only)
 * @query   page, limit, type (purchase|used|refund|expired)
 * 
 * @example
 * GET /api/v1/tokens/history?page=1&limit=20&type=purchase
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "summary": {
 *       "currentBalance": 35,
 *       "totalPurchased": 50,
 *       "totalUsed": 15,
 *       "lastPurchase": "2025-11-27T...",
 *       "lastUsage": "2025-11-27T..."
 *     },
 *     "transactions": [
 *       {
 *         "id": "...",
 *         "type": "purchase",
 *         "amount": 25,
 *         "balanceBefore": 10,
 *         "balanceAfter": 35,
 *         "reason": "Achat de jetons",
 *         "packageName": "Pack Standard",
 *         "price": 200,
 *         "createdAt": "2025-11-27T..."
 *       }
 *     ],
 *     "pagination": {
 *       "page": 1,
 *       "limit": 20,
 *       "total": 5,
 *       "pages": 1
 *     }
 *   }
 * }
 */
router.get(
  '/history',
  protect,
  authorize('particulier'),
  getTokenHistory
);

/**
 * @route   GET /api/v1/tokens/stats
 * @desc    Get token statistics and usage breakdown
 * @access  Private (Particulier only)
 * 
 * @example
 * GET /api/v1/tokens/stats
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "balance": 35,
 *     "totalPurchased": 50,
 *     "totalUsed": 15,
 *     "totalSpent": 450,
 *     "averagePurchase": 225,
 *     "purchaseCount": 2,
 *     "usageBreakdown": {
 *       "missions": 10,
 *       "conversations": 5,
 *       "other": 0
 *     },
 *     "lastPurchase": "2025-11-27T...",
 *     "lastUsage": "2025-11-27T..."
 *   }
 * }
 */
router.get(
  '/stats',
  protect,
  authorize('particulier'),
  getTokenStats
);

module.exports = router;