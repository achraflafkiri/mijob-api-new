const { deleteFile } = require('../config/cloudinary');

/**
 * Clean up uploaded files from Cloudinary if registration fails
 */
const cleanupCloudinaryFiles = async (files) => {
  if (!files) return;

  try {
    if (Array.isArray(files)) {
      for (const file of files) {
        if (file && file.path) {
          const publicId = extractPublicId(file.path);
          if (publicId) {
            await deleteFile(publicId, 'image');
          }
        }
      }
    } else if (typeof files === 'object') {
      // Handle fields structure
      for (const fieldName in files) {
        if (Array.isArray(files[fieldName])) {
          for (const file of files[fieldName]) {
            if (file && file.path) {
              const publicId = extractPublicId(file.path);
              if (publicId) {
                await deleteFile(publicId, 'image');
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Error cleaning up Cloudinary files:', error);
  }
};

module.exports = { cleanupCloudinaryFiles };