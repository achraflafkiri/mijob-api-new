// routes/users.js
const express = require('express');
const router = express.Router();

// Import controllers
const {
  getUserProfile,
  updateProfile,
  updateEmail,
  updatePassword,
  uploadProfilePhoto,
  uploadCompanyLogo,
  uploadDocuments,
  deleteProfilePhoto,
  deleteDocument,
  deleteAccount,
  getPartimerDashboard,
  getRecruiterDashboard,
  getUserStats,
  getUserActivity,
  updateNotificationSettings,
  updatePrivacySettings,
  completePartimerProfile
} = require('../controllers/userController');

// Import auth middleware
const { protect } = require('../middleware/auth');

// Import Cloudinary upload middleware
const {
  uploadProfilePhoto: uploadProfilePhotoMiddleware,
  uploadMultipleDocuments,
  handleMulterError,
  uploadLogo
} = require('../config/cloudinary');

// ============================================
// PROFILE ROUTES
// ============================================

// @route   GET /api/v1/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', protect, getUserProfile);

// @route   PUT /api/v1/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, updateProfile);

// @route   PUT /api/v1/users/profile/complete-partimer
// @desc    Complete partimer profile
// @access  Private
router.put('/profile/complete-partimer', protect, completePartimerProfile);

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// @route   PUT /api/v1/users/email
// @desc    Update user email
// @access  Private
router.put('/email', protect, updateEmail);

// @route   PUT /api/v1/users/password
// @desc    Update user password
// @access  Private
router.put('/password', protect, updatePassword);

// @route   DELETE /api/v1/users/account
// @desc    Delete user account
// @access  Private
router.delete('/account', protect, deleteAccount);

// ============================================
// MEDIA UPLOAD ROUTES
// ============================================

// @route   POST /api/v1/users/profile/photo
// @desc    Upload profile photo
// @access  Private
router.post(
  '/profile/photo',
  protect,
  uploadProfilePhotoMiddleware.single('profilePhoto'),
  handleMulterError,
  uploadProfilePhoto
);

// @route   POST /api/users/profile/logo
// @desc    Upload company logo to Cloudinary
// @access  Private (Entreprise only)
router.post(
  '/profile/logo',
  protect,
  uploadLogo.single('logo'),
  handleMulterError,
  uploadCompanyLogo
);

// @route   POST /api/v1/users/profile/documents
// @desc    Upload user documents
// @access  Private
router.post(
  '/profile/documents',
  protect,
  uploadMultipleDocuments.fields([
    { name: 'cinDocument', maxCount: 1 },
    { name: 'cinDocumentPartimer', maxCount: 1 },
    { name: 'permisDocuments', maxCount: 3 }
  ]),
  handleMulterError,
  uploadDocuments
);

// @route   DELETE /api/v1/users/profile/photo
// @desc    Delete profile photo
// @access  Private
router.delete('/profile/photo', protect, deleteProfilePhoto);

// @route   DELETE /api/v1/users/profile/document/:documentType
// @desc    Delete user document
// @access  Private
router.delete('/profile/document/:documentType', protect, deleteDocument);

// ============================================
// DASHBOARD ROUTES
// ============================================

// @route   GET /api/v1/users/dashboard/partimer
// @desc    Get partimer dashboard
// @access  Private
router.get('/dashboard/partimer', protect, getPartimerDashboard);

// @route   GET /api/v1/users/dashboard/recruiter
// @desc    Get recruiter dashboard
// @access  Private
router.get('/dashboard/recruiter', protect, getRecruiterDashboard);

// @route   GET /api/v1/users/stats
// @desc    Get user statistics
// @access  Private
router.get('/stats', protect, getUserStats);

// @route   GET /api/v1/users/activity
// @desc    Get user activity
// @access  Private
router.get('/activity', protect, getUserActivity);

// ============================================
// SETTINGS ROUTES
// ============================================

// @route   PUT /api/v1/users/notifications
// @desc    Update notification settings
// @access  Private
router.put('/notifications', protect, updateNotificationSettings);

// @route   PUT /api/v1/users/privacy
// @desc    Update privacy settings
// @access  Private
router.put('/privacy', protect, updatePrivacySettings);

// ============================================
// PUBLIC PARTIMER ROUTES
// ============================================

// @route   GET /api/v1/users/partimer/:partimerId
// @desc    Get public partimer profile
// @access  Public
router.get('/partimer/:partimerId', async (req, res) => {
  try {
    const Partimer = require('../models/User');
    const partimer = await Partimer.findOne({
      _id: req.params.partimerId,
      userType: 'partimer',
      active: true
    }).select('-password -emailVerificationCode -passwordResetCode -email -phone');

    if (!partimer) {
      return res.status(404).json({
        success: false,
        message: 'Partimer non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        partimer
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// @route   GET /api/v1/users/partimers/search
// @desc    Search partimers
// @access  Public
router.get('/partimers/search', async (req, res) => {
  try {
    const Partimer = require('../models/User');
    const {
      city,
      serviceCategory,
      page = 1,
      limit = 12
    } = req.query;

    const query = {
      userType: 'partimer',
      active: true,
      emailVerified: true
    };

    if (city) {
      query.city = new RegExp(city, 'i');
    }

    if (serviceCategory) {
      query.serviceCategories = serviceCategory;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const partimers = await Partimer.find(query)
      .select('firstName lastName city profilePicture serviceCategories rating completedMissions profileCompletion')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ 'rating.average': -1, profileCompletion: -1 });

    const total = await Partimer.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        partimers,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// ============================================
// AVAILABILITY ROUTES (Public)
// ============================================

// @route   GET /api/v1/users/:partimerId/availability
// @desc    Get partimer availability (public)
// @access  Public
router.get('/:partimerId/availability', async (req, res) => {
  try {
    const Partimer = require('../models/User');
    const { partimerId } = req.params;

    const partimer = await Partimer.findOne({
      _id: partimerId,
      userType: 'partimer',
      active: true
    }).select('availabilitySlots firstName lastName');

    if (!partimer) {
      return res.status(404).json({
        success: false,
        message: 'Partimer non trouvé'
      });
    }

    // Format availability for public view (next 30 days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);
    thirtyDaysLater.setHours(23, 59, 59, 999);

    const publicAvailability = {};
    partimer.availabilitySlots
      .filter(slot => {
        const slotDate = new Date(slot.date);
        return slotDate >= today && slotDate <= thirtyDaysLater;
      })
      .forEach(slot => {
        const dateKey = slot.date.toISOString().split('T')[0];
        publicAvailability[dateKey] = slot.timeSlots.map(timeSlot => 
          `${timeSlot.start} - ${timeSlot.end}`
        );
      });

    res.status(200).json({
      success: true,
      data: {
        partimer: {
          id: partimer._id,
          name: `${partimer.firstName} ${partimer.lastName}`
        },
        availability: publicAvailability
      }
    });

  } catch (error) {
    console.error('Get partimer availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des disponibilités',
      error: error.message
    });
  }
});

module.exports = router;