// controllers/userController.js

const User = require('../models/User');
const Mission = require('../models/Mission');
const { deleteFile, extractPublicId } = require('../config/cloudinary');
const bcrypt = require('bcryptjs');

// ============================================
// GET USER PROFILE
// ============================================
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('-password -emailVerificationCode -passwordResetCode');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user
      }
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil',
      error: error.message
    });
  }
};



// ============================================
// UPDATE USER PROFILE
// ============================================
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('📥 Update profile request:', {
      userId,
      body: req.body,
      userType: req.user.userType
    });

    // Fields that cannot be updated
    const restrictedFields = [
      'password', 'email', 'userType', 'emailVerified',
      'tokens', 'subscriptionPlan', 'rating', 'completedMissions',
      'statistics', 'createdAt', 'updatedAt', '_id', '__v'
    ];

    // Remove restricted fields
    restrictedFields.forEach(field => delete req.body[field]);

    // Get current user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    console.log('👤 Current user:', {
      id: user._id,
      userType: user.userType,
      email: user.email
    });

    // Handle Partimer-specific fields
    if (user.userType === 'partimer') {
      // Handle anneeNaissance -> dateOfBirth conversion
      if (req.body.anneeNaissance) {
        const year = parseInt(req.body.anneeNaissance);
        if (!isNaN(year)) {
          req.body.dateOfBirth = new Date(year, 0, 1); // January 1st of that year
          console.log('📅 Converted anneeNaissance to dateOfBirth:', req.body.dateOfBirth);
        }
        delete req.body.anneeNaissance;
      }

      // Handle nomComplet -> firstName/lastName conversion
      if (req.body.nomComplet && !req.body.firstName) {
        const names = req.body.nomComplet.trim().split(' ');
        req.body.firstName = names[0];
        req.body.lastName = names.slice(1).join(' ') || names[0];
        console.log('👤 Converted nomComplet to firstName/lastName:', {
          firstName: req.body.firstName,
          lastName: req.body.lastName
        });
      }

      // Handle villeResidence -> city conversion
      if (req.body.villeResidence) {
        req.body.city = req.body.villeResidence;
        console.log('🏙️ Converted villeResidence to city:', req.body.city);
      }

      // Sync phone/telephone
      if (req.body.phone) {
        req.body.telephone = req.body.phone;
      }
      if (req.body.telephone) {
        req.body.phone = req.body.telephone;
      }

      // Handle adresseComplete -> address conversion
      if (req.body.adresseComplete) {
        req.body.address = req.body.adresseComplete;
      }

      // Handle categoriesMissions -> serviceCategories
      if (req.body.categoriesMissions) {
        req.body.serviceCategories = req.body.categoriesMissions;
      }

      // Handle competences -> skills
      if (req.body.competences) {
        req.body.skills = req.body.competences;
      }

      // Handle preferenceTravail -> availability
      if (req.body.preferenceTravail) {
        req.body.availability = req.body.preferenceTravail;
      }

      // Handle problemesSante -> problemeSanteChronique
      if (req.body.problemesSante) {
        req.body.problemeSanteChronique = req.body.problemesSante;
      }

      // Handle raisonTravail -> motivationPartTime
      if (req.body.raisonTravail) {
        req.body.motivationPartTime = req.body.raisonTravail;
      }

      // Handle experienceDetails -> experiencesAnterieures
      if (req.body.experienceDetails) {
        req.body.experiencesAnterieures = req.body.experienceDetails;
      }

      // Handle domaineExpertise -> domaineEtudes
      if (req.body.domaineExpertise) {
        req.body.domaineEtudes = req.body.domaineExpertise;
      }

      // Handle motorise -> moyensTransport (if it's an array)
      if (req.body.motorise && Array.isArray(req.body.motorise)) {
        req.body.moyensTransport = req.body.motorise;
        req.body.motorise = req.body.motorise.length > 0;
      }

      // Handle languesParlees
      if (req.body.languesParlees && Array.isArray(req.body.languesParlees)) {
        req.body.languages = req.body.languesParlees.map(lang => {
          if (typeof lang === 'string') {
            return { language: lang, level: 'intermediate' };
          }
          return lang;
        });
      }

      // Ensure languages array structure
      if (req.body.languages && Array.isArray(req.body.languages)) {
        req.body.languages = req.body.languages.map(lang => {
          if (typeof lang === 'string') {
            return { language: lang, level: 'intermediate' };
          }
          return lang;
        });
      }
    }

    console.log('📝 Final update data:', req.body);

    // Update user with new data
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        user[key] = req.body[key];
      }
    });

    // Save the user
    await user.save();

    console.log('✅ User updated successfully');

    // Fetch updated user without sensitive fields
    const updatedUser = await User.findById(userId)
      .select('-password -emailVerificationCode -passwordResetCode');

    res.status(200).json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: {
        user: updatedUser
      }
    });

  } catch (error) {
    console.error('❌ Update profile error:', error);
    console.error('Error stack:', error.stack);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation',
        errors: messages
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Cette valeur existe déjà dans le système'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil',
      error: error.message
    });
  }
};




