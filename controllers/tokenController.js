// controllers/tokenController.js
// Controller for managing token purchases for particulier users

const User = require('../models/User');

/**
 * Get current token balance
 * @route   GET /api/v1/tokens/balance
 * @access  Private (Particulier only)
 */
exports.getTokenBalance = async (req, res) => {
  try {
    if (req.user.userType !== 'particulier') {
      return res.status(403).json({
        success: false,
        message: 'Les jetons sont réservés aux particuliers uniquement'
      });
    }

    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).select('tokens');

    res.status(200).json({
      success: true,
      data: {
        tokens: {
          available: user.tokens?.available || 0,
          used: user.tokens?.used || 0,
          purchased: user.tokens?.purchased || 0,
          total: (user.tokens?.available || 0) + (user.tokens?.used || 0)
        }
      }
    });

  } catch (error) {
    console.error('❌ Get token balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du solde de jetons',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Process fake token purchase
 * @route   POST /api/v1/tokens/purchase
 * @access  Private (Particulier only)
 */
exports.purchaseTokens = async (req, res) => {
  try {
    const { packageId, quantity } = req.body;

    // Validate user type
    if (req.user.userType !== 'particulier') {
      return res.status(403).json({
        success: false,
        message: 'Les jetons sont réservés aux particuliers uniquement'
      });
    }

    // Token packages
    const tokenPackages = {
      1: { tokens: 10, price: 100, name: 'Pack 10 Jetons' },
      2: { tokens: 25, price: 200, name: 'Pack 25 Jetons' },
      3: { tokens: 50, price: 350, name: 'Pack 50 Jetons' },
      4: { tokens: 100, price: 600, name: 'Pack 100 Jetons' },
      custom: { tokens: quantity || 1, price: (quantity || 1) * 15, name: 'Pack Personnalisé' }
    };

    // Validate package
    let selectedPackage;
    if (packageId === 'custom') {
      if (!quantity || quantity < 1 || quantity > 500) {
        return res.status(400).json({
          success: false,
          message: 'La quantité doit être entre 1 et 500 jetons'
        });
      }
      selectedPackage = tokenPackages.custom;
    } else {
      selectedPackage = tokenPackages[packageId];
      if (!selectedPackage) {
        return res.status(400).json({
          success: false,
          message: 'Pack de jetons invalide'
        });
      }
    }

    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Initialize tokens object if not exists
    if (!user.tokens) {
      user.tokens = {
        available: 0,
        used: 0,
        purchased: 0
      };
    }

    // Add tokens
    const tokensToAdd = selectedPackage.tokens;
    user.tokens.available = (user.tokens.available || 0) + tokensToAdd;
    user.tokens.purchased = (user.tokens.purchased || 0) + tokensToAdd;

    await user.save();

    // Log the fake purchase
    console.log('✅ Fake token purchase processed:', {
      userId: user._id,
      email: user.email,
      package: selectedPackage.name,
      tokensAdded: tokensToAdd,
      price: selectedPackage.price,
      newBalance: user.tokens.available
    });

    res.status(200).json({
      success: true,
      message: `${tokensToAdd} jetons ajoutés avec succès!`,
      data: {
        purchase: {
          package: selectedPackage.name,
          tokensAdded: tokensToAdd,
          price: selectedPackage.price,
          currency: 'DH'
        },
        tokens: {
          available: user.tokens.available,
          used: user.tokens.used,
          purchased: user.tokens.purchased
        }
      }
    });

  } catch (error) {
    console.error('❌ Token purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'achat de jetons',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Use a token (deduct from available)
 * @route   POST /api/v1/tokens/use
 * @access  Private (Particulier only)
 */
exports.useToken = async (req, res) => {
  try {
    const { missionId, reason } = req.body;

    if (req.user.userType !== 'particulier') {
      return res.status(403).json({
        success: false,
        message: 'Les jetons sont réservés aux particuliers uniquement'
      });
    }

    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Check if user has tokens
    const availableTokens = user.tokens?.available || 0;
    if (availableTokens < 1) {
      return res.status(400).json({
        success: false,
        message: 'Vous n\'avez pas assez de jetons',
        details: {
          available: availableTokens,
          required: 1,
          suggestion: 'Achetez plus de jetons pour continuer'
        }
      });
    }

    // Deduct token
    user.tokens.available -= 1;
    user.tokens.used = (user.tokens.used || 0) + 1;

    await user.save();

    console.log('✅ Token used:', {
      userId: user._id,
      missionId,
      reason,
      remainingTokens: user.tokens.available
    });

    res.status(200).json({
      success: true,
      message: 'Jeton utilisé avec succès',
      data: {
        tokens: {
          available: user.tokens.available,
          used: user.tokens.used
        }
      }
    });

  } catch (error) {
    console.error('❌ Use token error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'utilisation du jeton',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get token packages
 * @route   GET /api/v1/tokens/packages
 * @access  Private (Particulier only)
 */
exports.getTokenPackages = async (req, res) => {
  try {
    if (req.user.userType !== 'particulier') {
      return res.status(403).json({
        success: false,
        message: 'Les jetons sont réservés aux particuliers uniquement'
      });
    }

    const packages = [
      {
        id: 1,
        name: 'Pack Découverte',
        tokens: 10,
        price: 100,
        pricePerToken: 10,
        savings: 0,
        popular: false,
        icon: '🎯',
        description: 'Parfait pour commencer',
        gradient: 'from-blue-500 to-cyan-500'
      },
      {
        id: 2,
        name: 'Pack Standard',
        tokens: 25,
        price: 200,
        pricePerToken: 8,
        savings: 50,
        popular: true,
        icon: '⭐',
        description: 'Le plus populaire',
        gradient: 'from-purple-500 to-pink-500'
      },
      {
        id: 3,
        name: 'Pack Premium',
        tokens: 50,
        price: 350,
        pricePerToken: 7,
        savings: 150,
        popular: false,
        icon: '💎',
        description: 'Meilleure valeur',
        gradient: 'from-amber-500 to-orange-500'
      },
      {
        id: 4,
        name: 'Pack VIP',
        tokens: 100,
        price: 600,
        pricePerToken: 6,
        savings: 400,
        popular: false,
        icon: '👑',
        description: 'Économie maximale',
        gradient: 'from-green-500 to-emerald-500'
      }
    ];

    res.status(200).json({
      success: true,
      data: {
        packages,
        customAvailable: true,
        customPrice: 15, // DH per token
        minCustom: 1,
        maxCustom: 500
      }
    });

  } catch (error) {
    console.error('❌ Get packages error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des packs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get token usage history
 * @route   GET /api/v1/tokens/history
 * @access  Private (Particulier only)
 */
exports.getTokenHistory = async (req, res) => {
  try {
    if (req.user.userType !== 'particulier') {
      return res.status(403).json({
        success: false,
        message: 'Les jetons sont réservés aux particuliers uniquement'
      });
    }

    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).select('tokens');

    // For now, return basic stats
    // In production, you'd have a TokenTransaction model
    const history = {
      summary: {
        totalPurchased: user.tokens?.purchased || 0,
        totalUsed: user.tokens?.used || 0,
        currentBalance: user.tokens?.available || 0
      },
      recentTransactions: [
        // This would come from a TokenTransaction model in production
      ]
    };

    res.status(200).json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('❌ Get token history error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = exports;