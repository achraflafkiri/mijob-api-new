// controllers/missionController.js - COMPLETE MISSION CONTROLLER

const Mission = require('../models/Mission');
const User = require('../models/User');
const Application = require('../models/Application');

// ============================================
// CREATE MISSION
// ============================================

// @desc    Create new mission
// @route   POST /api/missions
// @access  Private (Entreprise/Particulier)
exports.createMission = async (req, res) => {
  try {
    const {
      title,
      description,
      city,
      neighborhood,
      serviceType,
      serviceCategory,
      serviceSubcategory,
      startDate,
      endDate,
      startTime,
      endTime,
      paymentType,
      hourlyRate,
      dailyRate,
      flatRate,
      salary,
      workType,
      address,
      addressInputType,
      latitude,
      longitude,
      requirements,
      featuredListing,
    } = req.body;

    // Check if user is entreprise or particulier
    if (!['entreprise', 'particulier'].includes(req.user.userType)) {
      return res.status(403).json({
        success: false,
        message: 'Only entreprise and particulier can create missions'
      });
    }

    // For particulier: Check token balance
    if (req.user.userType === 'particulier') {
      const baseTokenCost = 10;
      const featuredCost = featuredListing ? 5 : 0;
      const totalTokenCost = baseTokenCost + featuredCost;

      if (req.user.tokenBalance < totalTokenCost) {
        return res.status(400).json({
          success: false,
          message: `Insufficient tokens. You need ${totalTokenCost} tokens but have ${req.user.tokenBalance}`
        });
      }

      // Deduct tokens
      req.user.tokenBalance -= totalTokenCost;
      await req.user.save();
    }

    // For entreprise: Check pack limits
    if (req.user.userType === 'entreprise') {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const missionsThisMonth = await Mission.countDocuments({
        createdBy: req.user._id,
        createdAt: {
          $gte: new Date(currentYear, currentMonth, 1),
          $lt: new Date(currentYear, currentMonth + 1, 1)
        }
      });

      const packLimits = {
        basic: 3,
        premium: 8
      };

      if (missionsThisMonth >= packLimits[req.user.subscriptionPack]) {
        return res.status(400).json({
          success: false,
          message: `You have reached your monthly limit of ${packLimits[req.user.subscriptionPack]} missions`
        });
      }
    }

    // Create mission
    const missionData = {
      title,
      description,
      city,
      neighborhood,
      serviceType,
      serviceCategory,
      serviceSubcategory,
      startDate,
      endDate,
      startTime,
      endTime,
      paymentType,
      salary,
      workType,
      createdBy: req.user._id,
      creatorType: req.user.userType,
      featuredListing: req.user.userType === 'particulier' ? featuredListing : false,
      isFeatured: req.user.userType === 'entreprise' && req.user.subscriptionPack === 'premium'
    };

    // Add payment rates
    if (paymentType === 'hourly') missionData.hourlyRate = hourlyRate;
    if (paymentType === 'daily') missionData.dailyRate = dailyRate;
    if (paymentType === 'flat') missionData.flatRate = flatRate;

    // Add address/location - FIXED VERSION
    if (workType === 'onsite') {
      missionData.addressInputType = addressInputType;

      if (addressInputType === 'manual') {
        missionData.address = address;
        // Don't set location for manual addresses without coordinates
        missionData.latitude = undefined;
        missionData.longitude = undefined;
      } else if (addressInputType === 'map') {
        if (latitude && longitude) {
          missionData.latitude = parseFloat(latitude);
          missionData.longitude = parseFloat(longitude);
          missionData.address = address || `${latitude}, ${longitude}`;
        } else {
          return res.status(400).json({
            success: false,
            message: 'Coordinates are required when using map selection'
          });
        }
      }
    } else {
      // For remote work, clear location data
      missionData.address = undefined;
      missionData.latitude = undefined;
      missionData.longitude = undefined;
      missionData.addressInputType = undefined;
    }

    // Add requirements if provided
    if (requirements && Object.keys(requirements).length > 0) {
      missionData.requirements = requirements;
    }

    const mission = await Mission.create(missionData);

    res.status(201).json({
      success: true,
      message: 'Mission created successfully',
      data: {
        mission,
        tokensUsed: req.user.userType === 'particulier' ? mission.tokenCost.total : null,
        remainingTokens: req.user.userType === 'particulier' ? req.user.tokenBalance : null
      }
    });

  } catch (error) {
    console.error('Create mission error:', error);

    // More specific error handling for geospatial errors
    if (error.code === 16755 || error.message.includes('geo keys')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location data provided',
        error: 'Please provide valid coordinates or use manual address input'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating mission',
      error: error.message
    });
  }
};