// ============================================
// UPDATE EMAIL
// ============================================
// ============================================
// UPDATE EMAIL - FIXED VERSION
// ============================================
const updateEmail = async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log("📥 Update email request body:", req.body);
    
    // Extract newEmail - handle both direct string and object format
    let emailToUpdate;
    
    if (typeof req.body === 'string') {
      emailToUpdate = req.body;
    } else if (req.body.newEmail) {
      emailToUpdate = req.body.newEmail;
    } else if (typeof req.body.email === 'string') {
      emailToUpdate = req.body.email;
    } else {
      console.error("❌ Could not extract email from request:", req.body);
      return res.status(400).json({
        success: false,
        message: 'Format de requête invalide. Nouvel email requis.'
      });
    }

    console.log("✅ Extracted email:", emailToUpdate);
    console.log("✅ Email type:", typeof emailToUpdate);



    if (!emailToUpdate || typeof emailToUpdate !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Nouvel email requis'
      });
    }

    // Trim and validate email format
    const newEmail = emailToUpdate.trim().toLowerCase();
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Format d\'email invalide'
      });
    }

    // Check if email is already taken
    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser && existingUser._id.toString() !== userId) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Check if email is the same as current
    if (user.email === newEmail) {
      return res.status(400).json({
        success: false,
        message: 'Le nouvel email est identique à l\'ancien'
      });
    }

    // Update email and set as unverified
    user.email = newEmail;
    user.emailVerified = false;
    
    // Generate new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailVerificationCode = verificationCode;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    console.log("✅ Email updated successfully to:", newEmail);

    // TODO: Send verification email with new code

    res.status(200).json({
      success: true,
      message: 'Email mis à jour. Veuillez vérifier votre nouvelle adresse email.',
      data: {
        email: user.email,
        emailVerified: user.emailVerified
      }
    });

  } catch (error) {
    console.error('❌ Update email error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'email',
      error: error.message
    });
  }
};

// ============================================
// UPDATE PASSWORD
// ============================================
const updatePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe actuel et nouveau mot de passe requis'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
      });
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Verify current password
    const isCurrentPasswordCorrect = await user.correctPassword(currentPassword, user.password);
    if (!isCurrentPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe actuel incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    user.passwordChangedAt = Date.now();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Mot de passe mis à jour avec succès'
    });

  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du mot de passe',
      error: error.message
    });
  }
};

// ============================================
// UPLOAD PROFILE PHOTO
// ============================================
const uploadProfilePhoto = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucune photo téléchargée'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Delete old profile picture if exists
    if (user.profilePicture) {
      try {
        const oldPublicId = extractPublicId(user.profilePicture);
        if (oldPublicId) {
          await deleteFile(oldPublicId, 'image');
        }
      } catch (error) {
        console.error('Error deleting old photo:', error);
      }
    }

    user.profilePicture = req.file.path;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Photo de profil téléchargée avec succès',
      data: {
        profilePicture: user.profilePicture
      }
    });

  } catch (error) {
    console.error('Upload profile photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement de la photo',
      error: error.message
    });
  }
};

