const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendEmail, sendWelcomeEmail } = require('../utils/email');
const { extractPublicId } = require('../config/cloudinary'); // Add this

// Generate JWT Token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Generate verification code (6 digits)
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send token response
const createSendToken = (user, statusCode, res, message = 'Success') => {
  const token = signToken(user._id);

  // Remove sensitive fields from output
  user.password = undefined;
  user.emailVerificationCode = undefined;
  user.emailVerificationExpires = undefined;
  user.passwordResetCode = undefined;
  user.passwordResetExpires = undefined;

  res.status(statusCode).json({
    success: true,
    status: 'success',
    message,
    token,
    data: {
      user
    }
  });
};

// Helper function to handle file URLs from Cloudinary
const processFileUrl = (file) => {
  if (!file) return null;
  
  // If file is already a URL (from Cloudinary), return it
  if (typeof file === 'string' && (file.startsWith('http') || file.startsWith('https'))) {
    return file;
  }
  
  // If file is from multer upload (has path/url property)
  if (file && file.path) {
    return file.path; // Cloudinary returns URL in file.path
  }
  
  return null;
};

// @desc    Register new user (UPDATED FOR CLOUDINARY)
// @route   POST /api/v1/auth/register
// @access  Public
const register = catchAsync(async (req, res, next) => {
  console.log("======================== @register =============================");
  console.log("Registration request body:", req.body);
  console.log("Registration files:", req.files || req.file);

  // Handle both form-data and JSON requests
  let registrationData = req.body;
  
  // If form-data, parse JSON fields
  if (typeof registrationData.email === 'string') {
    // Already parsed
  } else {
    // Parse JSON fields if they exist
    if (req.body.data) {
      try {
        registrationData = JSON.parse(req.body.data);
      } catch (error) {
        registrationData = req.body;
      }
    }
  }

  const {
    email,
    password,
    userType,
    // Entreprise fields
    raisonSociale,
    ville,
    telephone,
    siegeSocial,
    secteurActivite,
    tailleEntreprise,
    raisonRecrutement,
    // Particulier fields
    nomComplet,
    cin
  } = registrationData;

  // Basic validation
  if (!email || !password || !userType) {
    return next(new AppError(400, 'Veuillez fournir email, mot de passe et type d\'utilisateur'));
  }

  if (!['partimer', 'entreprise', 'particulier'].includes(userType)) {
    return next(new AppError(400, 'Type d\'utilisateur invalide'));
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return next(new AppError(400, 'Cet email est déjà enregistré'));
  }

  // Generate verification code
  const verificationCode = generateVerificationCode();

  // Process uploaded files from Cloudinary
  let cinFileUrl = null;
  if (req.file) {
    cinFileUrl = processFileUrl(req.file);
  } else if (req.files && req.files.cinFile) {
    cinFileUrl = processFileUrl(req.files.cinFile[0]);
  }

  // Create user data object
  const userData = {
    email: email.toLowerCase(),
    password,
    userType,
    emailVerificationCode: verificationCode,
    emailVerificationExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
    emailVerified: false
  };

  // Add entreprise-specific fields
  if (userType === 'entreprise') {
    if (!raisonSociale) {
      return next(new AppError(400, 'La raison sociale est requise'));
    }
    
    userData.raisonSociale = raisonSociale;
    userData.ville = ville;
    userData.telephone = telephone;
    userData.siegeSocial = siegeSocial;
    userData.secteurActivite = secteurActivite;
    userData.tailleEntreprise = tailleEntreprise;
    userData.raisonRecrutement = raisonRecrutement;

    // Also set aliases for backward compatibility
    userData.entrepriseName = raisonSociale;
    userData.city = ville;
    userData.phone = telephone;
    userData.companyAddress = siegeSocial;
    userData.industry = secteurActivite;
  }

  // Add particulier-specific fields
  if (userType === 'particulier') {
    if (!nomComplet) {
      return next(new AppError(400, 'Le nom complet est requis'));
    }
    if (!ville) {
      return next(new AppError(400, 'La ville est requise'));
    }
    if (!telephone) {
      return next(new AppError(400, 'Le téléphone est requis'));
    }
    if (!cin) {
      return next(new AppError(400, 'Le CIN ou passeport est requis'));
    }

    userData.nomComplet = nomComplet;
    userData.ville = ville;
    userData.telephone = telephone;
    userData.cin = cin;
    userData.cinFile = cinFileUrl; // Store Cloudinary URL

    // Parse nom complet into firstName and lastName
    const names = nomComplet.trim().split(' ');
    userData.firstName = names[0];
    userData.lastName = names.slice(1).join(' ') || names[0];

    // Also set aliases
    userData.city = ville;
    userData.phone = telephone;
  }

  console.log("Creating user with data:", userData);

  // Create user
  const user = await User.create(userData);

  console.log("✅ User created successfully:", user._id);

  // Send verification email
  try {
    await sendEmail({
      email: user.email,
      subject: 'Vérifiez votre compte MIJOB',
      message: `Votre code de vérification est: ${verificationCode}\n\nCe code expire dans 10 minutes.\n\nSi vous n'avez pas créé de compte, veuillez ignorer cet email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #247F6E;">Bienvenue sur MIJOB!</h2>
          <p>Merci de vous être inscrit. Veuillez vérifier votre adresse email en utilisant le code ci-dessous:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 5px;">
            ${verificationCode}
          </div>
          <p style="color: #666;">Ce code expire dans <strong>10 minutes</strong>.</p>
          <p style="color: #666;">Si vous n'avez pas créé de compte MIJOB, veuillez ignorer cet email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #999; font-size: 12px;">MIJOB - Votre plateforme de travail à temps partiel</p>
        </div>
      `
    });

    console.log("✅ Verification email sent to:", user.email);
    console.log("✅ Verification code:", verificationCode);

    res.status(201).json({
      success: true,
      status: 'success',
      message: 'Inscription réussie! Veuillez vérifier votre email pour le code de vérification.',
      data: {
        userId: user._id,
        email: user.email,
        userType: user.userType,
        emailVerificationRequired: true
      }
    });
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    
    // If email fails, try to delete the user and uploaded files
    try {
      await User.findByIdAndDelete(user._id);
      
      // Delete uploaded file from Cloudinary if exists
      if (cinFileUrl) {
        const publicId = extractPublicId(cinFileUrl);
        if (publicId) {
          await deleteFile(publicId, 'image');
        }
      }
    } catch (deleteError) {
      console.error('❌ Error cleaning up after failed email:', deleteError);
    }
    
    return next(new AppError(500, 'Erreur lors de l\'envoi de l\'email de vérification. Veuillez réessayer.'));
  }
});

