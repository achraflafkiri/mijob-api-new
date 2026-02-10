const User = require('../models/User');
const Mission = require('../models/Mission');
const { deleteFile, extractPublicId } = require('../config/cloudinary');
const bcrypt = require('bcryptjs');

// ============================================================
// REGISTER PARTIMER
// ============================================================
// const registerPartimer = async (req, res) => {
//   try {
//     console.log('Request body:', req.body);
//     console.log('Request files:', req.files);

//     const {
//       email,
//       password,
//       nomComplet,
//       telephone,
//       anneeNaissance,
//       villeResidence,

//       // Personal information
//       adresseComplete,
//       taille,
//       poids,
//       nationalite,
//       languesParlees,

//       // Job preferences
//       categoriesMissions,
//       preferenceTravail,

//       // Health
//       problemesSante,
//       limitationsPhysiques,

//       // Professional
//       raisonTravail,
//       raisonTravailAutre,
//       traitsPersonnalite,
//       experience,
//       experienceDetails,
//       niveauEtudes,
//       domaineExpertise,
//       competences,

//       // Transport
//       permisConduire,
//       motorise,
//       transportAutre,

//       // New fields from frontend that need mapping
//       nationaliteAutre,
//       limitationsPhysiquesAutre,
//       domaineExpertiseAutre
//     } = req.body;

//     console.log("req.body: \n", req.body);

//     // Validate required fields
//     if (!email || !password || !nomComplet || !telephone || !anneeNaissance || !villeResidence) {
//       return res.status(400).json({
//         success: false,
//         message: 'Tous les champs obligatoires doivent être remplis'
//       });
//     }

//     // Check if user already exists
//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(400).json({
//         success: false,
//         message: 'Un utilisateur avec cet email existe déjà'
//       });
//     }

//     // Calculate date of birth from year
//     const dateOfBirth = anneeNaissance ? new Date(parseInt(anneeNaissance), 0, 1) : null;

//     // Extract first and last name from nomComplet
//     const names = nomComplet.trim().split(' ');
//     const firstName = names[0] || '';
//     const lastName = names.slice(1).join(' ') || '';

//     // Parse JSON strings from form-data - WITH ERROR HANDLING
//     const parseJsonField = (field) => {
//       if (!field) return [];
//       try {
//         return typeof field === 'string' ? JSON.parse(field) : field;
//       } catch (error) {
//         console.error(`Error parsing ${field}:`, error);
//         return [];
//       }
//     };

//     const parsedLanguages = parseJsonField(languesParlees);
//     const parsedCategories = parseJsonField(categoriesMissions);
//     const parsedLimitations = parseJsonField(limitationsPhysiques);
//     const parsedRaisons = parseJsonField(raisonTravail);
//     const parsedTraits = parseJsonField(traitsPersonnalite);
//     const parsedCompetences = parseJsonField(competences);
//     const parsedPermis = parseJsonField(permisConduire);
//     const parsedMotorise = parseJsonField(motorise);

//     // Handle "Autre" fields
//     const finalNationalite = nationalite === "Autre" && nationaliteAutre ? nationaliteAutre : nationalite;
//     const finalDomaineExpertise = domaineExpertise === "Autre" && domaineExpertiseAutre ? domaineExpertiseAutre : domaineExpertise;

//     // Handle limitations with "Autre" option
//     let finalLimitations = parsedLimitations;
//     if (parsedLimitations.includes("Autre (à préciser)") && limitationsPhysiquesAutre) {
//       finalLimitations = parsedLimitations.filter(lim => lim !== "Autre (à préciser)");
//       finalLimitations.push(limitationsPhysiquesAutre);
//     }

//     // Handle file uploads - FIXED FIELD NAMES
//     let profilePictureUrl = null;
//     let cinFileUrl = null;
//     let permisFileUrls = [];
//     let autreDocUrl = null;

//     if (req.files) {
//       // FIX: Map frontend field names to backend expected field names
//       if (req.files.photoProfil && req.files.photoProfil[0]) {
//         profilePictureUrl = req.files.photoProfil[0].path;
//       }
//       if (req.files.cinFile && req.files.cinFile[0]) {
//         cinFileUrl = req.files.cinFile[0].path;
//       }
//       if (req.files.permisFile) {
//         permisFileUrls = req.files.permisFile.map(file => file.path);
//       }
//       if (req.files.autreDoc && req.files.autreDoc[0]) {
//         autreDocUrl = req.files.autreDoc[0].path;
//       }
//     }

