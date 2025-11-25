// middleware/missionLimits.js
// Middleware to check mission creation limits for entreprise users

const Mission = require('../models/Mission');

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
        message: 'You need to subscribe to a package to create missions.',
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

    // Define pack limits (no 'none' option here since we already blocked it)
    const packLimits = {
      basic: 3,     // Basic = 3 missions per month
      standard: 5,  // Standard = 5 missions per month  
      premium: 8    // Premium = 8 missions per month (or unlimited)
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
 * Check if particulier user has sufficient tokens
 * This middleware should be used BEFORE the createMission controller
 */
exports.checkParticulierTokens = async (req, res, next) => {
  try {
    // Only check for particulier users
    if (req.user.userType !== 'particulier') {
      return next();
    }

    const { featuredListing } = req.body;

    // Calculate token cost
    const baseTokenCost = 10;
    const featuredCost = featuredListing ? 5 : 0;
    const totalTokenCost = baseTokenCost + featuredCost;

    // Check token balance
    const availableTokens = req.user.tokens?.available || 0;

    if (availableTokens < totalTokenCost) {
      return res.status(400).json({
        success: false,
        message: `Jetons insuffisants. Vous avez besoin de ${totalTokenCost} jetons mais vous n'en avez que ${availableTokens}`,
        details: {
          required: totalTokenCost,
          available: availableTokens,
          breakdown: {
            basePublication: baseTokenCost,
            featuredListing: featuredCost
          },
          suggestion: 'Achetez plus de jetons pour continuer',
          purchaseUrl: '/buy-tokens'
        }
      });
    }

    // Attach token info to request
    req.tokenCost = {
      total: totalTokenCost,
      base: baseTokenCost,
      featured: featuredCost
    };

    console.log(`✅ Token check passed: ${totalTokenCost} tokens will be deducted`);
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
 * Combined middleware that checks both entreprise limits and particulier tokens
 */
exports.checkMissionCreationLimits = async (req, res, next) => {
  try {
    if (req.user.userType === 'entreprise') {
      return exports.checkEntrepriseMissionLimit(req, res, next);
    } else if (req.user.userType === 'particulier') {
      return exports.checkParticulierTokens(req, res, next);
    } else {
      // Other user types cannot create missions
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