// @desc    Verify email with code
// @route   POST /api/v1/auth/verify-email
// @access  Public
const verifyEmail = catchAsync(async (req, res, next) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return next(new AppError(400, 'Veuillez fournir l\'email et le code de vérification'));
  }

  // Find user with valid verification code
  const user = await User.findOne({
    email: email.toLowerCase(),
    emailVerificationCode: code,
    emailVerificationExpires: { $gt: Date.now() }
  });

  if (!user) {
    return next(new AppError(400, 'Code de vérification invalide ou expiré'));
  }

  // Update user
  user.emailVerified = true;
  user.emailVerificationCode = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  console.log("✅ Email verified for user:", user.email);

  // Send welcome email
  try {
    await sendWelcomeEmail(user);
  } catch (error) {
    console.log('⚠️ Error sending welcome email:', error);
  }

  res.status(200).json({
    success: true,
    status: 'success',
    message: 'Email vérifié avec succès! Vous pouvez maintenant vous connecter.'
  });
});

// @desc    Resend verification code
// @route   POST /api/v1/auth/resend-verification
// @access  Public
const resendVerification = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  console.log('📧 Resend verification request for:', email);

  if (!email) {
    return next(new AppError(400, 'Veuillez fournir votre adresse email'));
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    console.error('❌ User not found:', email);
    return next(new AppError(404, 'Aucun utilisateur trouvé avec cet email'));
  }

  if (user.emailVerified) {
    console.log('⚠️ Email already verified:', email);
    return next(new AppError(400, 'Cet email est déjà vérifié'));
  }

  // Generate new verification code
  const verificationCode = generateVerificationCode();
  user.emailVerificationCode = verificationCode;
  user.emailVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  try {
    await user.save({ validateBeforeSave: false });
    console.log('✅ User updated with new verification code');
  } catch (error) {
    console.error('❌ Error saving user:', error);
    return next(new AppError(500, 'Erreur lors de la mise à jour de l\'utilisateur'));
  }

  // Send email
  try {
    console.log('📤 Attempting to send email to:', user.email);
    console.log('📤 Verification code:', verificationCode);
    
    await sendEmail({
      email: user.email,
      subject: 'MIJOB - Nouveau code de vérification',
      message: `Votre nouveau code de vérification est: ${verificationCode}\n\nCe code expire dans 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #247F6E;">Nouveau code de vérification</h2>
          <p>Voici votre nouveau code de vérification:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 5px;">
            ${verificationCode}
          </div>
          <p style="color: #666;">Ce code expire dans <strong>10 minutes</strong>.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #999; font-size: 12px;">MIJOB - Votre plateforme de travail à temps partiel</p>
        </div>
      `
    });

    console.log('✅ Email sent successfully');

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Code de vérification envoyé à votre email'
    });
  } catch (error) {
    console.error('❌ Email sending error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      response: error.response
    });

    // Reset verification fields since email failed
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    
    try {
      await user.save({ validateBeforeSave: false });
    } catch (saveError) {
      console.error('❌ Error resetting verification fields:', saveError);
    }

    // Return more specific error message
    const errorMessage = error.message || 'Erreur lors de l\'envoi de l\'email';
    return next(new AppError(500, `Erreur lors de l\'envoi de l\'email: ${errorMessage}. Veuillez réessayer.`));
  }
});

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    return next(new AppError(400, 'Veuillez fournir email et mot de passe'));
  }

  // Find user and include password field
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password +active');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError(401, 'Email ou mot de passe incorrect'));
  }

  // Check if email is verified
  if (!user.emailVerified) {
    return next(new AppError(403, 'Veuillez vérifier votre email avant de vous connecter. Vérifiez votre boîte de réception pour le code de vérification.'));
  }

  // Check if account is active
  if (user.active === false) {
    return next(new AppError(403, 'Votre compte a été désactivé. Veuillez contacter le support.'));
  }

  // Update last login
  user.lastLogin = Date.now();
  await user.save({ validateBeforeSave: false });

  console.log("✅ User logged in:", user.email);

  createSendToken(user, 200, res, 'Connexion réussie');
});