// ============================================
// UPLOAD COMPANY LOGO
// ============================================
const uploadCompanyLogo = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun logo téléchargé'
      });
    }

    const user = await User.findById(userId);
    if (!user || user.userType !== 'entreprise') {
      return res.status(403).json({
        success: false,
        message: 'Cette fonctionnalité est réservée aux entreprises'
      });
    }

    // Delete old logo if exists
    if (user.companyLogo) {
      try {
        const oldPublicId = extractPublicId(user.companyLogo);
        if (oldPublicId) {
          await deleteFile(oldPublicId, 'image');
        }
      } catch (error) {
        console.error('Error deleting old logo:', error);
      }
    }

    user.companyLogo = req.file.path;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Logo téléchargé avec succès',
      data: {
        companyLogo: user.companyLogo
      }
    });

  } catch (error) {
    console.error('Upload company logo error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement du logo',
      error: error.message
    });
  }
};

// ============================================
// UPLOAD DOCUMENTS
// ============================================
const uploadDocuments = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier téléchargé'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const uploadedDocs = [];

    // Process CIN document
    if (req.files.cinDocument && req.files.cinDocument.length > 0) {
      // Delete old CIN if exists
      if (user.cinDocumentPartimer) {
        try {
          const oldPublicId = extractPublicId(user.cinDocumentPartimer);
          if (oldPublicId) {
            const resourceType = user.cinDocumentPartimer.includes('.pdf') ? 'raw' : 'image';
            await deleteFile(oldPublicId, resourceType);
          }
        } catch (error) {
          console.error('Error deleting old CIN:', error);
        }
      }

      user.cinDocumentPartimer = req.files.cinDocument[0].path;
      uploadedDocs.push({
        type: 'cinDocument',
        url: req.files.cinDocument[0].path
      });
    }

    // Process CIN document for partimer
    if (req.files.cinDocumentPartimer && req.files.cinDocumentPartimer.length > 0) {
      // Delete old CIN if exists
      if (user.cinDocumentPartimer) {
        try {
          const oldPublicId = extractPublicId(user.cinDocumentPartimer);
          if (oldPublicId) {
            const resourceType = user.cinDocumentPartimer.includes('.pdf') ? 'raw' : 'image';
            await deleteFile(oldPublicId, resourceType);
          }
        } catch (error) {
          console.error('Error deleting old CIN:', error);
        }
      }

      user.cinDocumentPartimer = req.files.cinDocumentPartimer[0].path;
      uploadedDocs.push({
        type: 'cinDocumentPartimer',
        url: req.files.cinDocumentPartimer[0].path
      });
    }

    // Process driving permits
    if (req.files.permisDocuments && req.files.permisDocuments.length > 0) {
      // Delete old permits if exists
      if (user.permisDocuments && user.permisDocuments.length > 0) {
        try {
          for (const oldPermit of user.permisDocuments) {
            const oldPublicId = extractPublicId(oldPermit);
            if (oldPublicId) {
              const resourceType = oldPermit.includes('.pdf') ? 'raw' : 'image';
              await deleteFile(oldPublicId, resourceType);
            }
          }
        } catch (error) {
          console.error('Error deleting old permits:', error);
        }
      }

      user.permisDocuments = req.files.permisDocuments.map(file => file.path);
      req.files.permisDocuments.forEach(file => {
        uploadedDocs.push({
          type: 'permisDocument',
          url: file.path
        });
      });
    }

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Documents téléchargés avec succès',
      data: {
        documents: uploadedDocs,
        user: {
          cinDocumentPartimer: user.cinDocumentPartimer,
          permisDocuments: user.permisDocuments
        }
      }
    });

  } catch (error) {
    console.error('Upload documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement des documents',
      error: error.message
    });
  }
};

