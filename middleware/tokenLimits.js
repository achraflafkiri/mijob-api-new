// middleware/tokenLimits.js
// Middleware to check and deduct tokens for particulier users when creating conversations
// UPDATED WITH TOKEN MODEL for transaction history

const User = require('../models/User');
const Token = require('../models/Token');

/**
 * Check if particulier user has available tokens for conversation
 * @desc Prevents creating conversations if no tokens available
 */
exports.checkTokenAvailability = async (req, res, next) => {
  try {
    // Only check for particulier users
    if (req.user.userType !== 'particulier') {
      return next();
    }

    const userId = req.user._id || req.user.id;
    
    // ✨ Use Token model instead of User.tokens
    const tokenDoc = await Token.findOrCreate(userId);
    const availableTokens = tokenDoc.balance;

    console.log(`🪙 Token check - User: ${userId}, Available: ${availableTokens}`);

    // Check if user has at least 1 token
    if (availableTokens < 1) {
      return res.status(400).json({
        success: false,
        message: 'Vous n\'avez pas assez de jetons pour contacter ce candidat',
        isTokenError: true,
        details: {
          available: availableTokens,
          required: 1,
          suggestion: 'Achetez plus de jetons pour continuer à contacter des candidats',
          action: 'purchase_tokens'
        }
      });
    }

    // Attach token info to request for use in controller
    req.tokenInfo = {
      available: availableTokens,
      willBeDeducted: true
    };

    console.log(`✅ Token check passed: ${availableTokens} jeton(s) disponible(s)`);
    next();

  } catch (error) {
    console.error('❌ Error checking token availability:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification des jetons',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Deduct token after successful conversation creation
 * @desc Called after conversation is created to deduct 1 token WITH TRANSACTION HISTORY
 */
exports.deductToken = async (req, res, next) => {
  try {
    // Only deduct for particulier users
    if (req.user.userType !== 'particulier') {
      return next();
    }

    const userId = req.user._id || req.user.id;
    
    // ✨ Use Token model for transaction history
    const tokenDoc = await Token.findOrCreate(userId);
    const previousBalance = tokenDoc.balance;

    // Add transaction with conversation reference
    tokenDoc.addTransaction({
      type: 'used',
      amount: 1,
      reason: 'Création de conversation',
      relatedConversationId: req.conversation?._id, // If available from controller
      metadata: {
        action: 'conversation_creation',
        conversationType: 'recruiter_to_partimer'
      }
    });

    await tokenDoc.save();

    // Sync with User model for backward compatibility
    const user = await User.findById(userId);
    if (user && user.tokens) {
      user.tokens.available = tokenDoc.balance;
      user.tokens.used = tokenDoc.totalUsed;
      await user.save();
    }

    console.log(`✅ Token deducted - User: ${userId}, Before: ${previousBalance}, After: ${tokenDoc.balance}`);
    console.log(`📊 Token usage - Available: ${tokenDoc.balance}, Used: ${tokenDoc.totalUsed}, Purchased: ${tokenDoc.totalPurchased}`);

    // Attach updated token info to request
    req.tokenDeducted = {
      success: true,
      previousBalance: previousBalance,
      newBalance: tokenDoc.balance,
      used: tokenDoc.totalUsed,
      transactionId: tokenDoc.transactions[tokenDoc.transactions.length - 1]._id
    };

    next();

  } catch (error) {
    console.error('❌ Error deducting token:', error);
    // Don't block the response, just log the error
    // Conversation was already created successfully
    next();
  }
};

/**
 * Check if particulier has tokens without blocking
 * @desc Returns token info for display purposes
 */
exports.getTokenStatus = async (req, res, next) => {
  try {
    if (req.user.userType !== 'particulier') {
      req.tokenStatus = {
        userType: req.user.userType,
        hasTokens: true,
        message: 'Not applicable for this user type'
      };
      return next();
    }

    const userId = req.user._id || req.user.id;
    
    // ✨ Use Token model
    const tokenDoc = await Token.findOrCreate(userId);

    req.tokenStatus = {
      userType: 'particulier',
      hasTokens: tokenDoc.balance > 0,
      available: tokenDoc.balance,
      used: tokenDoc.totalUsed,
      purchased: tokenDoc.totalPurchased
    };

    next();

  } catch (error) {
    console.error('❌ Error getting token status:', error);
    req.tokenStatus = {
      userType: 'particulier',
      hasTokens: false,
      error: error.message
    };
    next();
  }
};

module.exports = exports;