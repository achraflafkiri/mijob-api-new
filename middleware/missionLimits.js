// middleware/missionLimits.js - WITH TOKEN MODEL INTEGRATION
// Middleware to check mission creation limits for entreprise users
// AND token deduction for particulier users WITH TRANSACTION HISTORY

const Mission = require('../models/Mission');
const User = require('../models/User');
const Token = require('../models/Token');

/**
 * Check if entreprise user has reached their monthly mission limit
 * This middleware should be used BEFORE the createMission controller
 */
exports.checkEntrepriseMissionLimit = async (req, res, next) => {
  try {
    // Only check for entreprise users
    if (req.user.userType !== 'entreprise') {
      return next();
    }

    const userPlan = req.user.subscriptionPlan || 'none';

    // FIRST: Block users without any subscription
    if (userPlan === 'none' || !userPlan) {
      return res.status(403).json({
        success: false,
        message: 'Vous devez souscrire à un pack pour créer des missions.',
        details: {
          subscriptionPlan: 'none',
          reason: 'Aucun pack actif',
          availablePacks: [
            { name: 'Basic', limit: 3, description: '3 missions par mois' },
            { name: 'Standard', limit: 5, description: '5 missions par mois' },
            { name: 'Premium', limit: 8, description: '8 missions par mois + featured listings' }
          ],
          action: 'Choisissez un pack pour commencer',
          upgradeUrl: '/pricing'
        }
      });
    }

    // Get current month and year
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Count missions created this month
    const missionsThisMonth = await Mission.countDocuments({
      createdBy: req.user._id,
      createdAt: {
        $gte: new Date(currentYear, currentMonth, 1),
        $lt: new Date(currentYear, currentMonth + 1, 1)
      }
    });

    // Define pack limits
    const packLimits = {
      basic: 3,     // Basic = 3 missions per month
      standard: 5,  // Standard = 5 missions per month  
      premium: 8    // Premium = 8 missions per month
    };

    const monthlyLimit = packLimits[userPlan];

    // Check if limit is reached
    if (missionsThisMonth >= monthlyLimit) {
      return res.status(400).json({
        success: false,
        message: `Vous avez atteint votre limite mensuelle de ${monthlyLimit} missions pour le pack ${userPlan}.`,
        details: {
          currentMissions: missionsThisMonth,
          monthlyLimit: monthlyLimit,
          subscriptionPlan: userPlan,
          suggestion: userPlan === 'basic' 
            ? 'Passez au pack Standard (5 missions/mois) ou Premium (8 missions/mois)' 
            : userPlan === 'standard'
            ? 'Passez au pack Premium pour 8 missions par mois'
            : 'Contactez-nous pour augmenter votre limite',
          upgradeUrl: '/upgrade-subscription'
        }
      });
    }

    // Attach usage info to request for use in controller
    req.missionUsage = {
      used: missionsThisMonth,
      limit: monthlyLimit,
      remaining: monthlyLimit - missionsThisMonth,
      plan: userPlan
    };

    console.log(`✅ Mission limit check passed: ${missionsThisMonth}/${monthlyLimit} missions used`);
    next();

  } catch (error) {
    console.error('❌ Error checking mission limits:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification des limites',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Check if particulier user has sufficient tokens FOR MISSION CREATION
 * This middleware should be used BEFORE the createMission controller
 * 
 * TOKEN COSTS (from cahier des charges):
 * - Base publication: 10 jetons
 * - Featured listing: +5 jetons
 * - Total max: 15 jetons
 */
exports.checkParticulierTokens = async (req, res, next) => {
  try {
    // Only check for particulier users
    if (req.user.userType !== 'particulier') {
      return next();
    }

    const { featuredListing } = req.body;

    // Calculate token cost according to cahier des charges
    const baseTokenCost = 10;  // Coût de publication: 10 jetons
    const featuredCost = featuredListing ? 5 : 0;  // Mise en avant: +5 jetons
    const totalTokenCost = baseTokenCost + featuredCost;

    const userId = req.user._id || req.user.id;
    
    // ✨ Use Token model instead of User.tokens
    const tokenDoc = await Token.findOrCreate(userId);
    const availableTokens = tokenDoc.balance;

    console.log(`🪙 Token check for mission - User: ${userId}, Available: ${availableTokens}, Required: ${totalTokenCost}`);

    if (availableTokens < totalTokenCost) {
      return res.status(400).json({
        success: false,
        message: `Jetons insuffisants. Vous avez besoin de ${totalTokenCost} jetons mais vous n'en avez que ${availableTokens}`,
        isTokenError: true,
        details: {
          required: totalTokenCost,
          available: availableTokens,
          breakdown: {
            basePublication: baseTokenCost,
            featuredListing: featuredCost
          },
          suggestion: 'Achetez plus de jetons pour continuer',
          action: 'purchase_tokens',
          purchaseUrl: '/buy-tokens'
        }
      });
    }

    // Attach token info to request for use in controller
    req.tokenCost = {
      total: totalTokenCost,
      base: baseTokenCost,
      featured: featuredCost,
      availableBefore: availableTokens
    };

    console.log(`✅ Token check passed: ${totalTokenCost} jetons will be deducted (${availableTokens} available)`);
    next();

  } catch (error) {
    console.error('❌ Error checking tokens:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification des jetons',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * DEDUCT TOKENS after successful mission creation WITH TRANSACTION HISTORY
 * This middleware should be called AFTER createMission controller
 * Only for particulier users
 */
exports.deductMissionTokens = async (req, res, next) => {
  try {
    // Only deduct for particulier users
    if (req.user.userType !== 'particulier') {
      return next();
    }

    // Check if token cost info was attached by checkParticulierTokens
    if (!req.tokenCost) {
      console.error('❌ Token cost not found in request');
      return next();
    }

    const tokenCost = req.tokenCost.total;
    const userId = req.user._id || req.user.id;

    // ✨ Use Token model for transaction history
    const tokenDoc = await Token.findOrCreate(userId);
    const previousBalance = tokenDoc.balance;

    // Add transaction with mission reference
    tokenDoc.addTransaction({
      type: 'used',
      amount: tokenCost,
      reason: 'Création de mission',
      relatedMissionId: req.mission?._id, // If available from controller
      packageName: req.tokenCost.featured > 0 ? 'Mission avec featured' : 'Mission standard',
      metadata: {
        action: 'mission_creation',
        featured: req.tokenCost.featured > 0,
        breakdown: {
          basePublication: req.tokenCost.base,
          featuredListing: req.tokenCost.featured
        }
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

    console.log(`✅ Mission tokens deducted - User: ${userId}`);
    console.log(`   Cost: ${tokenCost} jetons`);
    console.log(`   Before: ${previousBalance} jetons`);
    console.log(`   After: ${tokenDoc.balance} jetons`);
    console.log(`   Total used: ${tokenDoc.totalUsed} jetons`);

    // Attach token deduction info to response
    req.tokenDeducted = {
      success: true,
      cost: tokenCost,
      previousBalance: previousBalance,
      newBalance: tokenDoc.balance,
      totalUsed: tokenDoc.totalUsed,
      breakdown: {
        basePublication: req.tokenCost.base,
        featuredListing: req.tokenCost.featured
      },
      transactionId: tokenDoc.transactions[tokenDoc.transactions.length - 1]._id
    };

    next();

  } catch (error) {
    console.error('❌ Error deducting mission tokens:', error);
    // Don't block the response, mission was already created
    next();
  }
};

/**
 * Combined middleware that checks both entreprise limits and particulier tokens
 */
exports.checkMissionCreationLimits = async (req, res, next) => {
  try {
    if (req.user.userType === 'entreprise') {
      return exports.checkEntrepriseMissionLimit(req, res, next);
    } else if (req.user.userType === 'particulier') {
      return exports.checkParticulierTokens(req, res, next);
    } else {
      // Other user types (partimer) cannot create missions
      return res.status(403).json({
        success: false,
        message: 'Seuls les entreprises et particuliers peuvent créer des missions'
      });
    }
  } catch (error) {
    console.error('❌ Error in checkMissionCreationLimits:', error);
    next(error);
  }
};

module.exports = exports;