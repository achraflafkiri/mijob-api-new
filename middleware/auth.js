// middleware/auth.js - COMPLETE WITH AUTHORIZE FUNCTION

const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const User = require('../models/User');

// ============================================
// PROTECT MIDDLEWARE - Verify JWT token
// ============================================
exports.protect = catchAsync(async (req, res, next) => {
  // 1) Get token from header
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError(401, 'You are not logged in. Please log in to access this resource.'));
  }

  // 2) Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError(401, 'Invalid token. Please log in again.'));
    }
    if (err.name === 'TokenExpiredError') {
      return next(new AppError(401, 'Your token has expired. Please log in again.'));
    }
    return next(new AppError(401, 'Authentication failed.'));
  }

  // 3) Check if user still exists
  // console.log("decoded.id: ", decoded.id);
  
  const user = await User.findById(decoded.id).select('+active');
  if (!user) {
    return next(new AppError(401, 'The user belonging to this token no longer exists.'));
  }

  // 4) Check if user account is active
  if (user.active === false) {
    return next(new AppError(401, 'Your account has been deactivated. Please contact support.'));
  }

  // 5) Check if user changed password after token was issued
  if (user.passwordChangedAt) {
    const changedTimestamp = parseInt(user.passwordChangedAt.getTime() / 1000, 10);
    if (decoded.iat < changedTimestamp) {
      return next(new AppError(401, 'User recently changed password. Please log in again.'));
    }
  }

  // Grant access to protected route
  req.user = user;
  next();
});

// ============================================
// AUTHORIZE MIDDLEWARE - Restrict by account type
// ============================================
/**
 * Authorize middleware - Restrict routes to specific account types
 * @param {...string} userTypes - List of allowed account types (entreprise, particulier, partimer, admin)
 * @returns {Function} Express middleware function
 * 
 * @example
 * router.post('/missions', protect, authorize('entreprise', 'particulier'), createMission);
 */
exports.authorize = (...userTypes) => {
  return (req, res, next) => {
    // Check if user exists (should be set by protect middleware)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.'
      });
    }

    console.log("req.user: ", req.user);    

    // Check if user's userType is in the allowed list
    if (!userTypes.includes(req.user.userType)) {
      // Custom messages based on account type
      let message = 'Vous n\'avez pas l\'autorisation d\'accéder à cette ressource.';
      
      if (userTypes.includes('entreprise') && req.user.userType === 'particulier') {
        message = 'Cette fonctionnalité est réservée aux comptes entreprise.';
      } else if (userTypes.includes('particulier') && req.user.userType === 'entreprise') {
        message = 'Cette fonctionnalité est réservée aux comptes particulier.';
      } else if (userTypes.includes('partimer')) {
        message = 'Cette fonctionnalité est réservée aux partimers.';
      } else if (userTypes.includes('admin')) {
        message = 'Cette fonctionnalité est réservée aux administrateurs.';
      } else if ((userTypes.includes('entreprise') || userTypes.includes('particulier')) && 
                 req.user.userType === 'partimer') {
        message = 'Cette fonctionnalité est réservée aux recruteurs (entreprises et particuliers).';
      }

      return res.status(403).json({
        success: false,
        message,
        required: userTypes,
        current: req.user.userType
      });
    }

    // User is authorized, proceed to next middleware
    next();
  };
};

// ============================================
// RESTRICT TO - Alternative authorization (legacy support)
// ============================================
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.userType || req.user.userType)) {
      return next(
        new AppError(403, 'Vous n\'avez pas l\'autorisation d\'effectuer cette action.')
      );
    }
    next();
  };
};

// ============================================
// REQUIRE ACTIVE SUBSCRIPTION
// ============================================
exports.requireActiveSubscription = catchAsync(async (req, res, next) => {
  if (req.user.userType === 'entreprise') {
    // Check if subscription exists and is active
    if (!req.user.subscriptionPack || req.user.subscriptionPack === 'none') {
      return next(new AppError(403, 'Vous avez besoin d\'un abonnement actif pour effectuer cette action.'));
    }

    // Check if subscription is expired
    if (req.user.subscriptionEndDate && new Date() > req.user.subscriptionEndDate) {
      return next(new AppError(403, 'Votre abonnement a expiré. Veuillez renouveler pour continuer.'));
    }
  }
  next();
});

// ============================================
// CHECK TOKEN QUOTA
// ============================================
exports.checkTokenQuota = (tokensRequired) => {
  return catchAsync(async (req, res, next) => {
    if (req.user.userType === 'particulier') {
      const user = await User.findById(req.user._id);
      
      if (!user.tokenBalance || user.tokenBalance < tokensRequired) {
        return next(
          new AppError(403, `Solde de jetons insuffisant. Vous avez besoin de ${tokensRequired} jetons pour cette action. Solde actuel : ${user.tokenBalance || 0} jetons.`)
        );
      }

      // Store tokens required for later deduction
      req.tokensRequired = tokensRequired;
    }
    next();
  });
};

// ============================================
// REQUIRE VERIFIED EMAIL
// ============================================
exports.requireVerifiedEmail = (req, res, next) => {
  if (!req.user.emailVerified) {
    return next(new AppError(403, 'Veuillez vérifier votre adresse e-mail pour accéder à cette fonctionnalité.'));
  }
  next();
};

// ============================================
// REQUIRE COMPLETE PROFILE
// ============================================
exports.requireCompleteProfile = (req, res, next) => {
  if (!req.user.profileCompleted) {
    return next(
      new AppError(403, 'Veuillez compléter votre profil pour accéder à cette fonctionnalité.')
    );
  }
  next();
};

// ============================================
// REQUIRE PARTIMER VERIFIED PROFILE
// ============================================
exports.requirePartimerVerified = (req, res, next) => {
  if (req.user.userType === 'partimer' && !req.user.profileCompleted) {
    return res.status(403).json({
      success: false,
      message: 'Vous devez compléter votre profil avant de postuler aux missions.',
      profileCompleted: false
    });
  }
  next();
};

// ============================================
// CHECK MISSION OWNERSHIP
// ============================================
exports.checkMissionOwnership = (Mission) => {
  return catchAsync(async (req, res, next) => {
    const mission = await Mission.findById(req.params.id || req.params.missionId);
    
    if (!mission) {
      return next(new AppError(404, 'Mission non trouvée.'));
    }

    if (mission.createdBy.toString() !== req.user._id.toString()) {
      return next(new AppError(403, 'Vous n\'êtes pas autorisé à modifier cette mission.'));
    }

    // Attach mission to request for use in controller
    req.mission = mission;
    next();
  });
};

// ============================================
// OPTIONAL AUTH - Don't fail if no token
// ============================================
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(); // No token, continue without user
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('+active');
    
    if (user && user.active !== false) {
      req.user = user; // Attach user if valid
    }
    
    next();
  } catch (err) {
    // If token is invalid, just continue without user
    next();
  }
};

module.exports = exports;