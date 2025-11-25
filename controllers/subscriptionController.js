// controllers/subscriptionController.js
// Controller for handling subscription payments and updates

const User = require('../models/User');

/**
 * Process fake payment and update subscription
 * @route   POST /api/v1/subscriptions/fake-payment
 * @access  Private (Entreprise only)
 */
exports.processFakePayment = async (req, res) => {
  try {
    const { packId, isAnnual } = req.body;

    // Validate user type
    if (req.user.userType !== 'entreprise') {
      return res.status(403).json({
        success: false,
        message: 'Cette fonctionnalité est réservée aux entreprises'
      });
    }

    // Validate pack
    const validPacks = ['basic', 'standard', 'premium'];
    const packMap = {
      1: 'basic',
      2: 'premium',
      '1': 'basic',
      '2': 'premium'
    };

    const subscriptionPlan = packMap[packId] || packId;

    if (!validPacks.includes(subscriptionPlan)) {
      return res.status(400).json({
        success: false,
        message: 'Pack invalide. Choisissez basic, standard ou premium'
      });
    }

    // Calculate subscription dates
    const startDate = new Date();
    const endDate = new Date();
    
    if (isAnnual) {
      // Annual subscription - 12 months
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      // Monthly subscription - 1 month
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Update user subscription
    req.user.subscriptionPlan = subscriptionPlan;
    req.user.subscriptionStartDate = startDate;
    req.user.subscriptionEndDate = endDate;

    await req.user.save();

    // Log the fake payment (for testing purposes)
    console.log('✅ Fake payment processed:', {
      userId: req.user._id,
      email: req.user.email,
      plan: subscriptionPlan,
      isAnnual,
      startDate,
      endDate
    });

    res.status(200).json({
      success: true,
      message: 'Paiement simulé avec succès',
      data: {
        subscription: {
          plan: subscriptionPlan,
          startDate,
          endDate,
          isAnnual,
          daysRemaining: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
        },
        user: {
          _id: req.user._id,
          email: req.user.email,
          subscriptionPlan: req.user.subscriptionPlan,
          subscriptionStartDate: req.user.subscriptionStartDate,
          subscriptionEndDate: req.user.subscriptionEndDate
        }
      }
    });

  } catch (error) {
    console.error('❌ Fake payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du traitement du paiement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get current subscription details
 * @route   GET /api/v1/subscriptions/current
 * @access  Private (Entreprise only)
 */
exports.getCurrentSubscription = async (req, res) => {
  try {
    if (req.user.userType !== 'entreprise') {
      return res.status(403).json({
        success: false,
        message: 'Cette fonctionnalité est réservée aux entreprises'
      });
    }

    const now = new Date();
    const isActive = req.user.subscriptionEndDate && req.user.subscriptionEndDate > now;
    
    let daysRemaining = 0;
    if (isActive) {
      daysRemaining = Math.ceil((req.user.subscriptionEndDate - now) / (1000 * 60 * 60 * 24));
    }

    res.status(200).json({
      success: true,
      data: {
        subscription: {
          plan: req.user.subscriptionPlan || 'none',
          startDate: req.user.subscriptionStartDate,
          endDate: req.user.subscriptionEndDate,
          isActive,
          daysRemaining,
          status: isActive ? 'active' : 'expired'
        }
      }
    });

  } catch (error) {
    console.error('❌ Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'abonnement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Cancel subscription
 * @route   POST /api/v1/subscriptions/cancel
 * @access  Private (Entreprise only)
 */
exports.cancelSubscription = async (req, res) => {
  try {
    if (req.user.userType !== 'entreprise') {
      return res.status(403).json({
        success: false,
        message: 'Cette fonctionnalité est réservée aux entreprises'
      });
    }

    // Set subscription to none
    req.user.subscriptionPlan = 'none';
    req.user.subscriptionEndDate = new Date(); // Expire immediately
    
    await req.user.save();

    res.status(200).json({
      success: true,
      message: 'Abonnement annulé avec succès',
      data: {
        subscriptionPlan: 'none'
      }
    });

  } catch (error) {
    console.error('❌ Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'annulation de l\'abonnement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = exports;