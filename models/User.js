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
    // enum: ['full-time', 'part-time', 'weekends', 'flexible', null, 'remote'],
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
    // enum: ['Sur site', 'À distance', 'Les deux', null],
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
    // enum: ['Primaire', 'Collège', 'Lycée', 'Formation professionnelle', 'Licence', 'Master', 'Doctorat', null],
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
      // enum: ['unavailable', 'custom_hours'],
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
    // enum: [
    //   '1-10 employés',
    //   '11-50 employés',
    //   '51-200 employés',
    //   '201-500 employés',
    //   '500+ employés',
    //   null
    // ],
    required: function () {
      return this.userType === 'entreprise';
    }
  },

  companySize: {
    type: String,
    // enum: ['1-10', '11-50', '51-200', '201-500', '500+', null],
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
    enum: ['none', 'basic', 'premium', 'custom'],
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





  // Add these if missing in the PARTIMER SPECIFIC FIELDS section
  nomComplet: {
    type: String,
    trim: true
  },

  anneeNaissance: {
    type: String,
    trim: true
  },

  villeResidence: {
    type: String,
    trim: true
  },

  adresseComplete: {
    type: String,
    trim: true
  },

  categoriesMissions: [{
    type: String,
    trim: true
  }],

  competences: [{
    type: String,
    trim: true
  }],

  languesParlees: [{
    type: String,
    trim: true
  }],

  problemesSante: {
    type: String,
    trim: true
  },

  raisonTravail: [{
    type: String,
    trim: true
  }],

  experienceDetails: {
    type: String,
    trim: true
  },

  domaineExpertise: {
    type: String,
    trim: true
  },

  domaineExpertiseAutre: {
    type: String,
    trim: true
  },

  limitationsPhysiquesAutre: {
    type: String,
    trim: true
  },




   // ============================================================
  // PAYMENT INFORMATION - CMI (Centre Monétique Interbancaire)
  // ============================================================

  // CMI Payment Methods (Tokenized - Secure)
  paymentMethods: [{
    // CMI Token (returned after successful payment)
    cmiToken: {
      type: String,
      trim: true,
      select: false // Don't include by default for security
    },
    
    // Card type
    cardType: {
      type: String,
      enum: ['visa', 'mastercard', 'amex', 'cmi', 'other'],
      trim: true
    },
    
    // Last 4 digits only (safe to store)
    last4: {
      type: String,
      trim: true,
      maxlength: 4,
      match: [/^\d{4}$/, 'Last 4 digits must be numeric']
    },
    
    // Card brand/bank
    bankName: {
      type: String,
      trim: true
    },
    
    // Masked card number (e.g., "XXXX-XXXX-XXXX-1234")
    maskedCardNumber: {
      type: String,
      trim: true
    },
    
    // Expiry date - Month (01-12)
    expiryMonth: {
      type: String,
      match: [/^(0[1-9]|1[0-2])$/, 'Invalid expiry month (01-12)'],
      trim: true
    },
    
    // Expiry date - Year (YY format: 25, 26, etc.)
    expiryYear: {
      type: String,
      match: [/^\d{2}$/, 'Invalid expiry year (YY format)'],
      trim: true
    },
    
    // Cardholder name
    cardholderName: {
      type: String,
      trim: true,
      uppercase: true
    },
    
    // Whether this is the default payment method
    isDefault: {
      type: Boolean,
      default: false
    },
    
    // Card verification status
    isVerified: {
      type: Boolean,
      default: false
    },
    
    // 3D Secure enabled
    threeDSecureEnabled: {
      type: Boolean,
      default: true
    },
    
    // When it was added
    addedAt: {
      type: Date,
      default: Date.now
    },
    
    // Last used
    lastUsedAt: {
      type: Date
    },
    
    // Payment method status
    status: {
      type: String,
      enum: ['active', 'expired', 'blocked', 'pending'],
      default: 'active'
    }
  }],

  // CMI Configuration per user (if needed)
  cmiConfig: {
    // CMI Customer Reference (optional - some implementations use this)
    customerReference: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      select: false
    },
    
    // Store ID (if you have multiple stores)
    storeId: {
      type: String,
      trim: true
    },
    
    // Preferred language for CMI payment page
    preferredLanguage: {
      type: String,
      enum: ['fr', 'ar', 'en'],
      default: 'fr'
    },
    
    // Auto-tokenization enabled
    autoTokenization: {
      type: Boolean,
      default: false
    }
  },

  // Payment Transaction History (Summary)
  paymentHistory: {
    totalSpent: {
      type: Number,
      default: 0,
      min: 0
    },
    totalTransactions: {
      type: Number,
      default: 0,
      min: 0
    },
    successfulTransactions: {
      type: Number,
      default: 0,
      min: 0
    },
    failedTransactions: {
      type: Number,
      default: 0,
      min: 0
    },
    lastPaymentDate: {
      type: Date
    },
    lastPaymentAmount: {
      type: Number
    },
    lastPaymentStatus: {
      type: String,
      enum: ['success', 'failed', 'pending', 'cancelled']
    }
  },

  // Billing Information
  billingInfo: {
    fullName: {
      type: String,
      trim: true
    },
    address: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    postalCode: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      default: 'MA', // Morocco
      trim: true
    },
    phone: {
      type: String,
      trim: true
    }
  },

  // Auto-payment settings
  autoPayment: {
    enabled: {
      type: Boolean,
      default: false
    },
    defaultPaymentMethodId: {
      type: mongoose.Schema.Types.ObjectId
    },
    // For subscriptions
    nextBillingDate: {
      type: Date
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly', null],
      default: null
    }
  },

  // Payment security
  paymentSecurity: {
    // Failed payment attempts counter
    failedAttempts: {
      type: Number,
      default: 0,
      min: 0
    },
    // Last failed attempt
    lastFailedAttempt: {
      type: Date
    },
    // Account locked for payments
    isLocked: {
      type: Boolean,
      default: false
    },
    // Lock expires at
    lockExpiresAt: {
      type: Date
    }
  }

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