// ============================================
// GET MISSIONS
// ============================================

// @desc    Get all active missions with filters
// @route   GET /api/missions
// @access  Public
exports.getAllMissions = async (req, res) => {
  try {
    const {
      city,
      serviceType,
      workType,
      paymentType,
      minSalary,
      maxSalary,
      startDate,
      page = 1,
      limit = 10,
      sort = '-publishedAt'
    } = req.query;

    // Build query
    const query = {
      status: 'published',
      isActive: true,
      expiresAt: { $gt: new Date() }
    };

    if (city) query.city = city;
    if (serviceType) query.serviceType = serviceType;
    if (workType) query.workType = workType;
    if (paymentType) query.paymentType = paymentType;
    if (minSalary || maxSalary) {
      query.salary = {};
      if (minSalary) query.salary.$gte = Number(minSalary);
      if (maxSalary) query.salary.$lte = Number(maxSalary);
    }
    if (startDate) {
      query.startDate = { $gte: new Date(startDate) };
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Execute query
    const missions = await Mission.find(query)
      .populate('createdBy')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const total = await Mission.countDocuments(query);

    res.status(200).json({
      success: true,
      count: missions.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: missions
    });

  } catch (error) {
    console.error('Get all missions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching missions',
      error: error.message
    });
  }
};

// @desc    Get active missions (published, not expired)
// @route   GET /api/missions/active
// @access  Public
exports.getActiveMissions = async (req, res) => {
  try {
    const missions = await Mission.findActive()
      .populate('createdBy', 'companyName fullName city')
      .limit(50);

    res.status(200).json({
      success: true,
      count: missions.length,
      data: missions
    });

  } catch (error) {
    console.error('Get active missions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active missions',
      error: error.message
    });
  }
};

// @desc    Get featured missions
// @route   GET /api/missions/featured
// @access  Public
exports.getFeaturedMissions = async (req, res) => {
  try {
    const missions = await Mission.find({
      status: 'published',
      isActive: true,
      $or: [{ featuredListing: true }, { isFeatured: true }],
      expiresAt: { $gt: new Date() }
    })
      .populate('createdBy', 'companyName fullName city')
      .sort('-publishedAt')
      .limit(20);

    res.status(200).json({
      success: true,
      count: missions.length,
      data: missions
    });

  } catch (error) {
    console.error('Get featured missions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching featured missions',
      error: error.message
    });
  }
};

// @desc    Get single mission by ID
// @route   GET /api/missions/:id
// @access  Public
exports.getMissionById = async (req, res) => {
  try {
    const mission = await Mission.findById(req.params.id)
      .populate('createdBy', 'companyName fullName city email phone profilePhoto logo')
      .populate('applications', 'status createdAt');

    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Mission not found'
      });
    }

    // Increment views
    await mission.incrementViews();

    res.status(200).json({
      success: true,
      data: mission
    });

  } catch (error) {
    console.error('Get mission by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching mission',
      error: error.message
    });
  }
};

