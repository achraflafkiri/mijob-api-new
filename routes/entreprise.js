// routes/entreprise.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

const {
  getEntrepriseById,
} = require('../controllers/entrepriseController');

// All routes require authentication
router.use(protect);

// GET ALL ENTREPRISE
router.get('/:entrepriseId', getEntrepriseById);

module.exports = router;