// Sync fields before saving - UPDATE THIS SECTION
userSchema.pre('save', function (next) {
  // Auto-generate nomComplet for partimer
  if (this.userType === 'partimer') {
    if (this.firstName && this.lastName) {
      this.nomComplet = `${this.firstName} ${this.lastName}`;
    } else if (this.firstName) {
      this.nomComplet = this.firstName;
    }

    // Additional field syncing for Partimer
    if (this.city && !this.villeResidence) {
      this.villeResidence = this.city;
    }
    if (this.villeResidence && !this.city) {
      this.city = this.villeResidence;
    }
    if (this.phone && !this.telephone) {
      this.telephone = this.phone;
    }
    if (this.telephone && !this.phone) {
      this.phone = this.telephone;
    }
    if (this.address && !this.adresseComplete) {
      this.adresseComplete = this.address;
    }
    if (this.adresseComplete && !this.address) {
      this.address = this.adresseComplete;
    }
    if (this.serviceCategories && !this.categoriesMissions) {
      this.categoriesMissions = this.serviceCategories;
    }
    if (this.categoriesMissions && !this.serviceCategories) {
      this.serviceCategories = this.categoriesMissions;
    }
    if (this.skills && !this.competences) {
      this.competences = this.skills;
    }
    if (this.competences && !this.skills) {
      this.skills = this.competences;
    }
    if (this.availability && !this.preferenceTravail) {
      this.preferenceTravail = this.availability;
    }
    if (this.preferenceTravail && !this.availability) {
      this.availability = this.preferenceTravail;
    }
    if (this.problemeSanteChronique && !this.problemesSante) {
      this.problemesSante = this.problemeSanteChronique;
    }
    if (this.problemesSante && !this.problemeSanteChronique) {
      this.problemeSanteChronique = this.problemesSante;
    }
    if (this.motivationPartTime && !this.raisonTravail) {
      this.raisonTravail = this.motivationPartTime;
    }
    if (this.raisonTravail && !this.motivationPartTime) {
      this.motivationPartTime = this.raisonTravail;
    }
    if (this.experiencesAnterieures && !this.experienceDetails) {
      this.experienceDetails = this.experiencesAnterieures;
    }
    if (this.experienceDetails && !this.experiencesAnterieures) {
      this.experiencesAnterieures = this.experienceDetails;
    }
    if (this.domaineEtudes && !this.domaineExpertise) {
      this.domaineExpertise = this.domaineEtudes;
    }
    if (this.domaineExpertise && !this.domaineEtudes) {
      this.domaineEtudes = this.domaineExpertise;
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

// ============================================================
// PAYMENT-RELATED INSTANCE METHODS
// ============================================================

// Add a new payment method (after CMI tokenization or direct save)
userSchema.methods.addPaymentMethod = async function(paymentData) {
  // Initialize paymentMethods array if it doesn't exist
  if (!this.paymentMethods) {
    this.paymentMethods = [];
  }

  // Ensure only one default payment method
  if (paymentData.isDefault) {
    this.paymentMethods.forEach(pm => {
      pm.isDefault = false;
    });
  }

  // Check if payment method already exists (by last4 and expiry)
  const exists = this.paymentMethods.find(pm => 
    pm.last4 === paymentData.last4 && 
    pm.expiryMonth === paymentData.expiryMonth &&
    pm.expiryYear === paymentData.expiryYear
  );

  if (exists) {
    // Update existing payment method
    exists.cmiToken = paymentData.cmiToken;
    exists.cardholderName = paymentData.cardholderName;
    exists.lastUsedAt = new Date();
    exists.status = 'active';
  } else {
    // Add new payment method
    this.paymentMethods.push({
      ...paymentData,
      addedAt: new Date(),
      status: paymentData.status || 'active'
    });
  }

  await this.save();
  return this;
};

// Set default payment method
userSchema.methods.setDefaultPaymentMethod = async function(paymentMethodId) {
  if (!this.paymentMethods || this.paymentMethods.length === 0) {
    throw new Error('No payment methods found');
  }

  this.paymentMethods.forEach(pm => {
    pm.isDefault = pm._id.toString() === paymentMethodId.toString();
  });
  
  if (this.autoPayment && this.autoPayment.enabled) {
    this.autoPayment.defaultPaymentMethodId = paymentMethodId;
  }
  
  await this.save();
  return this;
};

// Remove a payment method
userSchema.methods.removePaymentMethod = async function(paymentMethodId) {
  if (!this.paymentMethods || this.paymentMethods.length === 0) {
    throw new Error('No payment methods found');
  }

  const wasDefault = this.paymentMethods.id(paymentMethodId)?.isDefault;
  
  this.paymentMethods = this.paymentMethods.filter(
    pm => pm._id.toString() !== paymentMethodId.toString()
  );
  
  // Set new default if removed was default
  if (wasDefault && this.paymentMethods.length > 0) {
    this.paymentMethods[0].isDefault = true;
  }
  
  await this.save();
  return this;
};

// Get default payment method
userSchema.methods.getDefaultPaymentMethod = function() {
  if (!this.paymentMethods || this.paymentMethods.length === 0) {
    return null;
  }
  return this.paymentMethods.find(pm => pm.isDefault) || this.paymentMethods[0];
};

// Get active payment methods
userSchema.methods.getActivePaymentMethods = function() {
  if (!this.paymentMethods || this.paymentMethods.length === 0) {
    return [];
  }
  return this.paymentMethods.filter(pm => pm.status === 'active');
};

// Check if payment method is expired
userSchema.methods.isPaymentMethodExpired = function(paymentMethodId) {
  if (!this.paymentMethods || this.paymentMethods.length === 0) {
    return false;
  }

  const pm = this.paymentMethods.id(paymentMethodId);
  if (!pm || !pm.expiryMonth || !pm.expiryYear) return false;
  
  const now = new Date();
  const currentYear = now.getFullYear() % 100; // Get YY format
  const currentMonth = now.getMonth() + 1;
  
  const expiryYear = parseInt(pm.expiryYear);
  const expiryMonth = parseInt(pm.expiryMonth);
  
  if (expiryYear < currentYear) return true;
  if (expiryYear === currentYear && expiryMonth < currentMonth) return true;
  
  return false;
};

// Update payment method status
userSchema.methods.updatePaymentMethodStatus = async function(paymentMethodId, status) {
  if (!this.paymentMethods || this.paymentMethods.length === 0) {
    throw new Error('No payment methods found');
  }

  const pm = this.paymentMethods.id(paymentMethodId);
  if (pm) {
    pm.status = status;
    await this.save();
  }
  return this;
};

// Record successful payment
userSchema.methods.recordSuccessfulPayment = async function(amount, paymentMethodId) {
  // Initialize paymentHistory if it doesn't exist
  if (!this.paymentHistory) {
    this.paymentHistory = {
      totalSpent: 0,
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0
    };
  }

  this.paymentHistory.totalSpent = (this.paymentHistory.totalSpent || 0) + amount;
  this.paymentHistory.totalTransactions = (this.paymentHistory.totalTransactions || 0) + 1;
  this.paymentHistory.successfulTransactions = (this.paymentHistory.successfulTransactions || 0) + 1;
  this.paymentHistory.lastPaymentDate = new Date();
  this.paymentHistory.lastPaymentAmount = amount;
  this.paymentHistory.lastPaymentStatus = 'success';
  
  // Reset failed attempts on successful payment
  if (!this.paymentSecurity) {
    this.paymentSecurity = {};
  }
  this.paymentSecurity.failedAttempts = 0;
  this.paymentSecurity.isLocked = false;
  
  // Update payment method last used
  if (paymentMethodId && this.paymentMethods) {
    const pm = this.paymentMethods.id(paymentMethodId);
    if (pm) {
      pm.lastUsedAt = new Date();
    }
  }
  
  await this.save();
  return this;
};

// Record failed payment
userSchema.methods.recordFailedPayment = async function(amount) {
  // Initialize paymentHistory if it doesn't exist
  if (!this.paymentHistory) {
    this.paymentHistory = {
      totalSpent: 0,
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0
    };
  }

  this.paymentHistory.totalTransactions = (this.paymentHistory.totalTransactions || 0) + 1;
  this.paymentHistory.failedTransactions = (this.paymentHistory.failedTransactions || 0) + 1;
  this.paymentHistory.lastPaymentStatus = 'failed';
  
  // Initialize paymentSecurity if it doesn't exist
  if (!this.paymentSecurity) {
    this.paymentSecurity = {
      failedAttempts: 0,
      isLocked: false
    };
  }

  // Increment failed attempts
  this.paymentSecurity.failedAttempts = (this.paymentSecurity.failedAttempts || 0) + 1;
  this.paymentSecurity.lastFailedAttempt = new Date();
  
  // Lock account if too many failed attempts (e.g., 5)
  if (this.paymentSecurity.failedAttempts >= 5) {
    this.paymentSecurity.isLocked = true;
    // Lock for 24 hours
    this.paymentSecurity.lockExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  
  await this.save();
  return this;
};

// Check if payment is locked
userSchema.methods.isPaymentLocked = function() {
  if (!this.paymentSecurity || !this.paymentSecurity.isLocked) return false;
  
  // Check if lock has expired
  if (this.paymentSecurity.lockExpiresAt && 
      new Date() > this.paymentSecurity.lockExpiresAt) {
    this.paymentSecurity.isLocked = false;
    this.paymentSecurity.failedAttempts = 0;
    return false;
  }
  
  return true;
};

// Generate CMI customer reference
userSchema.methods.generateCMIReference = function() {
  // Initialize cmiConfig if it doesn't exist
  if (!this.cmiConfig) {
    this.cmiConfig = {};
  }

  if (!this.cmiConfig.customerReference) {
    // Format: USER-{userType}-{timestamp}-{random}
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    this.cmiConfig.customerReference = `USER-${this.userType.toUpperCase()}-${timestamp}-${random}`;
  }
  return this.cmiConfig.customerReference;
};

const User = mongoose.model('User', userSchema);

module.exports = User;