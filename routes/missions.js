// routes/missionRoutes.js - COMPLETE MISSION ROUTES

const express = require('express');
const router = express.Router();

// Import controllers
const {
  createMission,
  getAllMissions,
  getMissionById,
  updateMission,
  deleteMission,
  getMyMissions,
  getMissionsByStatus,
  searchMissions,
  getMissionsByLocation,
  applyToMission,
  getMissionApplications,
  updateApplicationStatus,
  cancelMission,
  completeMission,
  getMissionStats,
  getActiveMissions,
  getFeaturedMissions,
  incrementMissionViews,
  checkMissionExpiration,
  getRecruiterMissions,
  getPartimerAppliedMissions
} = require('../controllers/missionController');

// Import auth middleware
const { protect, authorize } = require('../middleware/auth');

// ============================================
// PUBLIC ROUTES - No authentication required
// ============================================

// @route   GET /api/missions
// @desc    Get all active missions with filters and pagination
// @access  Public
router.get('/', getAllMissions);

// @route   GET /api/missions/active
// @desc    Get all active (published, not expired) missions
// @access  Public
router.get('/active', getActiveMissions);

// @route   GET /api/missions/featured
// @desc    Get featured missions
// @access  Public
router.get('/featured', getFeaturedMissions);

// @route   GET /api/missions/search
// @desc    Search missions with advanced filters
// @access  Public
router.get('/search', searchMissions);

// @route   GET /api/missions/location
// @desc    Get missions by location (within radius)
// @access  Public
router.get('/location', getMissionsByLocation);

// @route   GET /api/missions/:id
// @desc    Get single mission by ID (increments views)
// @access  Public
router.get('/:id', getMissionById);

// @route   PUT /api/missions/:id/views
// @desc    Increment mission views
// @access  Public
router.put('/:id/views', incrementMissionViews);

// ============================================
// PROTECTED ROUTES - Authentication required
// ============================================

// @route   POST /api/missions
// @desc    Create new mission
// @access  Private (Entreprise/Particulier only)
router.post(
  '/',
  protect,
  authorize('entreprise', 'particulier'),
  createMission
);

// @route   GET /api/missions/my/all
// @desc    Get all missions created by logged-in user
// @access  Private (Entreprise/Particulier only)
router.get(
  '/my/all',
  protect,
  authorize('entreprise', 'particulier'),
  getMyMissions
);

// @route   GET /api/missions/my/status/:status
// @desc    Get user's missions by status (draft, published, completed, etc.)
// @access  Private (Entreprise/Particulier only)
router.get(
  '/my/status/:status',
  protect,
  authorize('entreprise', 'particulier'),
  getMissionsByStatus
);

// @route   GET /api/missions/my/stats
// @desc    Get mission statistics for recruiter
// @access  Private (Entreprise/Particulier only)
router.get(
  '/my/stats',
  protect,
  authorize('entreprise', 'particulier'),
  getMissionStats
);

// @route   GET /api/missions/recruiter/dashboard
// @desc    Get all missions for recruiter dashboard
// @access  Private (Entreprise/Particulier only)
router.get(
  '/recruiter/dashboard',
  protect,
  authorize('entreprise', 'particulier'),
  getRecruiterMissions
);

// @route   PUT /api/missions/:id
// @desc    Update mission (only if no applications or owner only)
// @access  Private (Owner only)
router.put(
  '/:id',
  protect,
  authorize('entreprise', 'particulier'),
  updateMission
);

// @route   DELETE /api/missions/:id
// @desc    Delete mission
// @access  Private (Owner only)
router.delete(
  '/:id',
  protect,
  authorize('entreprise', 'particulier'),
  deleteMission
);

// @route   PUT /api/missions/:id/cancel
// @desc    Cancel mission
// @access  Private (Owner only)
router.put(
  '/:id/cancel',
  protect,
  authorize('entreprise', 'particulier'),
  cancelMission
);

// @route   PUT /api/missions/:id/complete
// @desc    Mark mission as completed
// @access  Private (Owner only)
router.put(
  '/:id/complete',
  protect,
  authorize('entreprise', 'particulier'),
  completeMission
);

// ============================================
// APPLICATION ROUTES
// ============================================

// @route   POST /api/missions/:id/apply
// @desc    Apply to a mission
// @access  Private (Partimer only)
router.post(
  '/:id/apply',
  protect,
  authorize('partimer'),
  applyToMission
);

// @route   GET /api/missions/:id/applications
// @desc    Get all applications for a mission
// @access  Private (Mission owner only)
router.get(
  '/:id/applications',
  protect,
  authorize('entreprise', 'particulier'),
  getMissionApplications
);

// @route   PUT /api/missions/:missionId/applications/:applicationId
// @desc    Update application status (accept/reject)
// @access  Private (Mission owner only)
router.put(
  '/:missionId/applications/:applicationId',
  protect,
  authorize('entreprise', 'particulier'),
  updateApplicationStatus
);

// @route   GET /api/missions/partimer/applied
// @desc    Get all missions partimer has applied to
// @access  Private (Partimer only)
router.get(
  '/partimer/applied',
  protect,
  authorize('partimer'),
  getPartimerAppliedMissions
);

// ============================================
// ADMIN/SYSTEM ROUTES
// ============================================

// @route   PUT /api/missions/system/check-expiration
// @desc    Check and update expired missions (system cron job)
// @access  Private (Admin only - to be called by cron)
router.put(
  '/system/check-expiration',
  protect,
  authorize('admin'),
  checkMissionExpiration
);

// ============================================
// EXPORT ROUTER
// ============================================
module.exports = router;