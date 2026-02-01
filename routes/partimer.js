// routes/partimer.js
const express = require('express');
const router = express.Router();

// Import controllers
const {
  registerPartimer,
  completePartimerProfile,
  getPartimerProfile,
  getMyPartimerProfile,
  updatePartimerProfile,
  searchPartimers,
  getPartimerDashboard,
  uploadPartimerDocuments,
  deletePartimerDocument,
  uploadProfilePicture,
  getMyAvailability,
  updateAvailability,
  deleteAvailabilityDate,
  getPartimerAvailability
} = require('../controllers/partimerController');

// Import auth middleware
const { protect } = require('../middleware/auth');

// Import Cloudinary upload middleware
const {
  uploadRegistrationFiles,
  uploadMultipleDocuments,
  uploadProfilePhoto, // ADD THIS
  handleMulterError
} = require('../config/cloudinary');

// ============================================
// AUTH ROUTES
// ============================================

// @route   POST /api/v1/partimers/register
// @desc    Register a new partimer with file uploads
// @access  Public
router.post(
  '/register',
  uploadRegistrationFiles.fields([
    { name: 'photoProfil', maxCount: 1 },
    { name: 'cinFile', maxCount: 1 },
    { name: 'permisFile', maxCount: 3 },
    { name: 'autreDoc', maxCount: 1 }
  ]),
  handleMulterError,
  registerPartimer
);

// ============================================
// PROFILE ROUTES
// ============================================

// Get my profile
router.get('/profile/me', protect, getMyPartimerProfile);

// Update profile
router.put('/profile/me', protect, updatePartimerProfile);

// Upload profile photo (FIXED - use uploadProfilePhoto instead of upload)
router.post(
  '/profile/me/photo',
  protect,
  uploadProfilePhoto.single('profilePicture'), // FIXED HERE
  handleMulterError,
  uploadProfilePicture
);

// Complete profile
router.put('/profile/complete', protect, completePartimerProfile);

// Get public profile by ID
router.get('/:id', getPartimerProfile);

// ============================================
// SEARCH ROUTES
// ============================================

router.get('/', searchPartimers);

// ============================================
// DASHBOARD ROUTES
// ============================================

router.get('/dashboard/overview', protect, getPartimerDashboard);

// ============================================
// DOCUMENT ROUTES
// ============================================

router.post(
  '/documents',
  protect,
  uploadMultipleDocuments.fields([
    { name: 'cinDocumentPartimer', maxCount: 1 },
    { name: 'permisDocuments', maxCount: 3 }
  ]),
  handleMulterError,
  uploadPartimerDocuments
);

router.delete('/documents/:documentType', protect, deletePartimerDocument);

// @route   GET /api/v1/partimers/availability/me
// @desc    Get current partimer's availability
// @access  Private
router.get('/availability/me', protect, getMyAvailability);

// @route   PUT /api/v1/partimers/availability
// @desc    Update partimer availability
// @access  Private
router.put('/availability', protect, updateAvailability);

// @route   DELETE /api/v1/partimers/availability/:date
// @desc    Delete availability for specific date
// @access  Private
router.delete('/availability/:date', protect, deleteAvailabilityDate);

// @route   GET /api/v1/users/:partimerId/availability
// @desc    Get partimer availability (public)
// @access  Public
router.get('/:partimerId/availability', getPartimerAvailability);

module.exports = router;