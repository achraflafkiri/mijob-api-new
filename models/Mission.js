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

  // Service Category and Subcategory (from PDF)
  serviceCategory: {
    type: String,
    required: [true, 'Service category is required'],
    enum: [
      'home-services',
      'education-training',
      'animals',
      'administrative-digital',
      'hospitality-restaurant',
      'retail-sales',
      'logistics-delivery',
      'events-entertainment',
      'remote-services',
    ],
    trim: true
  },

  serviceSubcategory: {
    type: [String],
    required: [true, 'At least one service subcategory is required'],
    validate: {
      validator: function (v) {
        return Array.isArray(v) && v.length > 0;
      },
      message: 'Please select at least one subcategory'
    }
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
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere',
      default: undefined
    }
  },

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

  // Requirements (FIXED TO MATCH PDF)
  requirements: {
    // Âge: 18-25, 25-34, 34-44, 45-54, 55-64, 65 et +
    age: {
      type: String,
      enum: [
        '',
        '18-25',
        '25-34',
        '34-44',
        '45-54',
        '55-64',
        '65-et-plus'
      ]
    },

    // Genre: Homme, Femme
    gender: {
      type: String,
      enum: ['', 'homme', 'femme']
    },

    // Statut: Retraité, Salarié, Étudiant, Femme au foyer, Inactif
    status: {
      type: String,
      enum: ['', 'retired', 'employee', 'student', 'housewife', 'inactive']
    },

    // Nationalité: Marocaine, Étrangère, Double nationalité
    nationality: {
      type: String,
      enum: ['', 'marocaine', 'etrangere', 'double']
    },

    // Taille: 150-160, 161-170, 171-180, 181-190
    height: {
      type: String,
      enum: ["", "150 cm - 160", "161 cm - 170", "171 cm - 180", "181 cm - 190"]
    },

    // Poids: 40-55, 56-70, 71-85, 86-100, 100+
    weight: {
      type: String,
      enum: ["", '40 kg - 55 kg', '56 kg - 70 kg', '71 kg - 85 kg', '86 kg - 100 kg', '+100 kg']
    },

    // Préférence de travail: Sur site, À distance, Les deux
    workPreference: {
      type: String,
      enum: ["", "Sur site", "À distance", "Les deux"]
    },

    // Niveau d'études: Primaire, Collège, Lycée, Formation professionnelle, Licence, Master, Doctorat
    educationLevel: {
      type: String,
      enum: [
        '',
        'primaire',
        'college',
        'lycee',
        'formation-professionnelle',
        'licence',
        'master',
        'doctorat'
      ]
    },

    // Domaine d'étude (all 25 options from PDF)
    fieldOfStudy: {
      type: String,
      enum: [
        'education',
        'ingenierie',
        'medecine_sante',
        'commerce_gestion',
        'arts_design',
        'arts_culinaires',
        'plomberie_metiers_techniques',
        'informatique_programmation',
        'marketing_communication',
        'finance_comptabilite',
        'droit_sciences_politiques',
        'psychologie_sciences_sociales',
        'langues_traduction',
        'architecture_urbanisme',
        'agriculture_environnement',
        'tourisme_hotellerie',
        'transport_logistique',
        'audiovisuel_cinema',
        'mode_stylisme',
        'beaute_esthetique',
        'sport_coaching',
        'sciences_fondamentales',
        'ressources_humaines',
        'developpement_personnel_coaching',
        'autre',
      ]
    },

    // Langues (multiple selection from PDF list)
    languages: [{
      type: String,
    }],

    // Transport: Tous, Voiture, Moto, Vélo/Trottinette électrique, Autre
    transportType: {
      type: String,
      enum: [
        '',
        'all',
        'car',
        'motorcycle',
        'bike_scooter',
        'other',
      ]
    },

    // Permis de conduire: AM, A1, A, B, C, D, EB, EC, ED
    drivingLicense: {
      type: String,
      enum: ['', 'Permis AM',
        'Permis A1',
        'Permis A',
        'Permis B',
        'Permis C',
        'Permis D',
        'Permis EB',
        'Permis EC',
        'Permis ED']
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
missionSchema.index({ serviceCategory: 1 });
missionSchema.index({ serviceSubcategory: 1 });
missionSchema.index({ serviceCategory: 1, serviceSubcategory: 1 });

// Virtual for duration
missionSchema.virtual('duration').get(function () {
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(this.endDate - this.startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return 0;
});

// Pre-save middleware to set location coordinates
missionSchema.pre('save', function (next) {
  if (this.latitude != null && this.longitude != null) {
    this.location = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude]
    };
  } else {
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
  return req.age || req.gender || req.status || req.nationality ||
    req.height || req.weight || req.workPreference || req.educationLevel ||
    req.fieldOfStudy || (req.languages && req.languages.length > 0) ||
    req.transportType || req.drivingLicense;
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
        $maxDistance: radiusInKm * 1000
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