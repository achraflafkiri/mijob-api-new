const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { uploadRegistrationFiles, handleMulterError } = require('../config/cloudinary');

// ============================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register new user (sends verification code to email)
 * @access  Public
 */
router.post(
  '/register',
  uploadRegistrationFiles.fields([
    { name: 'cinFile', maxCount: 1 },
    { name: 'photoProfil', maxCount: 1 },
    { name: 'permisFile', maxCount: 10 },
    { name: 'autreDoc', maxCount: 1 }
  ]),
  handleMulterError,
  authController.register
);

/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    Verify email with 6-digit code
 * @access  Public
 */
router.post('/verify-email', authController.verifyEmail);

/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Resend verification code to email
 * @access  Public
 */
router.post('/resend-verification', authController.resendVerification);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user (requires verified email)
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Send password reset code to email
 * @access  Public
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with code from email
 * @access  Public
 */
router.post('/reset-password', authController.resetPassword);

// ============================================================
// PROTECTED ROUTES (Authentication required)
// ============================================================

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', protect, authController.logout);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current logged in user
 * @access  Private
 */
router.get('/me', protect, authController.getCurrentUser);

/**
 * @route   PUT /api/v1/auth/update-password
 * @desc    Update password for logged in user
 * @access  Private
 */
router.put('/update-password', protect, authController.updatePassword);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh JWT token
 * @access  Private
 */
router.post('/refresh-token', protect, authController.refreshToken);

module.exports = router;