// @desc    Logout user
// @route   POST /api/v1/auth/logout
// @access  Private
const logout = catchAsync(async (req, res, next) => {
  res.status(200).json({
    success: true,
    status: 'success',
    message: 'Déconnexion réussie'
  });
});

// @desc    Get current user
// @route   GET /api/v1/auth/me
// @access  Private
const getCurrentUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  res.status(200).json({
    success: true,
    status: 'success',
    data: {
      user
    }
  });
});

// @desc    Forgot password
// @route   POST /api/v1/auth/forgot-password
// @access  Public
const forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new AppError(400, 'Veuillez fournir votre adresse email'));
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    return next(new AppError(404, 'Aucun utilisateur trouvé avec cet email'));
  }

  // Generate reset code
  const resetCode = generateVerificationCode();
  user.passwordResetCode = resetCode;
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save({ validateBeforeSave: false });

  // Send email
  try {
    await sendEmail({
      email: user.email,
      subject: 'MIJOB - Code de réinitialisation de mot de passe',
      message: `Votre code de réinitialisation est: ${resetCode}\n\nCe code expire dans 10 minutes.\n\nSi vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #247F6E;">Réinitialisation de mot de passe</h2>
          <p>Vous avez demandé la réinitialisation de votre mot de passe. Utilisez le code ci-dessous:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 5px;">
            ${resetCode}
          </div>
          <p style="color: #666;">Ce code expire dans <strong>10 minutes</strong>.</p>
          <p style="color: #666;">Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #999; font-size: 12px;">MIJOB - Votre plateforme de travail à temps partiel</p>
        </div>
      `
    });

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Code de réinitialisation envoyé à votre email'
    });
  } catch (error) {
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError(500, 'Erreur lors de l\'envoi de l\'email. Veuillez réessayer.'));
  }
});

// @desc    Reset password
// @route   POST /api/v1/auth/reset-password
// @access  Public
const resetPassword = catchAsync(async (req, res, next) => {
  const { email, code, password, passwordConfirm } = req.body;

  if (!email || !code || !password || !passwordConfirm) {
    return next(new AppError(400, 'Veuillez fournir tous les champs requis'));
  }

  if (password !== passwordConfirm) {
    return next(new AppError(400, 'Les mots de passe ne correspondent pas'));
  }

  // Find user with valid reset code
  const user = await User.findOne({
    email: email.toLowerCase(),
    passwordResetCode: code,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    return next(new AppError(400, 'Code de réinitialisation invalide ou expiré'));
  }

  // Update password
  user.password = password;
  user.passwordResetCode = undefined;
  user.passwordResetExpires = undefined;
  user.passwordChangedAt = Date.now();
  await user.save();

  // Send confirmation email
  try {
    await sendEmail({
      email: user.email,
      subject: 'MIJOB - Mot de passe modifié avec succès',
      message: 'Votre mot de passe MIJOB a été modifié avec succès.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #247F6E;">Mot de passe modifié</h2>
          <p>Votre mot de passe MIJOB a été modifié avec succès.</p>
          <p>Si vous n'avez pas effectué ce changement, veuillez contacter immédiatement le support.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #999; font-size: 12px;">MIJOB - Votre plateforme de travail à temps partiel</p>
        </div>
      `
    });
  } catch (error) {
    console.log('⚠️ Error sending confirmation email:', error);
  }

  createSendToken(user, 200, res, 'Mot de passe réinitialisé avec succès');
});

// @desc    Update password (for logged in users)
// @route   PUT /api/v1/auth/update-password
// @access  Private
const updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword, newPasswordConfirm } = req.body;

  if (!currentPassword || !newPassword || !newPasswordConfirm) {
    return next(new AppError(400, 'Veuillez fournir tous les champs requis'));
  }

  if (newPassword !== newPasswordConfirm) {
    return next(new AppError(400, 'Les nouveaux mots de passe ne correspondent pas'));
  }

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  // Check current password
  if (!(await user.correctPassword(currentPassword, user.password))) {
    return next(new AppError(401, 'Mot de passe actuel incorrect'));
  }

  // Update password
  user.password = newPassword;
  user.passwordChangedAt = Date.now();
  await user.save();

  createSendToken(user, 200, res, 'Mot de passe mis à jour avec succès');
});

// @desc    Refresh token
// @route   POST /api/v1/auth/refresh-token
// @access  Private
const refreshToken = catchAsync(async (req, res, next) => {
  createSendToken(req.user, 200, res, 'Token actualisé avec succès');
});

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  logout,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  updatePassword,
  refreshToken
};