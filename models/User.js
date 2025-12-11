// models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const userSchema = new mongoose.Schema({
  // ============================================================
  // AUTHENTICATION & BASIC INFO
  // ============================================================

  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: [validator.isEmail, 'Please provide a valid email']
  },

  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },

  userType: {
    type: String,
    enum: ['partimer', 'entreprise', 'particulier'],
    required: [true, 'User type is required']
  },

  // ============================================================
  // EMAIL VERIFICATION
  // ============================================================

  emailVerified: {
    type: Boolean,
    default: false
  },

  emailVerificationCode: {
    type: String,
    select: false
  },

  emailVerificationExpires: {
    type: Date,
    select: false
  },

  // ============================================================
  // PASSWORD RESET
  // ============================================================

  passwordResetCode: {
    type: String,
    select: false
  },

  passwordResetExpires: {
    type: Date,
    select: false
  },

  passwordChangedAt: {
    type: Date,
    select: false
  },

  // ============================================================
  // COMMON USER FIELDS
  // ============================================================

  phone: {
    type: String,
    trim: true
  },

  profilePicture: {
    type: String,
    default: null
  },

  active: {
    type: Boolean,
    default: true,
    select: false
  },

  lastLogin: {
    type: Date
  },

  // ============================================================
  // PARTIMER SPECIFIC FIELDS
  // ============================================================

  firstName: {
    type: String,
    trim: true,
    required: function () {
      return this.userType === 'partimer';
    }
  },

  lastName: {
    type: String,
    trim: true,
    // required: function () {
    //   return this.userType === 'partimer';
    // }
  },

  dateOfBirth: {
    type: Date,
    validate: {
      validator: function (value) {
        if (this.userType !== 'partimer') return true;
        if (!value) return true;
        const age = (new Date() - new Date(value)) / (365.25 * 24 * 60 * 60 * 1000);
        return age >= 18;
      },
      message: 'You must be at least 18 years old'
    }
  },

  gender: {
    type: String,
    enum: ['male', 'female', 'other', null],
    default: null
  },

  city: {
    type: String,
    trim: true
  },

  address: {
    type: String,
    trim: true
  },

  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },

  skills: [{
    type: String,
    trim: true
  }],

  experience: [{
    company: String,
    position: String,
    startDate: Date,
    endDate: Date,
    description: String,
    current: {
      type: Boolean,
      default: false
    }
  }],

  education: [{
    institution: String,
    degree: String,
    field: String,
    startDate: Date,
    endDate: Date,
    current: {
      type: Boolean,
      default: false
    }
  }],

  languages: [{
    language: String,
    level: {
      type: String,
      enum: ['basic', 'intermediate', 'advanced', 'native']
    }
  }],

  availability: {
    type: String,
    enum: ['full-time', 'part-time', 'weekends', 'flexible', null, 'remote'],
    default: null
  },

  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },

  completedMissions: {
    type: Number,
    default: 0
  },

  // Personal Information (from frontend)
  taille: {
    type: String,
    enum: ['150 cm - 160', '161 cm - 170', '171 cm - 180', '181 cm - 190', null],
    default: null
  },

  poids: {
    type: String,
    enum: ['40 kg - 55 kg', '56 kg - 70 kg', '71 kg - 85 kg', '86 kg - 100 kg', '+100 kg', null],
    default: null
  },

  nationalite: {
    type: String,
    // enum: ['Marocaine', 'Étrangère', 'Double nationalité', 'Autre', null],
    default: null
  },

  // Service categories (missions)
  serviceCategories: [{
    type: String,
    trim: true
  }],

  // Work preference
  preferenceTravail: {
    type: String,
    enum: ['Sur site', 'À distance', 'Les deux', null],
    default: null
  },

  // Health information
  problemeSanteChronique: {
    type: String,
    trim: true
  },

  limitationsPhysiques: [{
    type: String,
    trim: true
  }],

  // Professional information
  motivationPartTime: [{
    type: String,
    trim: true
  }],

  raisonTravailAutre: {
    type: String,
    trim: true
  },

  traitsPersonnalite: [{
    type: String,
    trim: true
  }],

  experiencesAnterieures: {
    type: String,
    trim: true
  },

  niveauEtudes: {
    type: String,
    enum: ['Primaire', 'Collège', 'Lycée', 'Formation professionnelle', 'Licence', 'Master', 'Doctorat', null],
    default: null
  },

  domaineEtudes: {
    type: String,
    trim: true
  },

  // Transport
  permisConduire: [{
    type: String,
    trim: true
  }],

  motorise: {
    type: Boolean,
    default: false
  },

  moyensTransport: [{
    type: String,
    trim: true
  }],

  transportAutre: {
    type: String,
    trim: true
  },

  // Documents
  cinDocumentPartimer: {
    type: String,
    default: null
  },

  permisDocuments: [{
    type: String
  }],

  autreDocument: {
    type: String,
    default: null
  },

  // ============================================================
  // AVAILABILITY MANAGEMENT (NEW - For Calendar System)
  // ============================================================

  // Specific date-based availability slots
  availabilitySlots: [{
    date: {
      type: Date,
      required: true,
      index: true
    },
    timeSlots: [{
      start: {
        type: String,
        required: true,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
      },
      end: {
        type: String,
        required: true,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
      },
      _id: false
    }],
    createdAt: {
      type: Date,
      default: Date.now
    },
    _id: false
  }],

  // Time preferences for quick scheduling
  timePreferences: {
    preferredStartTime: {
      type: String,
      default: '09:00',
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    },
    preferredEndTime: {
      type: String,
      default: '17:00',
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    },
    minimumMissionDuration: {
      type: Number, // in minutes
      default: 60,
      min: 15
    },
    maximumMissionDuration: {
      type: Number, // in minutes
      default: 480,
      max: 1440
    },
    breakBetweenMissions: {
      type: Number, // in minutes
      default: 30,
      min: 0
    }
  },

  // Vacation periods (unavailable dates)
  vacationPeriods: [{
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    reason: {
      type: String,
      maxlength: 200,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    _id: false
  }],

  // Date-specific exceptions (custom hours or unavailable)
  dateExceptions: [{
    date: {
      type: Date,
      required: true
    },
    type: {
      type: String,
      enum: ['unavailable', 'custom_hours'],
      required: true
    },
    customHours: [{
      start: String,
      end: String,
      _id: false
    }],
    reason: {
      type: String,
      maxlength: 200,
      trim: true
    },
    _id: false
  }],

  // Weekly schedule pattern (recurring availability)
  weeklySchedule: {
    monday: [{
      start: String,
      end: String,
      available: {
        type: Boolean,
        default: true
      },
      _id: false
    }],
    tuesday: [{
      start: String,
      end: String,
      available: {
        type: Boolean,
        default: true
      },
      _id: false
    }],
    wednesday: [{
      start: String,
      end: String,
      available: {
        type: Boolean,
        default: true
      },
      _id: false
    }],
    thursday: [{
      start: String,
      end: String,
      available: {
        type: Boolean,
        default: true
      },
      _id: false
    }],
    friday: [{
      start: String,
      end: String,
      available: {
        type: Boolean,
        default: true
      },
      _id: false
    }],
    saturday: [{
      start: String,
      end: String,
      available: {
        type: Boolean,
        default: true
      },
      _id: false
    }],
    sunday: [{
      start: String,
      end: String,
      available: {
        type: Boolean,
        default: true
      },
      _id: false
    }]
  },

  // Response time for booking requests (in minutes)
  averageResponseTime: {
    type: Number,
    default: 120
  },

  // Instant booking enabled
  instantBookingEnabled: {
    type: Boolean,
    default: false
  },

  // Advance booking settings
  advanceBooking: {
    minimumNotice: {
      type: Number, // in hours
      default: 24,
      min: 1
    },
    maximumAdvance: {
      type: Number, // in days
      default: 90,
      max: 365
    }
  },

  // Last availability update
  lastAvailabilityUpdate: {
    type: Date,
    default: Date.now
  },

  // Recurring availability patterns
  recurringPatterns: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: Date,
    schedule: {
      monday: [{ start: String, end: String, _id: false }],
      tuesday: [{ start: String, end: String, _id: false }],
      wednesday: [{ start: String, end: String, _id: false }],
      thursday: [{ start: String, end: String, _id: false }],
      friday: [{ start: String, end: String, _id: false }],
      saturday: [{ start: String, end: String, _id: false }],
      sunday: [{ start: String, end: String, _id: false }]
    },
    active: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    _id: false
  }],

  // ============================================================
  // ENTREPRISE SPECIFIC FIELDS
  // ============================================================

  raisonSociale: {
    type: String,
    trim: true,
    required: function () {
      return this.userType === 'entreprise';
    }
  },

  entrepriseName: {
    type: String,
    trim: true
  },

  ville: {
    type: String,
    trim: true
  },

  telephone: {
    type: String,
    trim: true
  },

  siegeSocial: {
    type: String,
    trim: true,
    required: function () {
      return this.userType === 'entreprise';
    }
  },

  secteurActivite: {
    type: String,
    trim: true,
    required: function () {
      return this.userType === 'entreprise';
    }
  },

  industry: {
    type: String,
    trim: true
  },

  tailleEntreprise: {
    type: String,
    enum: [
      '1-10 employés',
      '11-50 employés',
      '51-200 employés',
      '201-500 employés',
      '500+ employés',
      null
    ],
    required: function () {
      return this.userType === 'entreprise';
    }
  },

  companySize: {
    type: String,
    enum: ['1-10', '11-50', '51-200', '201-500', '500+', null],
    default: null
  },

  raisonRecrutement: {
    type: String,
    trim: true,
    required: function () {
      return this.userType === 'entreprise';
    },
    minlength: [10, 'Raison de recrutement must be at least 10 characters']
  },

  companyDescription: {
    type: String,
    maxlength: [1000, 'Company description cannot exceed 1000 characters']
  },

  companyWebsite: {
    type: String,
    trim: true,
    validate: {
      validator: function (value) {
        if (!value) return true;
        return validator.isURL(value);
      },
      message: 'Please provide a valid URL'
    }
  },

  companyAddress: {
    type: String,
    trim: true
  },

  companyCity: {
    type: String,
    trim: true
  },

  companyLogo: {
    type: String,
    default: null
  },

  // ============================================================
  // PARTICULIER SPECIFIC FIELDS
  // ============================================================

  nomComplet: {
    type: String,
    trim: true,
    required: function () {
      return this.userType === 'particulier';
    }
  },

  cin: {
    type: String,
    trim: true,
    required: function () {
      return this.userType === 'particulier';
    }
  },

  cinFile: {
    type: String,
    default: null
  },

  // ============================================================
  // SUBSCRIPTION & TOKENS
  // ============================================================

  subscriptionPlan: {
    type: String,
    enum: ['none', 'basic', 'standard', 'premium'],
    default: 'none'
  },

  subscriptionStartDate: {
    type: Date
  },

  subscriptionEndDate: {
    type: Date
  },

  tokens: {
    available: {
      type: Number,
      default: function () {
        return this.userType !== 'partimer' ? 0 : 0;
      }
    },
    used: {
      type: Number,
      default: 0
    },
    purchased: {
      type: Number,
      default: 0
    }
  },

  // ============================================================
  // STATISTICS
  // ============================================================

  statistics: {
    profileViews: {
      type: Number,
      default: 0
    },
    missionsPosted: {
      type: Number,
      default: 0
    },
    missionsCompleted: {
      type: Number,
      default: 0
    },
    availabilityViews: {
      type: Number,
      default: 0
    },
    bookingRequests: {
      type: Number,
      default: 0
    }
  },

  // ============================================================
  // PROFILE COMPLETION
  // ============================================================

  profileCompletion: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  // ============================================================
  // PREFERENCES
  // ============================================================

  preferences: {
    language: {
      type: String,
      enum: ['fr', 'en', 'ar'],
      default: 'fr'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      bookingRequests: {
        type: Boolean,
        default: true
      },
      availabilityReminders: {
        type: Boolean,
        default: true
      }
    },
    availability: {
      autoDeclineConflicts: {
        type: Boolean,
        default: true
      },
      showExactTimes: {
        type: Boolean,
        default: true
      },
      allowOverlappingBookings: {
        type: Boolean,
        default: false
      }
    }
  },

  // ============================================================
  // ONLINE STATUS & CONNECTION
  // ============================================================

  lastSeen: {
    type: Date,
    default: Date.now
  },

  isOnline: {
    type: Boolean,
    default: false
  },

  socketId: {
    type: String,
    default: null
  },

  deviceInfo: {
    type: String,
    default: null
  },

  // ============================================================
  // PRIVACY SETTINGS
  // ============================================================

  privacy: {
    showOnlineStatus: {
      type: Boolean,
      default: true
    },
    showLastSeen: {
      type: Boolean,
      default: true
    }
  },

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================================
// INDEXES
// ============================================================