// ============================================
// DELETE PROFILE PHOTO
// ============================================
const deleteProfilePhoto = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    if (!user.profilePicture) {
      return res.status(400).json({
        success: false,
        message: 'Aucune photo de profil à supprimer'
      });
    }

    // Delete from Cloudinary
    try {
      const publicId = extractPublicId(user.profilePicture);
      if (publicId) {
        await deleteFile(publicId, 'image');
      }
    } catch (error) {
      console.error('Error deleting file from Cloudinary:', error);
    }

    user.profilePicture = null;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Photo de profil supprimée avec succès'
    });

  } catch (error) {
    console.error('Delete profile photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la photo',
      error: error.message
    });
  }
};

// ============================================
// DELETE DOCUMENT
// ============================================
const deleteDocument = async (req, res) => {
  try {
    const { documentType } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    let documentUrl = null;
    let resourceType = 'image';

    if (documentType === 'cin' && user.cinDocumentPartimer) {
      documentUrl = user.cinDocumentPartimer;
      user.cinDocumentPartimer = null;
    } else if (documentType === 'permis' && user.permisDocuments && user.permisDocuments.length > 0) {
      // Delete all permit documents
      const publicIds = user.permisDocuments.map(url => extractPublicId(url)).filter(id => id);

      for (const publicId of publicIds) {
        const type = user.permisDocuments.find(url => url.includes(publicId))?.includes('.pdf') ? 'raw' : 'image';
        await deleteFile(publicId, type);
      }

      user.permisDocuments = [];
      await user.save({ validateBeforeSave: false });

      return res.status(200).json({
        success: true,
        message: 'Tous les documents de permis supprimés avec succès'
      });
    } else if (documentType === 'logo' && user.companyLogo) {
      documentUrl = user.companyLogo;
      user.companyLogo = null;
    } else {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé'
      });
    }

    // Delete from Cloudinary
    if (documentUrl) {
      const publicId = extractPublicId(documentUrl);
      if (publicId) {
        if (documentUrl.includes('.pdf')) {
          resourceType = 'raw';
        }
        await deleteFile(publicId, resourceType);
      }
    }

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Document supprimé avec succès'
    });

  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du document',
      error: error.message
    });
  }
};

// ============================================
// DELETE ACCOUNT
// ============================================
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe requis pour confirmer la suppression'
      });
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Verify password
    const isPasswordCorrect = await user.correctPassword(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe incorrect'
      });
    }

    // Soft delete - set active to false
    user.active = false;
    user.email = `deleted_${Date.now()}_${user.email}`;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Compte désactivé avec succès'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du compte',
      error: error.message
    });
  }
};

// ============================================
// GET PARTIMER DASHBOARD
// ============================================
const getPartimerDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user || user.userType !== 'partimer') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé'
      });
    }

    // Get missions statistics
    const appliedMissions = await Mission.find({
      'applications.partimer': userId
    }).select('title status applications deadline budget');

    const acceptedMissions = appliedMissions.filter(mission =>
      mission.applications.some(app =>
        app.partimer.toString() === userId && app.status === 'accepted'
      )
    );

    const pendingMissions = appliedMissions.filter(mission =>
      mission.applications.some(app =>
        app.partimer.toString() === userId && app.status === 'pending'
      )
    );

    const completedMissions = appliedMissions.filter(mission =>
      mission.applications.some(app =>
        app.partimer.toString() === userId && app.status === 'completed'
      )
    );

    // Calculate total earnings
    const totalEarnings = completedMissions.reduce((total, mission) => {
      const application = mission.applications.find(app =>
        app.partimer.toString() === userId
      );
      return total + (application?.budget || mission.budget || 0);
    }, 0);

    // Get recent applications (last 5)
    const recentApplications = appliedMissions
      .slice(0, 5)
      .map(mission => ({
        id: mission._id,
        title: mission.title,
        status: mission.applications.find(app =>
          app.partimer.toString() === userId
        )?.status,
        appliedAt: mission.applications.find(app =>
          app.partimer.toString() === userId
        )?.appliedAt,
        budget: mission.budget
      }));

    // Get upcoming missions (accepted but not completed)
    const upcomingMissions = acceptedMissions
      .filter(mission => mission.status !== 'completed')
      .slice(0, 3)
      .map(mission => ({
        id: mission._id,
        title: mission.title,
        deadline: mission.deadline,
        budget: mission.budget
      }));

    // Availability stats
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    const upcomingAvailability = user.availabilitySlots.filter(slot => 
      slot.date >= today && slot.date <= nextWeek
    ).length;

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          nomComplet: user.firstName + ' ' + user.lastName,
          profilePicture: user.profilePicture,
          city: user.city,
          profileCompletion: user.profileCompletion,
          rating: user.rating,
          completedMissions: user.completedMissions
        },
        stats: {
          appliedMissions: appliedMissions.length,
          acceptedMissions: acceptedMissions.length,
          pendingMissions: pendingMissions.length,
          completedMissions: completedMissions.length,
          totalEarnings,
          profileViews: user.statistics?.profileViews || 0,
          upcomingAvailability
        },
        recentApplications,
        upcomingMissions,
        profileCompletion: {
          percentage: user.profileCompletion,
          missingFields: getMissingProfileFields(user)
        }
      }
    });

  } catch (error) {
    console.error('Get partimer dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du tableau de bord',
      error: error.message
    });
  }
};