//     // Validate profile picture
//     if (!profilePictureUrl) {
//       return res.status(400).json({
//         success: false,
//         message: 'La photo de profil est obligatoire'
//       });
//     }

//     // Create user object
//     const userData = {
//       email: email.toLowerCase().trim(),
//       password: password,
//       userType: 'partimer',
//       phone: telephone,
//       city: villeResidence,

//       // Partimer specific fields
//       firstName,
//       lastName,
//       dateOfBirth,
//       profilePicture: profilePictureUrl,

//       // Personal information
//       address: adresseComplete || undefined,
//       taille: taille || undefined,
//       poids: poids || undefined,
//       nationalite: finalNationalite || undefined,
//       languages: parsedLanguages.map(lang => ({
//         language: lang,
//         level: 'intermediate'
//       })),

//       // Job preferences
//       serviceCategories: parsedCategories,
//       preferenceTravail: preferenceTravail || undefined,

//       // Health
//       problemeSanteChronique: problemesSante || undefined,
//       limitationsPhysiques: finalLimitations,

//       // Professional
//       motivationPartTime: parsedRaisons,
//       raisonTravailAutre: raisonTravailAutre || undefined,
//       traitsPersonnalite: parsedTraits,
//       experiencesAnterieures: experience === 'non' ? 'Aucune expérience professionnelle' : (experienceDetails || undefined),
//       niveauEtudes: niveauEtudes || undefined,
//       domaineEtudes: finalDomaineExpertise || undefined,
//       skills: parsedCompetences,

//       // Transport
//       permisConduire: parsedPermis,
//       motorise: parsedMotorise.length > 0,
//       moyensTransport: parsedMotorise,
//       transportAutre: transportAutre || undefined,

//       // Documents
//       cinDocumentPartimer: cinFileUrl || undefined,
//       permisDocuments: permisFileUrls.length > 0 ? permisFileUrls : undefined,
//       autreDocument: autreDocUrl || undefined,

//       // Add all the new fields from frontend
//       nomComplet: nomComplet,
//       anneeNaissance: anneeNaissance,
//       villeResidence: villeResidence,
//       adresseComplete: adresseComplete || undefined,
//       categoriesMissions: parsedCategories,
//       competences: parsedCompetences,
//       languesParlees: parsedLanguages,
//       problemesSante: problemesSante || undefined,
//       raisonTravail: parsedRaisons,
//       experienceDetails: experienceDetails || undefined,
//       domaineExpertise: finalDomaineExpertise || undefined,
//       limitationsPhysiquesAutre: limitationsPhysiquesAutre || undefined,

//       // Availability fields
//       timePreferences: {
//         preferredStartTime: '09:00',
//         preferredEndTime: '17:00',
//         minimumMissionDuration: 60,
//         maximumMissionDuration: 480,
//         breakBetweenMissions: 30
//       },
//       advanceBooking: {
//         minimumNotice: 24,
//         maximumAdvance: 90
//       },
//       instantBookingEnabled: false,
//       vacationPeriods: []
//     };

//     // Remove undefined fields
//     Object.keys(userData).forEach(key => {
//       if (userData[key] === undefined) {
//         delete userData[key];
//       }
//     });

//     // console.log('Creating user with data:', {
//     //   email: userData.email,
//     //   userType: userData.userType,
//     //   firstName: userData.firstName,
//     //   lastName: userData.lastName
//     // });

//     // Create user
//     const user = await User.create(userData);

//     // Generate email verification code
//     const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
//     user.emailVerificationCode = verificationCode;
//     user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

//     console.log("verificationCode: ", verificationCode);

//     await user.save({ validateBeforeSave: false });

//     res.status(201).json({
//       success: true,
//       status: "success",
//       message: 'Compte Partimer créé avec succès! Veuillez vérifier votre email.',
//       data: {
//         user: {
//           id: user._id,
//           email: user.email,
//           nomComplet: user.firstName + ' ' + user.lastName,
//           userType: user.userType,
//           profileCompletion: user.profileCompletion,
//           profilePicture: user.profilePicture
//         }
//       }
//     });

//   } catch (error) {
//     console.error('Register partimer error details:', error);