userSchema.index({ email: 1 });
userSchema.index({ userType: 1 });
userSchema.index({ city: 1 });
userSchema.index({ ville: 1 });
userSchema.index({ 'rating.average': -1 });
userSchema.index({ emailVerified: 1, active: 1 });
userSchema.index({ 'availabilitySlots.date': 1 });
userSchema.index({ 'weeklySchedule.monday.start': 1 });
userSchema.index({ 'vacationPeriods.startDate': 1, 'vacationPeriods.endDate': 1 });
userSchema.index({ 'dateExceptions.date': 1 });
userSchema.index({ lastAvailabilityUpdate: -1 });

// ============================================================
// VIRTUAL FIELDS
// ============================================================

userSchema.virtual('fullName').get(function () {
  if (this.userType === 'partimer') {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }
    if (this.firstName) {
      return this.firstName;
    }
  }

  if (this.userType === 'particulier' && this.nomComplet) {
    return this.nomComplet;
  }

  if (this.userType === 'entreprise') {
    return this.raisonSociale || this.entrepriseName;
  }

  return this.nomComplet || this.email;
});

// Virtual for age calculation
userSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
});

// Virtual for upcoming availability
userSchema.virtual('upcomingAvailability').get(function () {
  if (this.userType !== 'partimer') return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return this.availabilitySlots
    .filter(slot => slot.date >= today)
    .sort((a, b) => a.date - b.date)
    .slice(0, 10); // Next 10 available dates
});

