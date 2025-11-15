// middleware/validation.js

const AppError = require('../utils/AppError');
const { cities } = require('../data/cities');
const { services } = require('../data/services');

// Validate mission creation/update data
exports.validateMission = (req, res, next) => {
  const { 
    title, 
    city, 
    serviceType, 
    description, 
    startDate, 
    endDate, 
    startTime,
    endTime,
    paymentType, 
    paymentAmount, 
    workType,
    addressInputType,
    address,
    latitude,
    longitude
  } = req.body;

  const errors = [];

  // Title validation
  if (!title || title.trim().length < 3) {
    errors.push('Title must be at least 3 characters long');
  }
  if (title && title.length > 100) {
    errors.push('Title cannot exceed 100 characters');
  }

  // City validation
  if (!city) {
    errors.push('City is required');
  }

  // Service type validation
  if (!serviceType) {
    errors.push('Service type is required');
  }

  // Description validation
  if (!description || description.trim().length < 50) {
    errors.push('Description must be at least 50 characters long');
  }
  if (description && description.length > 2000) {
    errors.push('Description cannot exceed 2000 characters');
  }

  // Date validation
  if (!startDate) {
    errors.push('Start date is required');
  }
  if (!endDate) {
    errors.push('End date is required');
  }
  
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime())) {
      errors.push('Invalid start date format');
    }
    if (isNaN(end.getTime())) {
      errors.push('Invalid end date format');
    }
    
    if (end < start) {
      errors.push('End date must be after start date');
    }
    
    // Check if start date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) {
      errors.push('Start date cannot be in the past');
    }
  }

  // Time validation
  if (!startTime) {
    errors.push('Start time is required');
  }
  if (!endTime) {
    errors.push('End time is required');
  }

  // Payment validation
  if (!paymentType) {
    errors.push('Payment type is required');
  }
  if (!['hourly', 'daily', 'fixed'].includes(paymentType)) {
    errors.push('Invalid payment type. Must be hourly, daily, or fixed');
  }
  if (!paymentAmount || paymentAmount <= 0) {
    errors.push('Payment amount must be greater than 0');
  }
  if (paymentAmount && paymentAmount > 1000000) {
    errors.push('Payment amount seems unrealistic');
  }

  // Work type validation
  if (!workType) {
    errors.push('Work type is required');
  }
  if (!['onsite', 'remote'].includes(workType)) {
    errors.push('Invalid work type. Must be onsite or remote');
  }

  // Address validation for onsite missions
  if (workType === 'onsite') {
    console.log("7na hna");
    
    // if (!addressInputType || !['manual', 'map'].includes(addressInputType)) {
    //   console.log("============");
    //   errors.push('Invalid address input type');
    // }
    // if (addressInputType === 'manual') {
    //   console.log("7na hna22");
    //   if (!address || address.trim().length < 10) {
    //     errors.push('Address must be at least 10 characters for onsite missions');
    //   }
    // }
    
    if (addressInputType === 'map') {
      if (!latitude || !longitude) {
        errors.push('Latitude and longitude are required when using map selection');
      }
      if (latitude && (latitude < -90 || latitude > 90)) {
        errors.push('Invalid latitude value');
      }
      if (longitude && (longitude < -180 || longitude > 180)) {
        errors.push('Invalid longitude value');
      }
    }
  }

  // If there are validation errors, return them
  if (errors.length > 0) {
    return next(new AppError(400, errors.join('. ')));
  }

  next();
};

// Validate application data
exports.validateApplication = (req, res, next) => {
  const { message } = req.body;

  const errors = [];

  if (message && message.length > 500) {
    errors.push('Application message cannot exceed 500 characters');
  }

  if (errors.length > 0) {
    return next(new AppError(400, errors.join('. ')));
  }

  next();
};

// Validate rating data
exports.validateRating = (req, res, next) => {
  const { score, comment } = req.body;

  const errors = [];

  if (!score) {
    errors.push('Rating score is required');
  }
  if (score && (score < 1 || score > 5)) {
    errors.push('Rating score must be between 1 and 5');
  }
  if (comment && comment.length > 500) {
    errors.push('Rating comment cannot exceed 500 characters');
  }

  if (errors.length > 0) {
    return next(new AppError(400, errors.join('. ')));
  }

  next();
};

// Sanitize input to prevent XSS
exports.sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove HTML tags and script tags
        obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        obj[key] = obj[key].replace(/<[^>]*>/g, '');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };

  if (req.body) sanitize(req.body);
  if (req.params) sanitize(req.params);
  if (req.query) sanitize(req.query);

  next();
};

module.exports = exports;