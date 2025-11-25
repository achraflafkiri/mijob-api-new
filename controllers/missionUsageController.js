// controllers/missionUsageController.js
// Controller for checking mission creation limits and usage

const Mission = require('../models/Mission');

/**
 * Get current mission usage for entreprise
 * @route   GET /api/missions/usage/current
 * @access  Private (Entreprise only)
 */
exports.getCurrentUsage = async (req, res) => {
  try {
    if (req.user.userType !== 'entreprise') {
      return res.status(403).json({
        success: false,
        message: 'Cet endpoint est réservé aux entreprises'
      });
    }

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Count missions this month
    const missionsThisMonth = await Mission.countDocuments({
      createdBy: req.user._id,
      createdAt: {
        $gte: new Date(currentYear, currentMonth, 1),
        $lt: new Date(currentYear, currentMonth + 1, 1)
      }
    });

    // Define limits
    const packLimits = {
      none: 0,
      basic: 3,
      standard: 5,
      premium: 8
    };

    const userPlan = req.user.subscriptionPlan || 'none';
    const monthlyLimit = packLimits[userPlan];

    res.status(200).json({
      success: true,
      data: {
        usage: {
          used: missionsThisMonth,
          limit: monthlyLimit,
          remaining: Math.max(0, monthlyLimit - missionsThisMonth),
          percentage: monthlyLimit > 0 ? Math.round((missionsThisMonth / monthlyLimit) * 100) : 0
        },
        subscription: {
          plan: userPlan,
          canCreateMission: missionsThisMonth < monthlyLimit,
          nextResetDate: new Date(currentYear, currentMonth + 1, 1)
        },
        suggestions: getSuggestions(userPlan, missionsThisMonth, monthlyLimit)
      }
    });

  } catch (error) {
    console.error('❌ Error getting usage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des données d\'utilisation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get detailed mission history for current month
 * @route   GET /api/missions/usage/history
 * @access  Private (Entreprise only)
 */
exports.getMonthlyHistory = async (req, res) => {
  try {
    if (req.user.userType !== 'entreprise') {
      return res.status(403).json({
        success: false,
        message: 'Cet endpoint est réservé aux entreprises'
      });
    }

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Get all missions this month
    const missions = await Mission.find({
      createdBy: req.user._id,
      createdAt: {
        $gte: new Date(currentYear, currentMonth, 1),
        $lt: new Date(currentYear, currentMonth + 1, 1)
      }
    })
    .select('title status createdAt applicationCount views')
    .sort('-createdAt');

    // Get statistics
    const stats = await Mission.aggregate([
      {
        $match: {
          createdBy: req.user._id,
          createdAt: {
            $gte: new Date(currentYear, currentMonth, 1),
            $lt: new Date(currentYear, currentMonth + 1, 1)
          }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        missions,
        statistics: {
          total: missions.length,
          byStatus: stats.reduce((acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
          }, {}),
          totalApplications: missions.reduce((sum, m) => sum + m.applicationCount, 0),
          totalViews: missions.reduce((sum, m) => sum + m.views, 0)
        },
        month: {
          name: new Date(currentYear, currentMonth).toLocaleString('fr-FR', { month: 'long' }),
          year: currentYear
        }
      }
    });

  } catch (error) {
    console.error('❌ Error getting history:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Check if user can create a mission
 * @route   GET /api/missions/usage/can-create
 * @access  Private (Entreprise/Particulier)
 */
exports.canCreateMission = async (req, res) => {
  try {
    let canCreate = true;
    let reason = null;
    let details = {};

    if (req.user.userType === 'entreprise') {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const missionsThisMonth = await Mission.countDocuments({
        createdBy: req.user._id,
        createdAt: {
          $gte: new Date(currentYear, currentMonth, 1),
          $lt: new Date(currentYear, currentMonth + 1, 1)
        }
      });

      const packLimits = {
        none: 0,
        basic: 3,
        standard: 5,
        premium: 8
      };

      const userPlan = req.user.subscriptionPlan || 'none';
      const monthlyLimit = packLimits[userPlan];

      canCreate = missionsThisMonth < monthlyLimit;
      
      if (!canCreate) {
        reason = `Limite mensuelle atteinte (${monthlyLimit} missions)`;
      }

      details = {
        used: missionsThisMonth,
        limit: monthlyLimit,
        remaining: Math.max(0, monthlyLimit - missionsThisMonth),
        plan: userPlan
      };

    } else if (req.user.userType === 'particulier') {
      const { featuredListing } = req.query;
      const baseTokenCost = 10;
      const featuredCost = featuredListing === 'true' ? 5 : 0;
      const totalTokenCost = baseTokenCost + featuredCost;
      const availableTokens = req.user.tokens?.available || 0;

      canCreate = availableTokens >= totalTokenCost;
      
      if (!canCreate) {
        reason = `Jetons insuffisants (${totalTokenCost} requis, ${availableTokens} disponibles)`;
      }

      details = {
        required: totalTokenCost,
        available: availableTokens,
        breakdown: {
          base: baseTokenCost,
          featured: featuredCost
        }
      };
    }

    res.status(200).json({
      success: true,
      data: {
        canCreate,
        reason,
        userType: req.user.userType,
        ...details
      }
    });

  } catch (error) {
    console.error('❌ Error checking if can create:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get usage statistics for all time
 * @route   GET /api/missions/usage/stats
 * @access  Private (Entreprise only)
 */
exports.getAllTimeStats = async (req, res) => {
  try {
    if (req.user.userType !== 'entreprise') {
      return res.status(403).json({
        success: false,
        message: 'Cet endpoint est réservé aux entreprises'
      });
    }

    const totalMissions = await Mission.countDocuments({
      createdBy: req.user._id
    });

    const missionsByStatus = await Mission.aggregate([
      { $match: { createdBy: req.user._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const missionsByMonth = await Mission.aggregate([
      { $match: { createdBy: req.user._id } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalMissions,
        byStatus: missionsByStatus.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        monthlyTrend: missionsByMonth
      }
    });

  } catch (error) {
    console.error('❌ Error getting all-time stats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper function to generate suggestions
function getSuggestions(plan, used, limit) {
  const remaining = limit - used;
  const suggestions = [];

  if (remaining === 0) {
    suggestions.push('Vous avez atteint votre limite mensuelle');
    
    if (plan === 'basic') {
      suggestions.push('Passez au pack Standard pour 5 missions/mois');
      suggestions.push('Ou au pack Premium pour 8 missions/mois');
    } else if (plan === 'standard') {
      suggestions.push('Passez au pack Premium pour 8 missions/mois');
    } else if (plan === 'none') {
      suggestions.push('Souscrivez à un pack pour commencer à publier des missions');
    }
  } else if (remaining <= 1) {
    suggestions.push(`Attention: il ne vous reste que ${remaining} mission(s)`);
    suggestions.push('Pensez à upgrader votre pack avant la fin du mois');
  } else if (remaining <= limit * 0.3) {
    suggestions.push(`Il vous reste ${remaining} missions ce mois-ci`);
  }

  return suggestions;
}

module.exports = exports;