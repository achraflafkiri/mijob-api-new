// routes/missions.js - UPDATED WITH TOKEN DEDUCTION MIDDLEWARE

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
  deductMissionTokens  // NEW: Import token deduction middleware
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

/**
 * @route   POST /api/v1/missions
 * @desc    Create new mission with automatic limit/token checking
 * @access  Private (Entreprise/Particulier only)
 * 
 * MIDDLEWARE FLOW:
 * 1. protect - Verify JWT token
 * 2. authorize - Check user type (entreprise or particulier)
 * 3. checkMissionCreationLimits - Check limits/tokens BEFORE creation
 * 4. createMission - Create the mission
 * 5. deductMissionTokens - Deduct tokens AFTER creation (particulier only)
 */
router.post(
  '/',
  protect,
  authorize('entreprise', 'particulier'),
  checkMissionCreationLimits,  // ✅ Checks entreprise limits OR particulier tokens
  createMission,                // ✅ Creates the mission
  deductMissionTokens          // ✅ NEW: Deducts tokens for particuliers
);

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