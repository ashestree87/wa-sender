const express = require('express');
const campaignController = require('../controllers/campaignController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.delete('/:id', authMiddleware, campaignController.deleteCampaign);

module.exports = router; 