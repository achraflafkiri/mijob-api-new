const mongoose = require('mongoose');

const missionSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Mission title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },

  description: {
    type: String,
    required: [true, 'Mission description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },

  // Location
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true
  },

  neighborhood: {
    type: String,
    trim: true
  },

  // Service Type
  serviceType: {
    type: String,
    // required: [true, 'Service type is required']
  },

  serviceCategory: {
    type: String,
    trim: true
  },

  serviceSubcategory: {
    type: String,
    trim: true
  },

  // Date and Time
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },

  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    validate: {
      validator: function (value) {
        return value >= this.startDate;
      },
      message: 'End date must be after or equal to start date'
    }
  },

  startTime: {
    type: String,
    required: [true, 'Start time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
  },

  endTime: {
    type: String,
    required: [true, 'End time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
  },

  // Compensation
  paymentType: {
    type: String,
    enum: ['hourly', 'daily', 'flat'],
    required: [true, 'Payment type is required']
  },

  hourlyRate: {
    type: Number,
    min: [0, 'Hourly rate cannot be negative']
  },

  dailyRate: {
    type: Number,
    min: [0, 'Daily rate cannot be negative']
  },

  flatRate: {
    type: Number,
    min: [0, 'Flat rate cannot be negative']
  },

  salary: {
    type: Number,
    required: [true, 'Salary is required'],
    min: [0, 'Salary cannot be negative']
  },

  currency: {
    type: String,
    default: 'MAD'
  },

  // Work Type
  workType: {
    type: String,
    enum: ['onsite', 'remote'],
    required: [true, 'Work type is required']
  },

  // Address (for onsite missions)
  address: {
    type: String,
    trim: true
  },

  addressInputType: {
    type: String,
    enum: ['manual', 'map']
  },

  // Location Coordinates
  // location: {
  //   type: {
  //     type: String,
  //     enum: ['Point'],
  //     default: 'Point'
  //   },
  //   coordinates: {
  //     type: [Number], // [longitude, latitude]
  //     index: '2dsphere'
  //   }
  // },

  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere',
      default: undefined // Important: don't set default to empty array
    }
  },

  // latitude: {
  //   type: Number,
  //   min: [-90, 'Invalid latitude'],
  //   max: [90, 'Invalid latitude']
  // },

  // longitude: {
  //   type: Number,
  //   min: [-180, 'Invalid longitude'],
  //   max: [180, 'Invalid longitude']
  // },

  latitude: {
    type: Number,
    min: [-90, 'Invalid latitude'],
    max: [90, 'Invalid latitude']
  },

  longitude: {
    type: Number,
    min: [-180, 'Invalid longitude'],
    max: [180, 'Invalid longitude']
  },


  // Requirements
  requirements: {
    age: {
      type: String,
      enum: [
        '',
        '18-24-years',
        '25-34-years',
        '35-44-years',
        '45-54-years',
        '55-64-years',
        '65-years-and-over'
      ]
    },

    gender: {
      type: String,
      enum: ['', 'female', 'male']
    },

    educationLevel: {
      type: String,
      enum: [
        '',
        'high-school-level',
        'associate-degree',
        'bachelors-degree',
        'masters-degree-or-higher'
      ]
    },

    fieldOfStudy: {
      type: String,
      trim: true
    },

    languages: [{
      type: String,
      trim: true
    }],

    motorized: {
      type: String,
      trim: true
    },

    drivingLicense: {
      type: String,
      enum: ['', 'AM', 'A1', 'A2', 'A', 'B', 'C', 'D', 'E', 'Professionnel']
    }
  },

  // Featured Listing (for particulier)
  featuredListing: {
    type: Boolean,
    default: false
  },

  // Token Cost (for particulier)
  tokenCost: {
    basePublication: {
      type: Number,
      default: 10
    },
    featuredListingCost: {
      type: Number,
      default: 5
    },
    total: {
      type: Number,
      default: 10
    }
  },

  // Mission Creator
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Mission creator is required']
  },

  creatorType: {
    type: String,
    enum: ['particulier', 'entreprise'],
    required: [true, 'Creator type is required']
  },

  // Mission Status
  status: {
    type: String,
    enum: ['draft', 'published', 'in-progress', 'completed', 'cancelled', 'expired'],
    default: 'published'
  },

  // Applications
  applications: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application'
  }],

  applicationCount: {
    type: Number,
    default: 0
  },

  // Selected Worker (if hired)
  selectedWorker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Views and Engagement
  views: {
    type: Number,
    default: 0
  },

  // Expiration
  expiresAt: {
    type: Date
  },

  // Publication Date
  publishedAt: {
    type: Date,
    default: Date.now
  },

  // Flags
  isActive: {
    type: Boolean,
    default: true
  },

  isFeatured: {
    type: Boolean,
    default: false
  },

  isUrgent: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