//     // Delete uploaded files if user creation fails
//     if (req.files) {
//       const { deleteFile, extractPublicId } = require('../config/cloudinary');

//       for (const field in req.files) {
//         for (const file of req.files[field]) {
//           try {
//             const publicId = extractPublicId(file.path);
//             if (publicId) {
//               const resourceType = file.path.includes('.pdf') ? 'raw' : 'image';
//               await deleteFile(publicId, resourceType);
//             }
//           } catch (delError) {
//             console.error('Error deleting file:', delError);
//           }
//         }
//       }
//     }

//     if (error.name === 'ValidationError') {
//       const messages = Object.values(error.errors).map(err => ({
//         field: err.path,
//         message: err.message,
//         value: err.value
//       }));
//       console.log('Validation errors:', messages);
//       return res.status(400).json({
//         success: false,
//         message: 'Erreur de validation',
//         errors: messages.map(err => err.message)
//       });
//     }

//     if (error.code === 11000) {
//       return res.status(400).json({
//         success: false,
//         message: 'Un utilisateur avec cet email existe déjà'
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: 'Erreur lors de la création du compte',
//       error: error.message,
//       stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
//     });
//   }
// };

const registerPartimer = async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('Request files:', req.files);

    const {
      email,
      password,
      nomComplet,
      telephone,
      anneeNaissance,
      villeResidence,

      // Personal information
      adresseComplete,
      taille,
      poids,
      nationalite,
      languesParlees,

      // Job preferences
      categoriesMissions,
      preferenceTravail,

      // Health
      problemesSante,
      limitationsPhysiques,

      // Professional
      raisonTravail,
      raisonTravailAutre,
      traitsPersonnalite,
      experience,
      experienceDetails,
      niveauEtudes,
      domaineExpertise,
      competences,

      // Transport
      permisConduire,
      motorise,
      transportAutre,

      // New fields from frontend that need mapping
      nationaliteAutre,
      limitationsPhysiquesAutre,
      domaineExpertiseAutre
    } = req.body;

    console.log("req.body: \n", JSON.stringify(req.body, null, 2));

    // Validate required fields
    if (!email || !password || !nomComplet || !telephone || !anneeNaissance || !villeResidence) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs obligatoires doivent être remplis'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Un utilisateur avec cet email existe déjà'
      });
    }

    // Calculate date of birth from year
    const dateOfBirth = anneeNaissance ? new Date(parseInt(anneeNaissance), 0, 1) : null;

    // Extract first and last name from nomComplet
    const names = nomComplet.trim().split(' ');
    const firstName = names[0] || '';
    const lastName = names.slice(1).join(' ') || '';

    // Parse JSON strings from form-data - WITH ERROR HANDLING
    const parseJsonField = (field) => {
      if (!field) return [];
      try {
        return typeof field === 'string' ? JSON.parse(field) : field;
      } catch (error) {
        console.error(`Error parsing ${field}:`, error);
        return [];
      }
    };

    const parsedLanguages = parseJsonField(languesParlees);
    const parsedCategories = parseJsonField(categoriesMissions);
    const parsedLimitations = parseJsonField(limitationsPhysiques);
    const parsedRaisons = parseJsonField(raisonTravail);
    const parsedTraits = parseJsonField(traitsPersonnalite);
    const parsedCompetences = parseJsonField(competences);
    const parsedPermis = parseJsonField(permisConduire);
    const parsedMotorise = parseJsonField(motorise);

    // Handle "Autre" fields
    const finalNationalite = nationalite === "Autre" && nationaliteAutre ? nationaliteAutre : nationalite;
    const finalDomaineExpertise = domaineExpertise === "Autre" && domaineExpertiseAutre ? domaineExpertiseAutre : domaineExpertise;

    // Handle limitations with "Autre" option
    let finalLimitations = parsedLimitations;
    if (parsedLimitations.includes("Autre (à préciser)") && limitationsPhysiquesAutre) {
      finalLimitations = parsedLimitations.filter(lim => lim !== "Autre (à préciser)");
      finalLimitations.push(limitationsPhysiquesAutre);
    }

    // Handle "Autre" for work reasons
    let finalRaisons = parsedRaisons;
    if (parsedRaisons && parsedRaisons.includes("Autre (champ texte libre)") && raisonTravailAutre) {
      finalRaisons = parsedRaisons.filter(reason => reason !== "Autre (champ texte libre)");
      finalRaisons.push(raisonTravailAutre);
    }

    // Handle file uploads - FIXED FIELD NAMES MAPPING
    let profilePictureUrl = null;
    let cinFileUrl = null;
    let permisFileUrls = [];
    let autreDocUrl = null;

    if (req.files) {
      console.log('Uploaded files:', Object.keys(req.files));

      // Map frontend field names to backend expected field names
      if (req.files.photoProfil && req.files.photoProfil[0]) {
        profilePictureUrl = req.files.photoProfil[0].path;
        console.log('Profile photo uploaded:', profilePictureUrl);
      }

      // Frontend sends "cinFile" -> backend expects "cinDocumentPartimer"
      if (req.files.cinFile && req.files.cinFile[0]) {
        cinFileUrl = req.files.cinFile[0].path;
        console.log('CIN file uploaded:', cinFileUrl);
      }

      // Frontend sends "permisFile" -> backend expects "permisDocuments" (array)
      if (req.files.permisFile) {
        permisFileUrls = req.files.permisFile.map(file => file.path);
        console.log('Permis files uploaded:', permisFileUrls);
      }

      // Frontend sends "autreDoc" -> backend expects "autreDocument"
      if (req.files.autreDoc && req.files.autreDoc[0]) {
        autreDocUrl = req.files.autreDoc[0].path;
        console.log('Other document uploaded:', autreDocUrl);
      }
    }

    // Validate profile picture
    if (!profilePictureUrl) {
      return res.status(400).json({
        success: false,
        message: 'La photo de profil est obligatoire'
      });
    }

    // Create user object with ALL frontend fields
    const userData = {
      email: email.toLowerCase().trim(),
      password: password,
      userType: 'partimer',
      phone: telephone,
      city: villeResidence,

      // Partimer specific fields
      firstName,
      lastName,
      dateOfBirth,
      profilePicture: profilePictureUrl,

      // Personal information - Map frontend to backend
      address: adresseComplete || undefined,
      taille: taille || undefined,
      poids: poids || undefined,
      nationalite: finalNationalite || undefined,
      languages: parsedLanguages.map(lang => ({
        language: lang,
        level: 'intermediate'
      })),

      // Job preferences
      serviceCategories: parsedCategories,
      preferenceTravail: preferenceTravail || undefined,

      // Health
      problemeSanteChronique: problemesSante || undefined,
      limitationsPhysiques: finalLimitations,

      // Professional
      motivationPartTime: finalRaisons,
      raisonTravailAutre: raisonTravailAutre || undefined,
      traitsPersonnalite: parsedTraits,
      experiencesAnterieures: experience === 'non' ? 'Aucune expérience professionnelle' : (experienceDetails || undefined),
      niveauEtudes: niveauEtudes || undefined,
      domaineEtudes: finalDomaineExpertise || undefined,
      skills: parsedCompetences,

      // Transport
      permisConduire: parsedPermis,
      motorise: parsedMotorise.length > 0,
      moyensTransport: parsedMotorise,
      transportAutre: transportAutre || undefined,

      // Documents - Map frontend field names to backend field names
      cinDocumentPartimer: cinFileUrl || undefined,
      permisDocuments: permisFileUrls.length > 0 ? permisFileUrls : undefined,
      autreDocument: autreDocUrl || undefined,

      // ADD ALL THE NEW FIELDS FROM FRONTEND (keep same names)
      nomComplet: nomComplet,
      anneeNaissance: anneeNaissance,
      villeResidence: villeResidence,
      adresseComplete: adresseComplete || undefined,
      categoriesMissions: parsedCategories,
      competences: parsedCompetences,
      languesParlees: parsedLanguages,
      problemesSante: problemesSante || undefined,
      raisonTravail: finalRaisons,
      experienceDetails: experienceDetails || undefined,
      domaineExpertise: finalDomaineExpertise || undefined,

      // New "Autre" fields
      nationaliteAutre: nationaliteAutre || undefined,
      limitationsPhysiquesAutre: limitationsPhysiquesAutre || undefined,
      domaineExpertiseAutre: domaineExpertiseAutre || undefined,

      // Availability fields
      timePreferences: {
        preferredStartTime: '09:00',
        preferredEndTime: '17:00',
        minimumMissionDuration: 60,
        maximumMissionDuration: 480,
        breakBetweenMissions: 30
      },
      advanceBooking: {
        minimumNotice: 24,
        maximumAdvance: 90
      },
      instantBookingEnabled: false,
      vacationPeriods: []
    };

    // Remove undefined fields
    Object.keys(userData).forEach(key => {
      if (userData[key] === undefined) {
        delete userData[key];
      }
    });

    console.log('Creating user with data:', {
      email: userData.email,
      userType: userData.userType,
      firstName: userData.firstName,
      lastName: userData.lastName,
      // Log all frontend fields to verify they're included
      frontendFields: {
        nomComplet: userData.nomComplet,
        anneeNaissance: userData.anneeNaissance,
        villeResidence: userData.villeResidence,
        categoriesMissions: userData.categoriesMissions?.length || 0,
        competences: userData.competences?.length || 0,
        // Add other fields...
      }
    });

    // Create user
    const user = await User.create(userData);

    // Generate email verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailVerificationCode = verificationCode;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

    console.log("verificationCode: ", verificationCode);

    await user.save({ validateBeforeSave: false });

    // Send verification email
    try {
      const { sendEmail } = require('../utils/email');
      await sendEmail({
        email: user.email,
        subject: 'Vérifiez votre compte MIJOB',
        message: `Votre code de vérification est: ${verificationCode}\n\nCe code expire dans 24 heures.\n\nSi vous n'avez pas créé de compte, veuillez ignorer cet email.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #247F6E;">Bienvenue sur MIJOB!</h2>
            <p>Merci de vous être inscrit en tant que Partimer. Veuillez vérifier votre adresse email en utilisant le code ci-dessous:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 5px;">
              ${verificationCode}
            </div>
            <p style="color: #666;">Ce code expire dans <strong>24 heures</strong>.</p>
            <p style="color: #666;">Si vous n'avez pas créé de compte MIJOB, veuillez ignorer cet email.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px;">MIJOB - Votre plateforme de travail à temps partiel</p>
          </div>
        `
      });
      console.log("✅ Verification email sent to:", user.email);
    } catch (emailError) {
      console.error('❌ Error sending verification email:', emailError);
      // We don't necessarily want to fail registration if email fails, 
      // but we should warn the user.
    }

    res.status(201).json({
      success: true,
      status: "success",
      message: 'Compte Partimer créé avec succès! Veuillez vérifier votre email.',
      data: {
        user: {
          id: user._id,
          email: user.email,
          nomComplet: user.firstName + ' ' + user.lastName,
          userType: user.userType,
          profileCompletion: user.profileCompletion,
          profilePicture: user.profilePicture
        }
      }
    });

  } catch (error) {
    console.error('Register partimer error details:', error);
    console.error('Error stack:', error.stack);

    // Delete uploaded files if user creation fails
    if (req.files) {
      for (const field in req.files) {
        for (const file of req.files[field]) {
          try {
            const publicId = extractPublicId(file.path);
            if (publicId) {
              const resourceType = file.path.includes('.pdf') ? 'raw' : 'image';
              await deleteFile(publicId, resourceType);
            }
          } catch (delError) {
            console.error('Error deleting file:', delError);
          }
        }
      }
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
      console.log('Validation errors:', messages);
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation',
        errors: messages.map(err => err.message)
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Un utilisateur avec cet email existe déjà'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du compte',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// ============================================================
// COMPLETE PARTIMER PROFILE
// ============================================================
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

    const {
      // Personal information
      adresseComplete,
      quartier,
      taille,
      poids,
      nationalite,
      languesParlees,

      // Job preferences
      categoriesMissions,
      expertise,
      workPreference,
      publicComfort,

      // Health
      problemeSanteChronique,
      limitationsPhysiques,

      // Professional
      motivationPartTime,
      traitsPersonnalite,
      experiencesAnterieures,
      niveauEtudes,
      domaineEtudes,

      // Transport
      permisConduire,
      motorise,
      transportAutre,

      // Documents
      cinPartimer,
      permisDocuments
    } = req.body;

    // Update user fields
    const updateData = {
      // Personal information
      ...(adresseComplete && { address: adresseComplete }),
      ...(quartier && { quartier }),
      ...(taille && { taille }),
      ...(poids && { poids }),
      ...(nationalite && { nationalite }),
      ...(languesParlees && {
        languages: languesParlees.map(lang => ({
          language: lang,
          level: 'intermediate'
        }))
      }),

      // Job preferences
      ...(categoriesMissions && {
        serviceCategories: categoriesMissions.map(cat => ({
          category: cat,
          subcategories: []
        }))
      }),
      ...(expertise && { expertise }),
      ...(workPreference && {
        availability: workPreference === 'Sur site' ? 'on-site' :
          workPreference === 'À distance' ? 'remote' :
            workPreference === 'Les deux' ? 'flexible' : null
      }),
      ...(publicComfort && { publicComfort }),

      // Health
      ...(problemeSanteChronique && { problemeSanteChronique }),
      ...(limitationsPhysiques && { limitationsPhysiques }),

      // Professional
      ...(motivationPartTime && { motivationPartTime }),
      ...(traitsPersonnalite && { traitsPersonnalite }),
      ...(experiencesAnterieures && { experiencesAnterieures }),
      ...(niveauEtudes && { niveauEtudes }),
      ...(domaineEtudes && { domaineEtudes }),

      // Transport
      ...(permisConduire && { permisConduire }),
      ...(motorise !== undefined && { motorise }),
      ...(transportAutre && { moyenTransport: transportAutre }),

      // Documents
      ...(cinPartimer && { cinPartimer }),
      ...(permisDocuments && { permisDocuments })
    };

    // Update user
    Object.assign(user, updateData);
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

// ============================================================
// GET PARTIMER PROFILE (Public)
// ============================================================
const getPartimerProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const partimer = await User.findOne({
      _id: id,
      userType: 'partimer',
      active: true
    }).select('-password -emailVerificationCode -passwordResetCode -emailVerificationExpires -passwordResetExpires');

    if (!partimer) {
      return res.status(404).json({
        success: false,
        message: 'Partimer non trouvé'
      });
    }

    // Prepare public profile data
    const publicProfile = {
      id: partimer._id,
      nomComplet: partimer.firstName + ' ' + partimer.lastName,
      email: partimer.email,
      phone: partimer.phone,
      city: partimer.city,
      profilePicture: partimer.profilePicture,

      // Personal information
      dateOfBirth: partimer.dateOfBirth,
      age: partimer.dateOfBirth ?
        new Date().getFullYear() - partimer.dateOfBirth.getFullYear() : null,
      gender: partimer.gender,
      taille: partimer.taille,
      poids: partimer.poids,
      nationalite: partimer.nationalite,
      languages: partimer.languages,

      // Professional information
      bio: partimer.bio,
      skills: partimer.skills,
      experience: partimer.experience,
      education: partimer.education,
      availability: partimer.availability,

      // Ratings and stats
      rating: partimer.rating,
      completedMissions: partimer.completedMissions,
      profileCompletion: partimer.profileCompletion,

      // Additional partimer fields
      serviceCategories: partimer.serviceCategories,
      expertise: partimer.expertise,
      workPreference: partimer.availability,
      permisConduire: partimer.permisConduire,
      motorise: partimer.motorise
    };

    res.status(200).json({
      success: true,
      data: {
        partimer: publicProfile
      }
    });

  } catch (error) {
    console.error('Get partimer profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil',
      error: error.message
    });
  }
};