// @desc    Search missions with advanced filters
// @route   GET /api/missions/search
// @access  Public
exports.searchMissions = async (req, res) => {
  try {
    const {
      keyword,
      city,
      serviceType,
      workType,
      minSalary,
      maxSalary,
      requirements,
      page = 1,
      limit = 10
    } = req.query;

    const query = {
      status: 'published',
      isActive: true,
      expiresAt: { $gt: new Date() }
    };

    // Keyword search in title and description
    if (keyword) {
      query.$or = [
        { title: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } }
      ];
    }

    if (city) query.city = city;
    if (serviceType) query.serviceType = serviceType;
    if (workType) query.workType = workType;

    if (minSalary || maxSalary) {
      query.salary = {};
      if (minSalary) query.salary.$gte = Number(minSalary);
      if (maxSalary) query.salary.$lte = Number(maxSalary);
    }

    // Requirements filters
    if (requirements) {
      const reqObj = JSON.parse(requirements);
      if (reqObj.age) query['requirements.age'] = reqObj.age;
      if (reqObj.gender) query['requirements.gender'] = reqObj.gender;
      if (reqObj.educationLevel) query['requirements.educationLevel'] = reqObj.educationLevel;
    }

    const skip = (page - 1) * limit;

    const missions = await Mission.find(query)
      .populate('createdBy', 'companyName fullName city')
      .sort('-featuredListing -isFeatured -publishedAt')
      .skip(skip)
      .limit(Number(limit));

    const total = await Mission.countDocuments(query);

    res.status(200).json({
      success: true,
      count: missions.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: missions
    });

  } catch (error) {
    console.error('Search missions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching missions',
      error: error.message
    });
  }
};

// @desc    Get missions by location (within radius)
// @route   GET /api/missions/location?lng=&lat=&radius=
// @access  Public
exports.getMissionsByLocation = async (req, res) => {
  try {
    const { lng, lat, radius = 10 } = req.query;

    if (!lng || !lat) {
      return res.status(400).json({
        success: false,
        message: 'Please provide longitude and latitude'
      });
    }

    const missions = await Mission.findByLocation(
      Number(lng),
      Number(lat),
      Number(radius)
    ).populate('createdBy', 'companyName fullName city');

    res.status(200).json({
      success: true,
      count: missions.length,
      data: missions
    });

  } catch (error) {
    console.error('Get missions by location error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching missions by location',
      error: error.message
    });
  }
};

// ============================================
// UPDATE & DELETE MISSIONS
// ============================================

// @desc    Update mission
// @route   PUT /api/missions/:id
// @access  Private (Owner only)
exports.updateMission = async (req, res) => {
  try {
    const mission = await Mission.findById(req.params.id);

    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Mission not found'
      });
    }

    // Check ownership
    if (mission.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this mission'
      });
    }

    // Check if mission has applications
    if (mission.applicationCount > 0) {
      // Limited fields can be updated if there are applications
      const allowedFields = ['description', 'requirements'];
      const updates = {};

      Object.keys(req.body).forEach(key => {
        if (allowedFields.includes(key)) {
          updates[key] = req.body[key];
        }
      });

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'You cannot change this field. Please create a new mission'
        });
      }

      Object.assign(mission, updates);
    } else {
      // Full update allowed if no applications
      Object.assign(mission, req.body);
    }

    await mission.save();

    res.status(200).json({
      success: true,
      message: 'Mission updated successfully',
      data: mission
    });

  } catch (error) {
    console.error('Update mission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating mission',
      error: error.message
    });
  }
};

// @desc    Delete mission
// @route   DELETE /api/missions/:id
// @access  Private (Owner only)
exports.deleteMission = async (req, res) => {
  try {
    const mission = await Mission.findById(req.params.id);

    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Mission not found'
      });
    }

    // Check ownership
    if (mission.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this mission'
      });
    }

    // Check if mission has accepted applications
    const hasAcceptedApplications = await Application.exists({
      mission: mission._id,
      status: 'accepted'
    });

    if (hasAcceptedApplications) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete mission with accepted applications'
      });
    }

    await mission.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Mission deleted successfully'
    });

  } catch (error) {
    console.error('Delete mission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting mission',
      error: error.message
    });
  }
};

