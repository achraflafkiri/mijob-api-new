// routes/support.js
const express = require('express');
const router = express.Router();
const {
  createReclamation,
  getUserReclamations,
  getReclamation
} = require('../controllers/supportController');
const { protect } = require('../middleware/auth');

// ============================================
// RECLAMATION ROUTES
// ============================================

/**
 * @route   POST /api/v1/support/reclamation
 * @desc    Create a new reclamation
 * @access  Private
 * @body    { type, description, missionId (optional), relatedUserId (optional) }
 */
router.post('/reclamation', protect, createReclamation);

/**
 * @route   GET /api/v1/support/reclamation
 * @desc    Get user's reclamations
 * @access  Private
 */
router.get('/reclamation', protect, getUserReclamations);

/**
 * @route   GET /api/v1/support/reclamation/:id
 * @desc    Get specific reclamation
 * @access  Private
 */
router.get('/reclamation/:id', protect, getReclamation);

module.exports = router;