// ============================================================
// GET CURRENT PARTIMER PROFILE (Private)
// ============================================================
const getMyPartimerProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const partimer = await User.findOne({
      _id: userId,
      userType: 'partimer'
    }).select('-password -emailVerificationCode -passwordResetCode');

    if (!partimer) {
      return res.status(404).json({
        success: false,
        message: 'Profil Partimer non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        partimer
      }
    });

  } catch (error) {
    console.error('Get my partimer profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil',
      error: error.message
    });
  }
};

// ============================================================
// UPDATE PARTIMER PROFILE
// ============================================================
const updatePartimerProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fields that cannot be updated
    const restrictedFields = [
      'password', 'email', 'userType', 'emailVerified',
      'tokens', 'subscriptionPlan', 'rating', 'completedMissions'
    ];

    // Remove restricted fields
    restrictedFields.forEach(field => delete req.body[field]);

    const user = await User.findOneAndUpdate(
      { _id: userId, userType: 'partimer' },
      req.body,
      {
        new: true,
        runValidators: true
      }
    ).select('-password -emailVerificationCode -passwordResetCode');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Partimer non trouvé'
      });
    }

    // Check profile completion
    const isProfileComplete = checkPartimerProfileCompletion(user);

    res.status(200).json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: {
        user,
        profileCompleted: isProfileComplete
      }
    });

  } catch (error) {
    console.error('Update partimer profile error:', error);

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

// ============================================================
// SEARCH PARTIMERS
// ============================================================
const searchPartimers = async (req, res) => {
  try {
    const {
      city,
      serviceCategory,
      expertise,
      workPreference,
      minRating,
      languages,
      permisConduire,
      motorise,
      page = 1,
      limit = 12
    } = req.query;

    // Build query
    const query = {
      userType: 'partimer',
      active: true,
      emailVerified: true
    };

    // City filter
    if (city) {
      query.city = { $regex: city, $options: 'i' };
    }

    // Service category filter
    if (serviceCategory) {
      query['serviceCategories.category'] = serviceCategory;
    }

    // Expertise filter
    if (expertise) {
      query.expertise = { $in: [expertise] };
    }

    // Work preference filter
    if (workPreference) {
      query.availability = workPreference;
    }

    // Minimum rating filter
    if (minRating) {
      query['rating.average'] = { $gte: parseFloat(minRating) };
    }

    // Languages filter
    if (languages) {
      const langArray = Array.isArray(languages) ? languages : [languages];
      query['languages.language'] = { $in: langArray };
    }

    // Driving permit filter
    if (permisConduire) {
      query.permisConduire = { $in: [permisConduire] };
    }

    // Motorized filter
    if (motorise !== undefined) {
      query.motorise = motorise === 'true';
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const partimers = await User.find(query)
      .select('firstName lastName city profilePicture serviceCategories expertise rating completedMissions profileCompletion availability languages')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ 'rating.average': -1, profileCompletion: -1, completedMissions: -1 });

    const total = await User.countDocuments(query);

    // Format response
    const formattedPartimers = partimers.map(partimer => ({
      id: partimer._id,
      nomComplet: partimer.firstName + ' ' + partimer.lastName,
      firstName: partimer.firstName,
      lastName: partimer.lastName,
      city: partimer.city,
      profilePicture: partimer.profilePicture,
      serviceCategories: partimer.serviceCategories,
      expertise: partimer.expertise,
      rating: partimer.rating,
      completedMissions: partimer.completedMissions,
      profileCompletion: partimer.profileCompletion,
      availability: partimer.availability,
      languages: partimer.languages
    }));

    res.status(200).json({
      success: true,
      data: {
        partimers: formattedPartimers,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Search partimers error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche des partimers',
      error: error.message
    });
  }
};

// ============================================================
// GET PARTIMER DASHBOARD
// ============================================================
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
          profileViews: user.statistics?.profileViews || 0
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

// ============================================================
// UPLOAD PARTIMER DOCUMENTS
// ============================================================
const uploadPartimerDocuments = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier téléchargé'
      });
    }

    const user = await User.findById(userId);
    if (!user || user.userType !== 'partimer') {
      return res.status(404).json({
        success: false,
        message: 'Partimer non trouvé'
      });
    }

    const uploadedDocs = [];

    // Process CIN document
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
        url: req.files.cinDocumentPartimer[0].path,
        publicId: req.files.cinDocumentPartimer[0].filename
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
          url: file.path,
          publicId: file.filename
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
    console.error('Upload partimer documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement des documents',
      error: error.message
    });
  }
};

