// controllers/supportController.js
const sendEmail = require('../services/emailService');
const Reclamation = require('../models/Reclamation');
const User = require('../models/User');

// @desc    Create a new reclamation
// @route   POST /api/v1/support/reclamation
// @access  Private
const createReclamation = async (req, res, next) => {
  try {
    const { type, description, missionId, relatedUserId } = req.body;
    const userId = req.user._id;

    // Create reclamation
    const reclamation = await Reclamation.create({
      user: userId,
      type,
      description,
      mission: missionId,
      relatedUser: relatedUserId,
      status: 'pending'
    });

    // Get user info
    const user = await User.findById(userId).select('email firstName lastName nomComplet userType');

    // Send email to client.mijob@gmail.com
    await sendEmail({
      email: 'client.mijob@gmail.com',
      subject: 'New Reclamation Submitted - MIJOB',
      template: 'reclamation',
      data: {
        userEmail: user.email,
        userName: user.nomComplet || `${user.firstName} ${user.lastName}`,
        userType: user.userType,
        reclamationType: type,
        description: description,
        reclamationId: reclamation._id,
        date: new Date().toLocaleDateString('fr-FR'),
        time: new Date().toLocaleTimeString('fr-FR')
      }
    });

    res.status(201).json({
      success: true,
      message: 'Reclamation submitted successfully. We will contact you soon.',
      data: reclamation
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's reclamations
// @route   GET /api/v1/support/reclamation
// @access  Private
const getUserReclamations = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    const reclamations = await Reclamation.find({ user: userId })
      .sort('-createdAt')
      .populate('mission', 'title')
      .populate('relatedUser', 'firstName lastName email');

    res.status(200).json({
      success: true,
      count: reclamations.length,
      data: reclamations
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get specific reclamation
// @route   GET /api/v1/support/reclamation/:id
// @access  Private
const getReclamation = async (req, res, next) => {
  try {
    const reclamation = await Reclamation.findById(req.params.id)
      .populate('user', 'email firstName lastName nomComplet userType')
      .populate('mission', 'title')
      .populate('relatedUser', 'firstName lastName email');

    if (!reclamation) {
      return res.status(404).json({
        success: false,
        message: 'Reclamation not found'
      });
    }

    // Check if user owns the reclamation or is admin
    if (reclamation.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this reclamation'
      });
    }

    res.status(200).json({
      success: true,
      data: reclamation
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReclamation,
  getUserReclamations,
  getReclamation
};