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
router.post('/quick-demo-login', quickDemoLogin);
router.get('/me', protect, getMe);
router.get('/logout', logout);

module.exports = router;
