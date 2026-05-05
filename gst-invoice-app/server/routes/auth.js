const express = require('express');
const router = express.Router();
const { signup, login, getProfile, updateProfile, changePassword } = require('../controllers/authController');
const { auth } = require('../middleware/auth');

router.post('/signup', signup);
router.post('/login', login);
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.put('/password', auth, changePassword);

module.exports = router;