// ============================================
// GET RECRUITER DASHBOARD
// ============================================
const getRecruiterDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user || (user.userType !== 'entreprise' && user.userType !== 'particulier')) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé'
      });
    }

    // Get missions statistics
    const postedMissions = await Mission.find({ createdBy: userId });
    const activeMissions = postedMissions.filter(mission => 
      ['published', 'in-progress'].includes(mission.status)
    );
    const completedMissions = postedMissions.filter(mission => 
      mission.status === 'completed'
    );

    // Calculate total spent
    const totalSpent = completedMissions.reduce((total, mission) => {
      return total + (mission.budget || 0);
    }, 0);

    // Get recent missions (last 5)
    const recentMissions = postedMissions
      .slice(0, 5)
      .map(mission => ({
        id: mission._id,
        title: mission.title,
        status: mission.status,
        applications: mission.applicationCount,
        budget: mission.budget,
        createdAt: mission.createdAt
      }));

    // Get pending applications
    const pendingApplications = await Mission.aggregate([
      { $match: { createdBy: userId } },
      { $unwind: '$applications' },
      { $match: { 'applications.status': 'pending' } },
      { $project: {
          missionTitle: '$title',
          applicant: '$applications.partimer',
          appliedAt: '$applications.appliedAt',
          budget: '$applications.budget'
        }
      },
      { $limit: 5 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.userType === 'entreprise' ? user.raisonSociale : user.nomComplet,
          profilePicture: user.profilePicture || user.companyLogo,
          userType: user.userType
        },
        stats: {
          postedMissions: postedMissions.length,
          activeMissions: activeMissions.length,
          completedMissions: completedMissions.length,
          totalSpent,
          profileViews: user.statistics?.profileViews || 0,
          pendingApplications: pendingApplications.length
        },
        recentMissions,
        pendingApplications
      }
    });

  } catch (error) {
    console.error('Get recruiter dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du tableau de bord',
      error: error.message
    });
  }
};

// ============================================
// GET USER STATS
// ============================================
const getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    let stats = {};

    if (user.userType === 'partimer') {
      const appliedMissions = await Mission.countDocuments({
        'applications.partimer': userId
      });
      const completedMissions = await Mission.countDocuments({
        'applications.partimer': userId,
        'applications.status': 'completed'
      });

      stats = {
        appliedMissions,
        completedMissions,
        profileViews: user.statistics?.profileViews || 0,
        rating: user.rating,
        availabilitySlots: user.availabilitySlots.length
      };
    } else {
      const postedMissions = await Mission.countDocuments({ createdBy: userId });
      const completedMissions = await Mission.countDocuments({
        createdBy: userId,
        status: 'completed'
      });

      stats = {
        postedMissions,
        completedMissions,
        profileViews: user.statistics?.profileViews || 0,
        availableTokens: user.tokens?.available || 0
      };
    }

    res.status(200).json({
      success: true,
      data: {
        stats
      }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
};

// ============================================
// GET USER ACTIVITY
// ============================================
const getUserActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    // This would typically come from an Activity model
    // For now, we'll return a placeholder
    const activities = [
      {
        type: 'login',
        description: 'Connexion réussie',
        timestamp: new Date(),
        ip: req.ip
      }
    ];

    res.status(200).json({
      success: true,
      data: {
        activities: activities.slice(0, limit),
        total: activities.length
      }
    });

  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'activité',
      error: error.message
    });
  }
};