// ============================================================
// DELETE PARTIMER DOCUMENT
// ============================================================
const deletePartimerDocument = async (req, res) => {
  try {
    const { documentType } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user || user.userType !== 'partimer') {
      return res.status(404).json({
        success: false,
        message: 'Partimer non trouvé'
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
    console.error('Delete partimer document error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du document',
      error: error.message
    });
  }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

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
// UPLOAD PROFILE PICTURE
// ============================================
const uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucune photo téléchargée'
      });
    }

    const user = await User.findById(userId);
    if (!user || user.userType !== 'partimer') {
      return res.status(404).json({
        success: false,
        message: 'Partimer non trouvé'
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
      message: 'Photo de profil mise à jour avec succès',
      data: {
        profilePicture: user.profilePicture
      }
    });

  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement de la photo',
      error: error.message
    });
  }
}







// ============================================
// GET MY AVAILABILITY
// ============================================
const getMyAvailability = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('availabilitySlots lastAvailabilityUpdate');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Format the response to match frontend expectations
    const availability = {};
    user.availabilitySlots.forEach(slot => {
      const dateKey = slot.date.toISOString().split('T')[0]; // YYYY-MM-DD
      availability[dateKey] = slot.timeSlots.map(timeSlot =>
        `${timeSlot.start} - ${timeSlot.end}`
      );
    });

    console.log('Formatted availability response:', availability); // Debug log

    res.status(200).json({
      success: true,
      data: {
        availability, // This should now match frontend expectations
        lastUpdate: user.lastAvailabilityUpdate
      }
    });

  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des disponibilités',
      error: error.message
    });
  }
};

