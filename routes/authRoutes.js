const express = require('express');
const { body } = require('express-validator');
const {
  getPublicInstitutions,
  registerStudent,
  login,
  getMe,
  updateProfile,
  changePassword,
  seedUsers,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Validation middleware for login
const loginValidation = [
  body('email').trim().isEmail().withMessage('Please provide a valid email address'),
  body('password').notEmpty().withMessage('Password is required'),
];

// Validation middleware for student registration
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Full Name is required'),
  body('email').trim().isEmail().withMessage('Please provide a valid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('institutionId').notEmpty().withMessage('Please select a valid campus institution'),
];

router.get('/institutions', getPublicInstitutions);
router.post('/register', registerValidation, registerStudent);
router.post('/login', loginValidation, login);

router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);
router.post('/seed', seedUsers);

module.exports = router;
