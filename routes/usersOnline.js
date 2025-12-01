// routes/usersOnline.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');

/**
 * @route   GET /api/v1/users/online
 * @desc    Get online users
 * @access  Private
 */
router.get('/online', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const io = req.app.get('io');
    const { getOnlineUsersDetailed } = require('../socket/socketHandler');

    const onlineUsersList = getOnlineUsersDetailed();
    const onlineUserIds = onlineUsersList.map(user => user.userId);

    // Get user details from database
    const users = await User.find({
      _id: { $in: onlineUserIds },
      active: true,
      'privacy.showOnlineStatus': { $ne: false }
    })
    .select('_id firstName lastName nomComplet raisonSociale profilePicture userType city rating average')
    .skip(skip)
    .limit(limit)
    .sort({ 'rating.average': -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      totalOnline: onlineUserIds.length,
      data: users.map(user => ({
        ...user.toObject(),
        isOnline: true,
        lastSeen: new Date()
      }))
    });
  } catch (error) {
    console.error('❌ Get online users error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des utilisateurs en ligne',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/users/with-status
 * @desc    Get users with online status
 * @access  Private
 */
router.get('/with-status', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const io = req.app.get('io');
    const { getOnlineUsers } = require('../socket/socketHandler');

    const onlineUserIds = getOnlineUsers();

    // Get users from database
    const totalUsers = await User.countDocuments({
      active: true,
      _id: { $ne: req.user.id }
    });

    const users = await User.find({
      active: true,
      _id: { $ne: req.user.id }
    })
    .select('_id firstName lastName nomComplet raisonSociale profilePicture userType isOnline lastSeen city rating.average privacy')
    .skip(skip)
    .limit(limit)
    .sort({ isOnline: -1, 'rating.average': -1, lastSeen: -1 });

    const usersWithStatus = users.map(user => {
      const isCurrentlyOnline = onlineUserIds.includes(user._id.toString());
      const canShowStatus = user.privacy?.showOnlineStatus !== false;
      
      return {
        ...user.toObject(),
        isOnline: canShowStatus ? isCurrentlyOnline : null,
        showStatus: canShowStatus,
        lastSeen: user.lastSeen || user.updatedAt
      };
    });

    res.status(200).json({
      success: true,
      count: usersWithStatus.length,
      total: totalUsers,
      totalOnline: onlineUserIds.length,
      data: usersWithStatus,
      pagination: {
        page,
        limit,
        pages: Math.ceil(totalUsers / limit)
      }
    });
  } catch (error) {
    console.error('❌ Get users with status error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des utilisateurs',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/users/status/:userId
 * @desc    Get specific user's online status
 * @access  Private
 */
router.get('/status/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;

    const io = req.app.get('io');
    const { isUserOnline } = require('../socket/socketHandler');

    const user = await User.findById(userId)
      .select('_id firstName lastName nomComplet raisonSociale profilePicture userType isOnline lastSeen privacy');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const isCurrentlyOnline = isUserOnline(userId);
    const canShowStatus = user.privacy?.showOnlineStatus !== false;

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.fullName,
        userType: user.userType,
        profilePicture: user.profilePicture,
        isOnline: canShowStatus ? isCurrentlyOnline : null,
        lastSeen: user.lastSeen,
        showStatus: canShowStatus,
        privacy: user.privacy
      }
    });
  } catch (error) {
    console.error('❌ Get user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du statut',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/v1/users/privacy
 * @desc    Update user privacy settings
 * @access  Private
 */
router.put('/privacy', protect, async (req, res) => {
  try {
    const { showOnlineStatus, showLastSeen } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          'privacy.showOnlineStatus': showOnlineStatus,
          'privacy.showLastSeen': showLastSeen
        }
      },
      { new: true }
    ).select('privacy');

    res.status(200).json({
      success: true,
      message: 'Paramètres de confidentialité mis à jour',
      data: user.privacy
    });
  } catch (error) {
    console.error('❌ Update privacy error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des paramètres',
      error: error.message
    });
  }
});

module.exports = router;