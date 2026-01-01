// routes/entreprise.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

const {
  getParticulierById,
} = require('../controllers/particulierController.js');

// All routes require authentication
router.use(protect);

// GET ALL ENTREPRISE
router.get('/:particulierId', getParticulierById);

module.exports = router;