// routes/missions.js - UPDATED WITH LIMIT MIDDLEWARE

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

// Import mission limits middleware
const { 
  checkMissionCreationLimits,
  checkEntrepriseMissionLimit,
  checkParticulierTokens 
} = require('../middleware/missionLimits');

// ============================================
// PUBLIC ROUTES
// ============================================

router.get('/', getAllMissions);
router.get('/active', getActiveMissions);
router.get('/featured', getFeaturedMissions);
router.get('/search', searchMissions);
router.get('/location', getMissionsByLocation);
router.get('/:id', getMissionById);
router.put('/:id/views', incrementMissionViews);

// ============================================
// PROTECTED ROUTES - MISSION CREATION
// ============================================

// @route   POST /api/missions
// @desc    Create new mission (with automatic limit checking)
// @access  Private (Entreprise/Particulier only)
router.post(
  '/',
  protect,
  authorize('entreprise', 'particulier'),
  checkMissionCreationLimits,  // ✅ NEW: Automatically checks limits
  createMission
);

// Alternative: Use specific middleware based on user type
// router.post(
//   '/',
//   protect,
//   authorize('entreprise', 'particulier'),
//   checkEntrepriseMissionLimit,  // Checks entreprise monthly limits
//   checkParticulierTokens,        // Checks particulier token balance
//   createMission
// );

// ============================================
// PROTECTED ROUTES - USER MISSIONS
// ============================================

router.get(
  '/my/all',
  protect,
  authorize('entreprise', 'particulier'),
  getMyMissions
);

router.get(
  '/my/status/:status',
  protect,
  authorize('entreprise', 'particulier'),
  getMissionsByStatus
);

router.get(
  '/my/stats',
  protect,
  authorize('entreprise', 'particulier'),
  getMissionStats
);

router.get(
  '/recruiter/dashboard',
  protect,
  authorize('entreprise', 'particulier'),
  getRecruiterMissions
);

// ============================================
// PROTECTED ROUTES - MISSION MANAGEMENT
// ============================================

router.put(
  '/:id',
  protect,
  authorize('entreprise', 'particulier'),
  updateMission
);

router.delete(
  '/:id',
  protect,
  authorize('entreprise', 'particulier'),
  deleteMission
);

router.put(
  '/:id/cancel',
  protect,
  authorize('entreprise', 'particulier'),
  cancelMission
);

router.put(
  '/:id/complete',
  protect,
  authorize('entreprise', 'particulier'),
  completeMission
);

// ============================================
// APPLICATION ROUTES
// ============================================

router.post(
  '/:id/apply',
  protect,
  authorize('partimer'),
  applyToMission
);

router.get(
  '/:id/applications',
  protect,
  authorize('entreprise', 'particulier'),
  getMissionApplications
);

router.put(
  '/:missionId/applications/:applicationId',
  protect,
  authorize('entreprise', 'particulier'),
  updateApplicationStatus
);

router.get(
  '/partimer/applied',
  protect,
  authorize('partimer'),
  getPartimerAppliedMissions
);

// ============================================
// ADMIN/SYSTEM ROUTES
// ============================================

router.put(
  '/system/check-expiration',
  protect,
  authorize('admin'),
  checkMissionExpiration
);

module.exports = router;