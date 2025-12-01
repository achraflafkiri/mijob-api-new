// controllers/tokenController.js
// Controller for managing token purchases for particulier users
// WITH Token model for transaction history

const User = require('../models/User');
const Token = require('../models/Token');

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
    
    // Get or create token document
    const tokenDoc = await Token.findOrCreate(userId);
    
    // Also sync with User model for consistency
    const user = await User.findById(userId).select('tokens');

    res.status(200).json({
      success: true,
      data: {
        available: tokenDoc.balance,
        used: tokenDoc.totalUsed,
        purchased: tokenDoc.totalPurchased,
        total: tokenDoc.totalPurchased,
        lastPurchase: tokenDoc.lastPurchaseDate,
        lastUsage: tokenDoc.lastUsageDate
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
 * Process fake token purchase WITH transaction history
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
      1: { tokens: 10, price: 100, name: 'Pack Découverte' },
      2: { tokens: 25, price: 200, name: 'Pack Standard' },
      3: { tokens: 50, price: 350, name: 'Pack Premium' },
      4: { tokens: 100, price: 600, name: 'Pack VIP' },
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
    
    // Get or create token document
    const tokenDoc = await Token.findOrCreate(userId);
    
    // Also get user for sync
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const tokensToAdd = selectedPackage.tokens;
    const previousBalance = tokenDoc.balance;

    // Add transaction to Token model
    tokenDoc.addTransaction({
      type: 'purchase',
      amount: tokensToAdd,
      reason: 'Achat de jetons',
      packageName: selectedPackage.name,
      price: selectedPackage.price,
      metadata: {
        packageId,
        paymentMethod: 'fake', // For testing
        currency: 'DH'
      }
    });

    await tokenDoc.save();

    // Sync with User model (for backward compatibility)
    if (!user.tokens) {
      user.tokens = {
        available: 0,
        used: 0,
        purchased: 0
      };
    }
    user.tokens.available = tokenDoc.balance;
    user.tokens.purchased = tokenDoc.totalPurchased;
    user.tokens.used = tokenDoc.totalUsed;
    
    await user.save();

    // Log the purchase
    console.log('✅ Token purchase processed with transaction history:', {
      userId: user._id,
      email: user.email,
      package: selectedPackage.name,
      tokensAdded: tokensToAdd,
      price: selectedPackage.price,
      previousBalance,
      newBalance: tokenDoc.balance,
      transactionId: tokenDoc.transactions[tokenDoc.transactions.length - 1]._id
    });

    res.status(200).json({
      success: true,
      message: `${tokensToAdd} jetons ajoutés avec succès!`,
      data: {
        purchase: {
          package: selectedPackage.name,
          tokensAdded: tokensToAdd,
          price: selectedPackage.price,
          currency: 'DH',
          transactionId: tokenDoc.transactions[tokenDoc.transactions.length - 1]._id
        },
        tokens: {
          available: tokenDoc.balance,
          used: tokenDoc.totalUsed,
          purchased: tokenDoc.totalPurchased,
          previousBalance
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
 * Use a token (deduct from available) WITH transaction history
 * @route   POST /api/v1/tokens/use
 * @access  Private (Particulier only)
 */
exports.useToken = async (req, res) => {
  try {
    const { missionId, conversationId, reason } = req.body;

    if (req.user.userType !== 'particulier') {
      return res.status(403).json({
        success: false,
        message: 'Les jetons sont réservés aux particuliers uniquement'
      });
    }

    const userId = req.user._id || req.user.id;
    
    // Get or create token document
    const tokenDoc = await Token.findOrCreate(userId);

    // Check if user has tokens
    if (tokenDoc.balance < 1) {
      return res.status(400).json({
        success: false,
        message: 'Vous n\'avez pas assez de jetons',
        details: {
          available: tokenDoc.balance,
          required: 1,
          suggestion: 'Achetez plus de jetons pour continuer'
        }
      });
    }

    const previousBalance = tokenDoc.balance;

    // Add transaction
    tokenDoc.addTransaction({
      type: 'used',
      amount: 1,
      reason: reason || 'Utilisation de jeton',
      relatedMissionId: missionId,
      relatedConversationId: conversationId,
      metadata: {
        action: missionId ? 'mission_creation' : conversationId ? 'conversation_creation' : 'other'
      }
    });

    await tokenDoc.save();

    // Sync with User model
    const user = await User.findById(userId);
    if (user && user.tokens) {
      user.tokens.available = tokenDoc.balance;
      user.tokens.used = tokenDoc.totalUsed;
      await user.save();
    }

    console.log('✅ Token used with transaction history:', {
      userId,
      missionId,
      conversationId,
      reason,
      previousBalance,
      newBalance: tokenDoc.balance,
      transactionId: tokenDoc.transactions[tokenDoc.transactions.length - 1]._id
    });

    res.status(200).json({
      success: true,
      message: 'Jeton utilisé avec succès',
      data: {
        tokens: {
          available: tokenDoc.balance,
          used: tokenDoc.totalUsed,
          previousBalance
        },
        transactionId: tokenDoc.transactions[tokenDoc.transactions.length - 1]._id
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
        gradient: 'from-blue-500 to-cyan-500',
        features: [
          '10 jetons',
          'Valable 1 an',
          'Support standard'
        ]
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
        gradient: 'from-purple-500 to-pink-500',
        features: [
          '25 jetons',
          'Économisez 50 DH',
          'Valable 1 an',
          'Support prioritaire'
        ]
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
        gradient: 'from-amber-500 to-orange-500',
        features: [
          '50 jetons',
          'Économisez 150 DH',
          'Valable 1 an',
          'Support prioritaire',
          'Bonus exclusifs'
        ]
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
        gradient: 'from-green-500 to-emerald-500',
        features: [
          '100 jetons',
          'Économisez 400 DH',
          'Valable 1 an',
          'Support VIP 24/7',
          'Bonus exclusifs',
          'Accès anticipé'
        ]
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
 * Get token usage history WITH full transaction details
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
    const { page = 1, limit = 20, type } = req.query;

    // Get or create token document
    const tokenDoc = await Token.findOrCreate(userId);

    // Filter transactions by type if specified
    let transactions = tokenDoc.transactions;
    if (type && ['purchase', 'used', 'refund', 'expired'].includes(type)) {
      transactions = transactions.filter(t => t.type === type);
    }

    // Sort by date (newest first)
    transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedTransactions = transactions.slice(startIndex, endIndex);

    // Format transactions for response
    const formattedTransactions = paginatedTransactions.map(t => ({
      id: t._id,
      type: t.type,
      amount: t.amount,
      balanceBefore: t.balanceBefore,
      balanceAfter: t.balanceAfter,
      reason: t.reason,
      packageName: t.packageName,
      price: t.price,
      relatedMissionId: t.relatedMissionId,
      relatedConversationId: t.relatedConversationId,
      metadata: t.metadata,
      createdAt: t.createdAt
    }));

    res.status(200).json({
      success: true,
      data: {
        summary: {
          currentBalance: tokenDoc.balance,
          totalPurchased: tokenDoc.totalPurchased,
          totalUsed: tokenDoc.totalUsed,
          lastPurchase: tokenDoc.lastPurchaseDate,
          lastUsage: tokenDoc.lastUsageDate
        },
        transactions: formattedTransactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: transactions.length,
          pages: Math.ceil(transactions.length / limit)
        }
      }
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

/**
 * Get token statistics
 * @route   GET /api/v1/tokens/stats
 * @access  Private (Particulier only)
 */
exports.getTokenStats = async (req, res) => {
  try {
    if (req.user.userType !== 'particulier') {
      return res.status(403).json({
        success: false,
        message: 'Les jetons sont réservés aux particuliers uniquement'
      });
    }

    const userId = req.user._id || req.user.id;
    const tokenDoc = await Token.findOrCreate(userId);

    // Calculate statistics
    const purchaseTransactions = tokenDoc.transactions.filter(t => t.type === 'purchase');
    const usageTransactions = tokenDoc.transactions.filter(t => t.type === 'used');

    const totalSpent = purchaseTransactions.reduce((sum, t) => sum + (t.price || 0), 0);
    const averagePurchase = purchaseTransactions.length > 0 
      ? totalSpent / purchaseTransactions.length 
      : 0;

    // Usage breakdown
    const missionUsage = usageTransactions.filter(t => t.relatedMissionId).length;
    const conversationUsage = usageTransactions.filter(t => t.relatedConversationId).length;
    const otherUsage = usageTransactions.length - missionUsage - conversationUsage;

    res.status(200).json({
      success: true,
      data: {
        balance: tokenDoc.balance,
        totalPurchased: tokenDoc.totalPurchased,
        totalUsed: tokenDoc.totalUsed,
        totalSpent,
        averagePurchase,
        purchaseCount: purchaseTransactions.length,
        usageBreakdown: {
          missions: missionUsage,
          conversations: conversationUsage,
          other: otherUsage
        },
        lastPurchase: tokenDoc.lastPurchaseDate,
        lastUsage: tokenDoc.lastUsageDate
      }
    });

  } catch (error) {
    console.error('❌ Get token stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = exports;