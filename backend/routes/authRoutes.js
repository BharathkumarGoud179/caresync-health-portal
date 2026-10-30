const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  logout,
  quickDemoLogin
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/logout', logout);
router.post('/quick-demo-login', quickDemoLogin);

module.exports = router;