// ============================================
// UPDATE AVAILABILITY
// ============================================
const updateAvailability = async (req, res) => {
  try {
    const userId = req.user.id;
    const { availability } = req.body;

    console.log('Received availability update:', availability); // Debug log

    if (!availability || typeof availability !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Données de disponibilité invalides'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Convert availability object to array format for database
    const availabilitySlots = [];

    for (const [dateKey, timeSlots] of Object.entries(availability)) {
      const date = new Date(dateKey);

      if (isNaN(date.getTime())) {
        return res.status(400).json({
          success: false,
          message: `Date invalide: ${dateKey}`
        });
      }

      // Validate and format time slots
      const validatedTimeSlots = timeSlots.map(slot => {
        if (typeof slot === 'string') {
          const [start, end] = slot.split(' - ');
          return { start: start.trim(), end: end.trim() };
        }
        return slot;
      }).filter(slot => {
        // Validate time format and logic
        if (!slot.start || !slot.end) return false;

        const startMinutes = timeToMinutes(slot.start);
        const endMinutes = timeToMinutes(slot.end);
        return startMinutes < endMinutes;
      });

      if (validatedTimeSlots.length > 0) {
        availabilitySlots.push({
          date,
          timeSlots: validatedTimeSlots
        });
      }
    }

    // Update user's availability
    user.availabilitySlots = availabilitySlots;
    user.lastAvailabilityUpdate = new Date();

    await user.save();

    console.log('Updated availability slots:', user.availabilitySlots); // Debug log

    // Return the same format that was sent for consistency
    res.status(200).json({
      success: true,
      message: 'Disponibilités mises à jour avec succès',
      data: {
        availability: availability, // Return the same format
        lastUpdate: user.lastAvailabilityUpdate
      }
    });

  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des disponibilités',
      error: error.message
    });
  }
};

