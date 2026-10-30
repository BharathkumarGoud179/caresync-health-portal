const express = require('express');
const router = express.Router();
const { getChatHistory, sendMessage } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

router.get('/:userId', protect, getChatHistory);
router.post('/:userId', protect, sendMessage);

module.exports = router;