missionSchema.index({ city: 1, serviceType: 1 });
missionSchema.index({ createdBy: 1, status: 1 });
missionSchema.index({ startDate: 1, endDate: 1 });
missionSchema.index({ publishedAt: -1 });
missionSchema.index({ featuredListing: -1, publishedAt: -1 });
missionSchema.index({ location: '2dsphere' });

// Virtual for duration
missionSchema.virtual('duration').get(function () {
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(this.endDate - this.startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return 0;
});

// Pre-save middleware to set location coordinates - FIXED VERSION
missionSchema.pre('save', function(next) {
  // Only set location if we have both latitude and longitude
  if (this.latitude != null && this.longitude != null) {
    this.location = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude] // Note: MongoDB uses [longitude, latitude]
    };
  } else {
    // If no coordinates, ensure location is undefined, not an incomplete object
    this.location = undefined;
  }
  next();
});

// Virtual for formatted salary
missionSchema.virtual('formattedSalary').get(function () {
  const rate = this.hourlyRate || this.dailyRate || this.flatRate || this.salary;
  const type = this.paymentType === 'hourly' ? '/hour' :
    this.paymentType === 'daily' ? '/day' : '';
  return `${rate} ${this.currency}${type}`;
});

// Pre-save middleware to calculate total token cost
missionSchema.pre('save', function (next) {
  if (this.creatorType === 'particulier') {
    const basePublication = 10;
    const featuredCost = this.featuredListing ? 5 : 0;
    this.tokenCost.total = basePublication + featuredCost;
  }
  next();
});

// Pre-save middleware to set location coordinates
missionSchema.pre('save', function (next) {
  if (this.latitude && this.longitude) {
    this.location = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude]
    };
  }
  next();
});

// Pre-save middleware to set expiration date (30 days from publication)
missionSchema.pre('save', function (next) {
  if (!this.expiresAt && this.publishedAt) {
    const expirationDate = new Date(this.publishedAt);
    expirationDate.setDate(expirationDate.getDate() + 30);
    this.expiresAt = expirationDate;
  }
  next();
});

// Method to check if mission is expired
missionSchema.methods.isExpired = function () {
  return this.expiresAt && new Date() > this.expiresAt;
};

// Method to increment views
missionSchema.methods.incrementViews = async function () {
  this.views += 1;
  await this.save();
};

// Method to check if requirements are filled
missionSchema.methods.hasRequirements = function () {
  const req = this.requirements;
  return req.age || req.gender || req.educationLevel ||
    req.fieldOfStudy || (req.languages && req.languages.length > 0) ||
    req.motorized || req.drivingLicense;
};

// Static method to find missions by location (within radius in km)
missionSchema.statics.findByLocation = function (longitude, latitude, radiusInKm) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: radiusInKm * 1000 // Convert km to meters
      }
    }
  });
};

// Static method to find active missions
missionSchema.statics.findActive = function () {
  return this.find({
    status: 'published',
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).sort({ featuredListing: -1, publishedAt: -1 });
};

const Mission = mongoose.model('Mission', missionSchema);

module.exports = Mission;