// ============================================================
// MIDDLEWARE
// ============================================================

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Update lastAvailabilityUpdate when availability changes
userSchema.pre('save', function (next) {
  if (this.isModified('availabilitySlots') ||
    this.isModified('vacationPeriods') ||
    this.isModified('dateExceptions') ||
    this.isModified('weeklySchedule')) {
    this.lastAvailabilityUpdate = new Date();
  }
  next();
});

// Sync fields before saving
userSchema.pre('save', function (next) {
  // Auto-generate nomComplet for partimer
  if (this.userType === 'partimer') {
    if (this.firstName && this.lastName) {
      this.nomComplet = `${this.firstName} ${this.lastName}`;
    } else if (this.firstName) {
      this.nomComplet = this.firstName;
    }
  }

  // Sync entreprise fields
  if (this.userType === 'entreprise') {
    if (this.raisonSociale && !this.entrepriseName) {
      this.entrepriseName = this.raisonSociale;
    }
    if (this.secteurActivite && !this.industry) {
      this.industry = this.secteurActivite;
    }
    if (this.ville && !this.city) {
      this.city = this.ville;
    }
    if (this.telephone && !this.phone) {
      this.phone = this.telephone;
    }
    if (this.siegeSocial && !this.companyAddress) {
      this.companyAddress = this.siegeSocial;
    }
  }

  // Sync particulier fields
  if (this.userType === 'particulier') {
    if (this.nomComplet && (!this.firstName || !this.lastName)) {
      const names = this.nomComplet.split(' ');
      this.firstName = names[0];
      this.lastName = names.slice(1).join(' ') || names[0];
    }
    if (this.ville && !this.city) {
      this.city = this.ville;
    }
    if (this.telephone && !this.phone) {
      this.phone = this.telephone;
    }
  }

  next();
});