// @desc    Cancel mission
// @route   PUT /api/missions/:id/cancel
// @access  Private (Owner only)
exports.cancelMission = async (req, res) => {
  try {
    const mission = await Mission.findById(req.params.id);

    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Mission not found'
      });
    }

    // Check ownership
    if (mission.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this mission'
      });
    }

    mission.status = 'cancelled';
    mission.isActive = false;
    await mission.save();

    // TODO: Notify applicants

    res.status(200).json({
      success: true,
      message: 'Mission cancelled successfully',
      data: mission
    });

  } catch (error) {
    console.error('Cancel mission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling mission',
      error: error.message
    });
  }
};

// @desc    Complete mission
// @route   PUT /api/missions/:id/complete
// @access  Private (Owner only)
exports.completeMission = async (req, res) => {
  try {
    const mission = await Mission.findById(req.params.id);

    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Mission not found'
      });
    }

    // Check ownership
    if (mission.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to complete this mission'
      });
    }

    mission.status = 'completed';
    mission.isActive = false;
    await mission.save();

    // TODO: Send evaluation email to recruiter

    res.status(200).json({
      success: true,
      message: 'Mission completed successfully',
      data: mission
    });

  } catch (error) {
    console.error('Complete mission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing mission',
      error: error.message
    });
  }
};

// ============================================
// USER'S MISSIONS
// ============================================

// @desc    Get all missions created by logged-in user
// @route   GET /api/missions/my/all
// @access  Private (Entreprise/Particulier)
exports.getMyMissions = async (req, res) => {
  try {
    const missions = await Mission.find({ createdBy: req.user._id })
      .sort('-createdAt')
      .populate('applications');

    res.status(200).json({
      success: true,
      count: missions.length,
      data: missions
    });

  } catch (error) {
    console.error('Get my missions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching your missions',
      error: error.message
    });
  }
};

// @desc    Get user's missions by status
// @route   GET /api/missions/my/status/:status
// @access  Private (Entreprise/Particulier)
exports.getMissionsByStatus = async (req, res) => {
  try {
    const { status } = req.params;

    const missions = await Mission.find({
      createdBy: req.user._id,
      status
    }).sort('-createdAt');

    res.status(200).json({
      success: true,
      count: missions.length,
      data: missions
    });

  } catch (error) {
    console.error('Get missions by status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching missions',
      error: error.message
    });
  }
};

// @desc    Get recruiter missions for dashboard
// @route   GET /api/missions/recruiter/dashboard
// @access  Private (Entreprise/Particulier)
exports.getRecruiterMissions = async (req, res) => {
  try {
    const activeMissions = await Mission.find({
      createdBy: req.user._id,
      status: 'published',
      isActive: true
    }).limit(2);

    const allMissions = await Mission.find({
      createdBy: req.user._id
    }).countDocuments();

    res.status(200).json({
      success: true,
      data: {
        activeMissions,
        totalMissions: allMissions
      }
    });

  } catch (error) {
    console.error('Get recruiter missions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard missions',
      error: error.message
    });
  }
};

// @desc    Get mission statistics
// @route   GET /api/missions/my/stats
// @access  Private (Entreprise/Particulier)
exports.getMissionStats = async (req, res) => {
  try {
    const totalMissions = await Mission.countDocuments({ createdBy: req.user._id });
    const activeMissions = await Mission.countDocuments({
      createdBy: req.user._id,
      status: 'published',
      isActive: true
    });
    const completedMissions = await Mission.countDocuments({
      createdBy: req.user._id,
      status: 'completed'
    });

    const totalViews = await Mission.aggregate([
      { $match: { createdBy: req.user._id } },
      { $group: { _id: null, total: { $sum: '$views' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalMissions,
        activeMissions,
        completedMissions,
        totalViews: totalViews[0]?.total || 0
      }
    });

  } catch (error) {
    console.error('Get mission stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching mission statistics',
      error: error.message
    });
  }
};

// ============================================
// APPLICATIONS
// ============================================

// @desc    Apply to a mission
// @route   POST /api/missions/:id/apply
// @access  Private (Partimer only)
exports.applyToMission = async (req, res) => {
  try {
    const mission = await Mission.findById(req.params.id);

    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Mission not found'
      });
    }

    // Check if mission is still active
    if (mission.status !== 'published' || !mission.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This mission is no longer accepting applications'
      });
    }

    // Check if already applied
    const existingApplication = await Application.findOne({
      mission: mission._id,
      partimer: req.user._id
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied to this mission'
      });
    }

    // Check if partimer profile is complete
    // if (!req.user.profileCompleted) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Please complete your profile before applying'
    //   });
    // }

    // Create application
    const application = await Application.create({
      mission: mission._id,
      partimer: req.user._id,
      recruiter: mission.createdBy,
      status: 'pending'
    });

    // Update mission
    mission.applications.push(application._id);
    mission.applicationCount += 1;
    await mission.save();

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: application
    });

  } catch (error) {
    console.error('Apply to mission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting application',
      error: error.message
    });
  }
};

