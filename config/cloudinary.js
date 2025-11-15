// config/cloudinary.js

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// ============================================
// CLOUDINARY CONFIGURATION
// ============================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// ============================================
// STORAGE CONFIGURATIONS
// ============================================

// Profile Photos Storage
const profilePhotoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const userType = req.user?.userType || 'user';
    const userId = req.user?.id || 'unknown';
    const timestamp = Date.now();

    return {
      folder: 'mijob/profiles', // Cloudinary folder
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [
        { width: 500, height: 500, crop: 'fill', gravity: 'face' },
        { quality: 'auto' },
        { fetch_format: 'auto' }
      ],
      public_id: `${userType}-${userId}-${timestamp}`, // Unique filename
    };
  },
});

// Company Logo Storage
const logoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const userId = req.user?.id || 'unknown';
    const timestamp = Date.now();

    return {
      folder: 'mijob/logos',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [
        { width: 300, height: 300, crop: 'fill' },
        { quality: 'auto' },
        { fetch_format: 'auto' }
      ],
      public_id: `company-${userId}-${timestamp}`,
    };
  },
});

// Documents Storage (CIN, Permits, etc.)
const documentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const userType = req.user?.userType || 'user';
    const userId = req.user?.id || 'unknown';
    const timestamp = Date.now();
    const fieldName = file.fieldname;

    return {
      folder: 'mijob/documents',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
      resource_type: 'auto', // Handles both images and PDFs
      public_id: `${fieldName}-${userType}-${userId}-${timestamp}`,
    };
  },
});

// Mission Images Storage
const missionImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const userId = req.user?.id || 'unknown';
    const timestamp = Date.now();

    return {
      folder: 'mijob/missions',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [
        { width: 1200, height: 800, crop: 'fill' },
        { quality: 'auto' },
        { fetch_format: 'auto' }
      ],
      public_id: `mission-${userId}-${timestamp}`,
    };
  },
});

// ============================================
// FILE FILTERS
// ============================================

// Image only filter
const imageFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG and WebP images are allowed.'), false);
  }
};

// Document filter (images + PDFs)
const documentFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WebP and PDF files are allowed.'), false);
  }
};

// ============================================
// MULTER UPLOADS
// ============================================

// Profile Photo Upload
const uploadProfilePhoto = multer({
  storage: profilePhotoStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  }
});

// Company Logo Upload
const uploadLogo = multer({
  storage: logoStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  }
});

// Document Upload
const uploadDocument = multer({
  storage: documentStorage,
  fileFilter: documentFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for documents
  }
});

// Mission Image Upload
const uploadMissionImage = multer({
  storage: missionImageStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  }
});

// Multiple files upload (for documents with multiple files)
const uploadMultipleDocuments = multer({
  storage: documentStorage,
  fileFilter: documentFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5 // Maximum 5 files
  }
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum file size is 5MB for images and 10MB for documents.'
      });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 5 files allowed.'
      });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field name in upload.'
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error'
    });
  }

  next();
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Delete file from Cloudinary
 * @param {string} publicId - The public ID of the file in Cloudinary
 * @param {string} resourceType - 'image' or 'raw' (for PDFs)
 */
const deleteFile = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    return result;
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error);
    throw error;
  }
};

/**
 * Delete multiple files from Cloudinary
 * @param {Array<string>} publicIds - Array of public IDs
 * @param {string} resourceType - 'image' or 'raw'
 */
const deleteMultipleFiles = async (publicIds, resourceType = 'image') => {
  try {
    const result = await cloudinary.api.delete_resources(publicIds, {
      resource_type: resourceType
    });
    return result;
  } catch (error) {
    console.error('Error deleting multiple files:', error);
    throw error;
  }
};

/**
 * Extract public ID from Cloudinary URL
 * @param {string} url - Full Cloudinary URL
 * @returns {string} - Public ID
 */
const extractPublicId = (url) => {
  if (!url) return null;

  // Extract public ID from Cloudinary URL
  // Example: https://res.cloudinary.com/cloud-name/image/upload/v1234567890/folder/file.jpg
  const parts = url.split('/');
  const uploadIndex = parts.indexOf('upload');

  if (uploadIndex === -1) return null;

  // Get everything after 'upload' and version number
  const pathParts = parts.slice(uploadIndex + 2);
  const publicIdWithExtension = pathParts.join('/');

  // Remove file extension
  const publicId = publicIdWithExtension.replace(/\.[^/.]+$/, '');

  return publicId;
};

/**
 * Get optimized image URL
 * @param {string} publicId - Public ID of the image
 * @param {Object} options - Transformation options
 */
const getOptimizedUrl = (publicId, options = {}) => {
  const {
    width = 'auto',
    height = 'auto',
    crop = 'fill',
    quality = 'auto',
    format = 'auto'
  } = options;

  return cloudinary.url(publicId, {
    width,
    height,
    crop,
    quality,
    fetch_format: format,
    secure: true
  });
};


// Add this AFTER the existing storage configurations and BEFORE the file filters

// ============================================
// MIXED STORAGE (For Registration - No Auth Required)
// ============================================

// This storage handles both profile photos and documents for registration
const registrationStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const timestamp = Date.now();
    const fieldName = file.fieldname;
    const randomString = Math.random().toString(36).substring(7);

    // Determine folder and transformations based on field name
    if (fieldName === 'photoProfil') {
      return {
        folder: 'mijob/profiles',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
          { width: 500, height: 500, crop: 'fill', gravity: 'face' },
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ],
        public_id: `partimer-temp-${timestamp}-${randomString}`,
      };
    } else {
      // For documents (cinFile, permisFile, autreDoc)
      return {
        folder: 'mijob/documents',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
        resource_type: 'auto',
        public_id: `${fieldName}-temp-${timestamp}-${randomString}`,
      };
    }
  },
});

// Multiple files upload for registration (no auth required)
const uploadRegistrationFiles = multer({
  storage: registrationStorage,
  fileFilter: documentFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10 // Maximum 10 files total
  }
});

// ============================================
// EXPORTS
// ============================================
module.exports = {
  cloudinary,
  uploadProfilePhoto,
  uploadLogo,
  uploadDocument,
  uploadMissionImage,
  uploadMultipleDocuments,
  handleMulterError,
  deleteFile,
  deleteMultipleFiles,
  extractPublicId,
  getOptimizedUrl,
  uploadRegistrationFiles, 
};