// ============================================================
// INSTANCE METHODS
// ============================================================

// Check if password is correct
userSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Check if password was changed after JWT was issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Get available time slots for a specific date
userSchema.methods.getAvailableSlotsForDate = function (date) {
  if (this.userType !== 'partimer') return [];

  // Check if date is in vacation periods
  const isOnVacation = this.vacationPeriods.some(vacation => {
    return date >= vacation.startDate && date <= vacation.endDate;
  });
  if (isOnVacation) return [];

  // Check for date-specific exceptions
  const dateException = this.dateExceptions.find(exc =>
    exc.date.toDateString() === date.toDateString()
  );

  if (dateException) {
    if (dateException.type === 'unavailable') return [];
    if (dateException.type === 'custom_hours') {
      return dateException.customHours.filter(slot => slot.start && slot.end);
    }
  }

  // Check for specific availability slots
  const specificSlot = this.availabilitySlots.find(slot =>
    slot.date.toDateString() === date.toDateString()
  );

  if (specificSlot) {
    return specificSlot.timeSlots.filter(slot => slot.start && slot.end);
  }

  // Fall back to weekly schedule
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()];
  const daySchedule = this.weeklySchedule[dayName] || [];

  const availableSlots = daySchedule
    .filter(slot => slot.available && slot.start && slot.end)
    .map(slot => ({ start: slot.start, end: slot.end }));

  return availableSlots;
};