// ============================================
// UPDATE NOTIFICATION SETTINGS
// ============================================
const updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notifications } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    if (notifications) {
      user.preferences.notifications = {
        ...user.preferences.notifications,
        ...notifications
      };
    }

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Paramètres de notification mis à jour',
      data: {
        notifications: user.preferences.notifications
      }
    });

  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des paramètres',
      error: error.message
    });
  }
};

// ============================================
// UPDATE PRIVACY SETTINGS
// ============================================
const updatePrivacySettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { privacy } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // For now, we'll handle basic privacy settings
    // This can be expanded based on your privacy requirements

    res.status(200).json({
      success: true,
      message: 'Paramètres de confidentialité mis à jour',
      data: {
        privacy: user.preferences.privacy
      }
    });

  } catch (error) {
    console.error('Update privacy settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des paramètres',
      error: error.message
    });
  }
};

// ============================================
// COMPLETE PARTIMER PROFILE
// ============================================
const completePartimerProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    if (user.userType !== 'partimer') {
      return res.status(403).json({
        success: false,
        message: 'Cette fonctionnalité est réservée aux Partimers'
      });
    }

    const updateData = req.body;

    // Update user fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        user[key] = updateData[key];
      }
    });

    await user.save();

    // Check if profile is complete
    const isProfileComplete = checkPartimerProfileCompletion(user);

    res.status(200).json({
      success: true,
      message: isProfileComplete
        ? 'Profil complété avec succès! Vous pouvez maintenant postuler aux missions.'
        : 'Profil mis à jour. Veuillez compléter tous les champs requis.',
      data: {
        user: {
          id: user._id,
          nomComplet: user.firstName + ' ' + user.lastName,
          profileCompletion: user.profileCompletion,
          profileCompleted: isProfileComplete
        },
        profileCompleted: isProfileComplete
      }
    });

  } catch (error) {
    console.error('Complete partimer profile error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil',
      error: error.message
    });
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if partimer profile is complete
 */
const checkPartimerProfileCompletion = (user) => {
  const requiredFields = [
    'firstName', 'lastName', 'email', 'phone', 'city',
    'dateOfBirth', 'profilePicture', 'skills', 'languages'
  ];

  const completedFields = requiredFields.filter(field => {
    if (field === 'skills' || field === 'languages') {
      return user[field] && user[field].length > 0;
    }
    return user[field];
  });

  const completionPercentage = (completedFields.length / requiredFields.length) * 100;
  return completionPercentage >= 80; // Consider profile complete if 80% filled
};

/**
 * Get missing profile fields for completion
 */
const getMissingProfileFields = (user) => {
  const requiredFields = {
    'firstName': 'Prénom',
    'lastName': 'Nom',
    'email': 'Email',
    'phone': 'Téléphone',
    'city': 'Ville',
    'dateOfBirth': 'Date de naissance',
    'profilePicture': 'Photo de profil',
    'skills': 'Compétences',
    'languages': 'Langues parlées'
  };

  const missing = [];

  Object.keys(requiredFields).forEach(field => {
    if (field === 'skills' || field === 'languages') {
      if (!user[field] || user[field].length === 0) {
        missing.push(requiredFields[field]);
      }
    } else if (!user[field]) {
      missing.push(requiredFields[field]);
    }
  });

  return missing;
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
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
};