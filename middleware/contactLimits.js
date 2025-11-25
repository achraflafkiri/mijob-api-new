// middleware/contactLimits.js
// Middleware to enforce monthly contact limits for entreprise users

const Conversation = require('../models/Conversation');

/**
 * Check if entreprise user has reached their monthly contact limit
 * @desc Prevents creating new conversations if limit is reached
 */
exports.checkContactLimit = async (req, res, next) => {
  try {
    // Only check for entreprise users
    if (req.user.userType !== 'entreprise') {
      return next();
    }

    const userId = req.user._id || req.user.id;
    const userPlan = req.user.subscriptionPlan || 'none';

    // Contact limits per plan
    const contactLimits = {
      none: 0,      // No subscription = no contacts
      basic: 2,     // Basic = 2 contacts/month
      standard: 7,  // Standard = 7 contacts/month
      premium: 10   // Premium = 10 contacts/month
    };

    const monthlyLimit = contactLimits[userPlan];

    // Get current month and year
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Count unique conversations created by this user this month
    const contactsThisMonth = await Conversation.countDocuments({
      participants: userId,
      createdAt: {
        $gte: new Date(currentYear, currentMonth, 1),
        $lt: new Date(currentYear, currentMonth + 1, 1)
      }
    });

    console.log(`📊 Contact limit check - User: ${userId}, Plan: ${userPlan}, Used: ${contactsThisMonth}/${monthlyLimit}`);

    // Check if limit reached
    if (contactsThisMonth >= monthlyLimit) {
      return res.status(400).json({
        success: false,
        message: `Vous avez atteint votre limite mensuelle de ${monthlyLimit} contacts pour le pack ${userPlan}.`,
        isPaymentError: true,
        details: {
          currentContacts: contactsThisMonth,
          monthlyLimit: monthlyLimit,
          subscriptionPlan: userPlan,
          suggestion: userPlan === 'basic' 
            ? 'Passez au pack Standard (7 contacts/mois) ou Premium (10 contacts/mois) pour contacter plus de candidats.'
            : userPlan === 'standard'
            ? 'Passez au pack Premium pour 10 contacts par mois.'
            : 'Contactez-nous pour augmenter votre limite.',
          upgradeUrl: '/pricing'
        }
      });
    }

    // Attach usage info to request for use in controller
    req.contactUsage = {
      used: contactsThisMonth,
      limit: monthlyLimit,
      remaining: monthlyLimit - contactsThisMonth,
      plan: userPlan
    };

    console.log(`✅ Contact limit check passed: ${contactsThisMonth}/${monthlyLimit} contacts used`);
    next();

  } catch (error) {
    console.error('❌ Error checking contact limits:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification des limites de contact',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Check if user has NO subscription at all
 * @desc Blocks conversation creation completely for users without subscription
 */
exports.requireSubscription = async (req, res, next) => {
  try {
    // Only check for entreprise users
    if (req.user.userType !== 'entreprise') {
      return next();
    }

    const userPlan = req.user.subscriptionPlan || 'none';

    // Block if no subscription
    if (userPlan === 'none' || !userPlan) {
      return res.status(403).json({
        success: false,
        message: 'Vous devez souscrire à un pack pour contacter des candidats.',
        details: {
          subscriptionPlan: 'none',
          reason: 'Aucun pack actif',
          availablePacks: [
            { name: 'Basic', contacts: 2, description: '5 contacts par mois' },
            { name: 'Standard', contacts: 7, description: '7 contacts par mois' },
            { name: 'Premium', contacts: 10, description: '10 contacts par mois' }
          ],
          action: 'Choisissez un pack pour commencer à contacter des candidats',
          upgradeUrl: '/pricing'
        }
      });
    }

    next();

  } catch (error) {
    console.error('❌ Error checking subscription:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification de l\'abonnement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = exports;