// Add availability for specific date
userSchema.methods.addAvailability = function (date, timeSlots) {
  if (this.userType !== 'partimer') return this;

  // Remove existing slots for this date
  this.availabilitySlots = this.availabilitySlots.filter(
    slot => slot.date.toDateString() !== date.toDateString()
  );

  // Add new slots
  if (timeSlots && timeSlots.length > 0) {
    this.availabilitySlots.push({
      date: new Date(date),
      timeSlots: timeSlots.map(slot => ({
        start: slot.start,
        end: slot.end
      }))
    });
  }

  this.lastAvailabilityUpdate = new Date();
  return this;
};

// Remove availability for specific date
userSchema.methods.removeAvailability = function (date) {
  if (this.userType !== 'partimer') return this;

  this.availabilitySlots = this.availabilitySlots.filter(
    slot => slot.date.toDateString() !== new Date(date).toDateString()
  );

  this.lastAvailabilityUpdate = new Date();
  return this;
};

// Set vacation period
userSchema.methods.setVacation = async function (startDate, endDate, reason) {
  this.vacationPeriods.push({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    reason: reason || 'Vacation'
  });
  this.lastAvailabilityUpdate = new Date();
  await this.save();
  return this;
};

// Update weekly schedule
userSchema.methods.updateWeeklySchedule = async function (day, schedule) {
  if (!this.weeklySchedule) {
    this.weeklySchedule = {};
  }
  this.weeklySchedule[day] = schedule;
  this.lastAvailabilityUpdate = new Date();
  await this.save();
  return this;
};

// Check if user is available on specific date and time
userSchema.methods.isAvailable = function (date, startTime, endTime) {
  const availableSlots = this.getAvailableSlotsForDate(new Date(date));

  return availableSlots.some(slot => {
    const slotStart = this.timeToMinutes(slot.start);
    const slotEnd = this.timeToMinutes(slot.end);
    const requestedStart = this.timeToMinutes(startTime);
    const requestedEnd = this.timeToMinutes(endTime);

    return requestedStart >= slotStart && requestedEnd <= slotEnd;
  });
};

// Helper method to convert time to minutes
userSchema.methods.timeToMinutes = function (timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// ============================================================
// STATIC METHODS
// ============================================================

// Find available partimers for a specific date and time
userSchema.statics.findAvailablePartimers = function (date, startTime, endTime, city) {
  const query = {
    userType: 'partimer',
    active: true,
    emailVerified: true
  };

  if (city) {
    query.city = new RegExp(city, 'i');
  }

  return this.find(query).then(partimers => {
    return partimers.filter(partimer =>
      partimer.isAvailable(date, startTime, endTime)
    );
  });
};

// Get partimers with upcoming availability
userSchema.statics.findPartimersWithUpcomingAvailability = function (days = 7, city) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + days);

  const query = {
    userType: 'partimer',
    active: true,
    emailVerified: true,
    'availabilitySlots.date': {
      $gte: startDate,
      $lte: endDate
    }
  };

  if (city) {
    query.city = new RegExp(city, 'i');
  }

  return this.find(query).sort({ 'rating.average': -1, 'lastAvailabilityUpdate': -1 });
};

const User = mongoose.model('User', userSchema);

module.exports = User;