// @desc    Get all applications for a mission
// @route   GET /api/missions/:id/applications
// @access  Private (Mission owner only)
exports.getMissionApplications = async (req, res) => {
  try {
    const mission = await Mission.findById(req.params.id);

    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Mission not found'
      });
    }

    console.log("createdBy : ",mission.createdBy.toString());
    console.log("User : ", req.user._id.toString());

    // Check ownership
    if (mission.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view applications'
      });
    }

    const applications = await Application.find({ mission: mission._id })
      .populate('partimer', 'fullName firstName city age profilePhoto')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: applications.length,
      data: applications
    });

  } catch (error) {
    console.error('Get mission applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching applications',
      error: error.message
    });
  }
};

// @desc    Update application status
// @route   PUT /api/missions/:missionId/applications/:applicationId
// @access  Private (Mission owner only)
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body; // 'accepted' or 'rejected'

    const mission = await Mission.findById(req.params.missionId);
    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Mission not found'
      });
    }

    // Check ownership
    if (mission.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const application = await Application.findById(req.params.applicationId);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    application.status = status;
    await application.save();

    // If accepted, update mission
    if (status === 'accepted') {
      mission.selectedWorker = application.partimer;
      mission.status = 'in-progress';
      await mission.save();
    }

    res.status(200).json({
      success: true,
      message: `Application ${status} successfully`,
      data: application
    });

  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating application',
      error: error.message
    });
  }
};

// @desc    Get all missions partimer has applied to
// @route   GET /api/missions/partimer/applied
// @access  Private (Partimer only)
exports.getPartimerAppliedMissions = async (req, res) => {
  try {
    const applications = await Application.find({ partimer: req.user._id })
      .populate('mission')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: applications.length,
      data: applications
    });

  } catch (error) {
    console.error('Get partimer applied missions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching applied missions',
      error: error.message
    });
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

// @desc    Increment mission views
// @route   PUT /api/missions/:id/views
// @access  Public
exports.incrementMissionViews = async (req, res) => {
  try {
    const mission = await Mission.findById(req.params.id);

    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Mission not found'
      });
    }

    await mission.incrementViews();

    res.status(200).json({
      success: true,
      data: { views: mission.views }
    });

  } catch (error) {
    console.error('Increment views error:', error);
    res.status(500).json({
      success: false,
      message: 'Error incrementing views',
      error: error.message
    });
  }
};

// @desc    Check and update expired missions (Cron job)
// @route   PUT /api/missions/system/check-expiration
// @access  Private (Admin only)
exports.checkMissionExpiration = async (req, res) => {
  try {
    const expiredMissions = await Mission.updateMany(
      {
        expiresAt: { $lte: new Date() },
        status: 'published',
        isActive: true
      },
      {
        $set: {
          status: 'expired',
          isActive: false
        }
      }
    );

    res.status(200).json({
      success: true,
      message: `${expiredMissions.modifiedCount} missions expired`,
      data: expiredMissions
    });

  } catch (error) {
    console.error('Check expiration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking expired missions',
      error: error.message
    });
  }
};