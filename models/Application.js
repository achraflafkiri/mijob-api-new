const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  // Mission Reference
  mission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mission',
    required: [true, 'Mission reference is required']
  },

  // Partimer (Applicant)
  partimer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Partimer reference is required']
  },

  // Recruiter (Mission owner)
  recruiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Recruiter reference is required']
  },

  // Application Status
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending'
  },

  // Cover Message (optional)
  coverMessage: {
    type: String,
    trim: true,
    maxlength: [500, 'Cover message cannot exceed 500 characters']
  },

  // Proposed Rate (if partimer wants to negotiate)
  proposedRate: {
    type: Number,
    min: [0, 'Proposed rate cannot be negative']
  },

  // Application viewed by recruiter
  viewed: {
    type: Boolean,
    default: false
  },

  viewedAt: {
    type: Date
  },

  // Response from recruiter
  recruiterResponse: {
    type: String,
    trim: true,
    maxlength: [500, 'Response cannot exceed 500 characters']
  },

  // Status change dates
  acceptedAt: {
    type: Date
  },

  rejectedAt: {
    type: Date
  },

  withdrawnAt: {
    type: Date
  },

  // Rating (after mission completion)
  rating: {
    type: Number,
    min: 1,
    max: 5
  },

  ratingComment: {
    type: String,
    trim: true,
    maxlength: [300, 'Rating comment cannot exceed 300 characters']
  },

  ratedAt: {
    type: Date
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
applicationSchema.index({ mission: 1, partimer: 1 }, { unique: true }); // Prevent duplicate applications
applicationSchema.index({ mission: 1, status: 1 });
applicationSchema.index({ partimer: 1, status: 1 });
applicationSchema.index({ recruiter: 1, viewed: 1 });
applicationSchema.index({ createdAt: -1 });

// Virtual for time since application
applicationSchema.virtual('timeSinceApplication').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    return diffHours === 0 ? 'Just now' : `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }
  
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
});

// Pre-save middleware to set status change dates
applicationSchema.pre('save', function(next) {
  // Track when status changes
  if (this.isModified('status')) {
    if (this.status === 'accepted' && !this.acceptedAt) {
      this.acceptedAt = new Date();
    }
    if (this.status === 'rejected' && !this.rejectedAt) {
      this.rejectedAt = new Date();
    }
    if (this.status === 'withdrawn' && !this.withdrawnAt) {
      this.withdrawnAt = new Date();
    }
  }

  // Track when viewed
  if (this.isModified('viewed') && this.viewed && !this.viewedAt) {
    this.viewedAt = new Date();
  }

  // Track when rated
  if (this.isModified('rating') && this.rating && !this.ratedAt) {
    this.ratedAt = new Date();
  }

  next();
});

// Method to mark as viewed
applicationSchema.methods.markAsViewed = async function() {
  this.viewed = true;
  this.viewedAt = new Date();
  await this.save();
};

// Method to accept application
applicationSchema.methods.accept = async function(response) {
  this.status = 'accepted';
  this.acceptedAt = new Date();
  if (response) this.recruiterResponse = response;
  await this.save();
};

// Method to reject application
applicationSchema.methods.reject = async function(response) {
  this.status = 'rejected';
  this.rejectedAt = new Date();
  if (response) this.recruiterResponse = response;
  await this.save();
};

// Method to withdraw application
applicationSchema.methods.withdraw = async function() {
  this.status = 'withdrawn';
  this.withdrawnAt = new Date();
  await this.save();
};

// Method to rate partimer
applicationSchema.methods.ratePartimer = async function(rating, comment) {
  this.rating = rating;
  if (comment) this.ratingComment = comment;
  this.ratedAt = new Date();
  await this.save();
};

// Static method to get pending applications for a mission
applicationSchema.statics.findPendingByMission = function(missionId) {
  return this.find({
    mission: missionId,
    status: 'pending'
  }).populate('partimer', 'fullName firstName city age profilePhoto');
};

// Static method to get all applications for a partimer
applicationSchema.statics.findByPartimer = function(partimerId, status) {
  const query = { partimer: partimerId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('mission', 'title city serviceType startDate salary')
    .populate('recruiter', 'companyName fullName')
    .sort('-createdAt');
};

// Static method to get unviewed applications count for recruiter
applicationSchema.statics.countUnviewedByRecruiter = function(recruiterId) {
  return this.countDocuments({
    recruiter: recruiterId,
    viewed: false,
    status: 'pending'
  });
};

// Static method to get application statistics
applicationSchema.statics.getStats = async function(userId, userType) {
  const matchQuery = userType === 'partimer' 
    ? { partimer: userId } 
    : { recruiter: userId };

  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  return stats.reduce((acc, stat) => {
    acc[stat._id] = stat.count;
    return acc;
  }, {});
};

const Application = mongoose.model('Application', applicationSchema);

module.exports = Application;