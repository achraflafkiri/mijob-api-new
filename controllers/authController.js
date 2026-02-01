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

// Generate password reset token
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Generate reset URL for email
const generateResetUrl = (token) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${frontendUrl}/auth/reset-password/${token}`;
};

// Send token response
const createSendToken = (user, statusCode, res, message = 'Success') => {
  const token = signToken(user._id);

  console.log("✅ Token generated for user:", token);

  // Remove sensitive fields from output
  user.password = undefined;
  user.emailVerificationCode = undefined;
  user.emailVerificationExpires = undefined;
  user.passwordResetCode = undefined;
  user.passwordResetExpires = undefined;

  console.log(" ===========> ", {
    success: true,
    status: 'success',
    message,
    token,
    data: {
      user
    }
  })

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

  console.log("============= @login ==========",
    {
      email,
      password
    }
  );

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
    // For security, don't reveal that user doesn't exist
    return res.status(200).json({
      success: true,
      status: 'success',
      message: 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation dans quelques minutes.'
    });
  }

  // Check if email is verified
  if (!user.emailVerified) {
    return next(new AppError(400, 'Veuillez d\'abord vérifier votre adresse email avant de réinitialiser le mot de passe'));
  }

  // Generate reset token
  const resetToken = generateResetToken();

  // Hash the token for storage
  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Save reset token and expiration
  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
  user.passwordResetAttempts = 0;

  try {
    await user.save({ validateBeforeSave: false });
  } catch (saveError) {
    console.error('Error saving reset token:', saveError);
    return next(new AppError(500, 'Erreur lors de la génération du lien de réinitialisation'));
  }

  // Generate reset URL
  const resetUrl = generateResetUrl(resetToken);

  // Send email with reset link
  try {
    await sendEmail({
      email: user.email,
      subject: 'MIJOB - Réinitialisation de mot de passe',
      message: `Bonjour,\n\nVous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe:\n\n${resetUrl}\n\nCe lien expire dans 30 minutes.\n\nSi vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h2 style="color: #247F6E; margin: 0;">MIJOB</h2>
            <p style="color: #666; margin: 5px 0;">Votre plateforme de travail à temps partiel</p>
          </div>
          
          <h3 style="color: #333; margin-bottom: 20px;">Réinitialisation de mot de passe</h3>
          
          <p style="color: #555; line-height: 1.6;">
            Vous avez demandé la réinitialisation de votre mot de passe. 
            Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="display: inline-block; background-color: #247F6E; color: white; 
                      padding: 14px 28px; text-decoration: none; border-radius: 5px; 
                      font-weight: bold; font-size: 16px;">
              Réinitialiser mon mot de passe
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 25px;">
            <strong>Ce lien expire dans 30 minutes.</strong>
          </p>
          
          <p style="color: #666; font-size: 14px;">
            Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur:<br>
            <a href="${resetUrl}" style="color: #247F6E; word-break: break-all;">${resetUrl}</a>
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px;">
              <strong>Si vous n'avez pas demandé cette réinitialisation:</strong><br>
              Veuillez ignorer cet email. Votre mot de passe restera inchangé.
            </p>
          </div>
          
          <div style="margin-top: 40px; text-align: center; color: #999; font-size: 12px;">
            <p>MIJOB &copy; ${new Date().getFullYear()} - Tous droits réservés</p>
          </div>
        </div>
      `
    });

    console.log(`✅ Reset link sent to ${user.email}`);
    console.log(`Reset URL: ${resetUrl}`);

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Lien de réinitialisation envoyé à votre email',
      data: {
        emailSent: true
      }
    });
  } catch (error) {
    console.error('❌ Email sending error:', error);

    // Reset the fields if email fails
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new AppError(500, 'Erreur lors de l\'envoi de l\'email. Veuillez réessayer.'));
  }
});

// @desc    Verify reset token (for the GET route)
// @route   GET /api/v1/auth/reset-password/:token
// @access  Public
const verifyResetToken = catchAsync(async (req, res, next) => {
  const { token } = req.params;

  if (!token) {
    return next(new AppError(400, 'Token de réinitialisation manquant'));
  }

  // Hash the token to compare with stored
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Find user with valid reset token
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Le lien de réinitialisation est invalide ou a expiré. Veuillez demander un nouveau lien.'
    });
  }

  // Token is valid - you could render an HTML page here or return success
  // For API, we'll return success and the frontend will show the reset form
  res.status(200).json({
    success: true,
    status: 'success',
    message: 'Token valide. Vous pouvez maintenant réinitialiser votre mot de passe.',
    data: {
      email: user.email,
      token: token
    }
  });
});

// @desc    Reset password with token
// @route   POST /api/v1/auth/reset-password/:token
// @access  Public
const resetPassword = catchAsync(async (req, res, next) => {
  const { token } = req.params;
  const { password, passwordConfirm } = req.body;

  // Validate input
  if (!token) {
    return next(new AppError(400, 'Token de réinitialisation manquant'));
  }

  if (!password || !passwordConfirm) {
    return next(new AppError(400, 'Veuillez fournir le mot de passe et la confirmation'));
  }

  if (password !== passwordConfirm) {
    return next(new AppError(400, 'Les mots de passe ne correspondent pas'));
  }

  if (password.length < 6) {
    return next(new AppError(400, 'Le mot de passe doit contenir au moins 6 caractères'));
  }

  // Hash the token to compare with stored
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Find user with valid reset token
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    return next(new AppError(400, 'Le lien de réinitialisation est invalide ou a expiré. Veuillez demander un nouveau lien.'));
  }

  try {
    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = Date.now();

    // Clear any existing sessions/tokens
    user.tokens = undefined;

    await user.save();

    console.log(`✅ Password reset successful for ${user.email}`);

    // Send confirmation email
    try {
      await sendEmail({
        email: user.email,
        subject: 'MIJOB - Mot de passe modifié avec succès',
        message: 'Votre mot de passe MIJOB a été modifié avec succès.\n\nSi vous n\'avez pas effectué ce changement, veuillez contacter immédiatement le support.',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #247F6E; margin: 0;">MIJOB</h2>
              <p style="color: #666; margin: 5px 0;">Votre plateforme de travail à temps partiel</p>
            </div>
            
            <h3 style="color: #333; margin-bottom: 20px;">Mot de passe modifié avec succès</h3>
            
            <div style="background-color: #f0f9f7; padding: 20px; border-radius: 5px; border-left: 4px solid #247F6E; margin: 20px 0;">
              <p style="color: #2d6a4f; margin: 0;">
                <strong>✅ Votre mot de passe a été réinitialisé avec succès.</strong>
              </p>
            </div>
            
            <p style="color: #555; line-height: 1.6;">
              Vous pouvez maintenant vous connecter à votre compte MIJOB avec votre nouveau mot de passe.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" 
                 style="display: inline-block; background-color: #247F6E; color: white; 
                        padding: 12px 24px; text-decoration: none; border-radius: 5px; 
                        font-weight: bold;">
                Se connecter
              </a>
            </div>
            
            <div style="margin-top: 30px; padding: 20px; background-color: #fff3cd; border-radius: 5px; border-left: 4px solid #ffc107;">
              <p style="color: #856404; margin: 0; font-size: 14px;">
                <strong>⚠️ Sécurité:</strong><br>
                Si vous n'avez pas effectué ce changement, veuillez contacter immédiatement notre support.
              </p>
            </div>
            
            <div style="margin-top: 40px; text-align: center; color: #999; font-size: 12px;">
              <p>MIJOB &copy; ${new Date().getFullYear()} - Tous droits réservés</p>
            </div>
          </div>
        `
      });
    } catch (emailError) {
      console.log('⚠️ Error sending confirmation email:', emailError);
    }

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.'
    });
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    return next(new AppError(500, 'Erreur lors de la réinitialisation du mot de passe. Veuillez réessayer.'));
  }
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