// ============================================
// DELETE AVAILABILITY DATE
// ============================================
const deleteAvailabilityDate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { date } = req.params;

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Date invalide'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Remove availability for the specific date
    user.availabilitySlots = user.availabilitySlots.filter(slot =>
      slot.date.toISOString().split('T')[0] !== date
    );

    user.lastAvailabilityUpdate = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Disponibilités supprimées pour cette date'
    });

  } catch (error) {
    console.error('Delete availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression des disponibilités',
      error: error.message
    });
  }
};

// ============================================
// GET PARTIMER AVAILABILITY (PUBLIC)
// ============================================
const getPartimerAvailability = async (req, res) => {
  try {
    const { partimerId } = req.params;

    const partimer = await User.findOne({
      _id: partimerId,
      userType: 'partimer',
      active: true
    }).select('availabilitySlots firstName lastName');

    if (!partimer) {
      return res.status(404).json({
        success: false,
        message: 'Partimer non trouvé'
      });
    }

    // Format availability for public view (next 30 days)
    const today = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);

    const publicAvailability = {};
    partimer.availabilitySlots
      .filter(slot => {
        const slotDate = new Date(slot.date);
        return slotDate >= today && slotDate <= thirtyDaysLater;
      })
      .forEach(slot => {
        const dateKey = slot.date.toISOString().split('T')[0];
        publicAvailability[dateKey] = slot.timeSlots.map(timeSlot =>
          `${timeSlot.start} - ${timeSlot.end}`
        );
      });

    res.status(200).json({
      success: true,
      data: {
        partimer: {
          id: partimer._id,
          name: `${partimer.firstName} ${partimer.lastName}`
        },
        availability: publicAvailability
      }
    });

  } catch (error) {
    console.error('Get partimer availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des disponibilités',
      error: error.message
    });
  }
};

// Helper function to convert time to minutes
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
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
};