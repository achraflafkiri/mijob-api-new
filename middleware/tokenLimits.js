// middleware/tokenLimits.js
// Middleware to check and deduct tokens for particulier users when creating conversations

const User = require('../models/User');

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
    
    // Get fresh user data to ensure token balance is accurate
    const user = await User.findById(userId).select('tokens userType');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const availableTokens = user.tokens?.available || 0;

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
 * @desc Called after conversation is created to deduct 1 token
 */
exports.deductToken = async (req, res, next) => {
  try {
    // Only deduct for particulier users
    if (req.user.userType !== 'particulier') {
      return next();
    }

    const userId = req.user._id || req.user.id;
    
    // Get fresh user data
    const user = await User.findById(userId);
    
    if (!user) {
      console.error('❌ User not found for token deduction');
      return next(); // Continue anyway, conversation was already created
    }

    // Deduct 1 token
    const previousAvailable = user.tokens?.available || 0;
    
    user.tokens.available = Math.max(0, (user.tokens.available || 0) - 1);
    user.tokens.used = (user.tokens.used || 0) + 1;
    
    await user.save();

    const newAvailable = user.tokens.available;

    console.log(`✅ Token deducted - User: ${userId}, Before: ${previousAvailable}, After: ${newAvailable}`);
    console.log(`📊 Token usage - Available: ${newAvailable}, Used: ${user.tokens.used}, Purchased: ${user.tokens.purchased}`);

    // Attach updated token info to request
    req.tokenDeducted = {
      success: true,
      previousBalance: previousAvailable,
      newBalance: newAvailable,
      used: user.tokens.used
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
    const user = await User.findById(userId).select('tokens');
    
    if (!user) {
      req.tokenStatus = {
        userType: 'particulier',
        hasTokens: false,
        available: 0
      };
      return next();
    }

    const availableTokens = user.tokens?.available || 0;

    req.tokenStatus = {
      userType: 'particulier',
      hasTokens: availableTokens > 0,
      available: availableTokens,
      used: user.tokens?.used || 0,
      purchased: user.tokens?.purchased || 0
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