const CheckIfEmailExists = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  if (!email) {
    return next(new AppError(400, 'Veuillez fournir une adresse email'));
  }
  const user = await User.findOne({ email: email.toLowerCase() });
  res.status(200).json({
    success: true,
    status: 'success',
    data: {
      exists: !!user
    }
  });
});

// @desc    Verify reset code (legacy - for code-based reset)
// @route   POST /api/v1/auth/verify-reset-code
// @access  Public
const verifyResetCode = catchAsync(async (req, res, next) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return next(new AppError(400, 'Veuillez fournir l\'email et le code'));
  }

  const user = await User.findOne({
    email: email.toLowerCase()
  }).select('+passwordResetCode +passwordResetExpires');

  if (!user) {
    return next(new AppError(404, 'Aucun utilisateur trouvé'));
  }

  if (!user.passwordResetCode || !user.passwordResetExpires) {
    return next(new AppError(400, 'Aucun code de réinitialisation valide'));
  }

  if (user.passwordResetCode !== code) {
    return next(new AppError(400, 'Code incorrect'));
  }

  if (Date.now() > user.passwordResetExpires) {
    return next(new AppError(400, 'Le code a expiré'));
  }

  res.status(200).json({
    success: true,
    status: 'success',
    message: 'Code valide'
  });
});

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  logout,
  getCurrentUser,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  updatePassword,
  refreshToken,
  CheckIfEmailExists,
  verifyResetCode
};