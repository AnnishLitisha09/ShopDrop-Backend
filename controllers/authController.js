const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { User, Institution, initDb } = require('../models');

// Helper to generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      institutionId: user.institutionId,
      vendorId: user.vendorId,
    },
    process.env.JWT_SECRET || 'your_jwt_secret_here',
    {
      expiresIn: '7d',
    }
  );
};

// @desc    Get active campus institutions list for registration dropdown
// @route   GET /api/auth/institutions
// @access  Public
const getPublicInstitutions = async (req, res) => {
  try {
    const institutions = await Institution.findAll({
      where: { status: 'active' },
      attributes: ['id', 'name', 'code', 'city', 'domain'],
      order: [['name', 'ASC']],
    });

    return res.status(200).json({
      success: true,
      data: {
        institutions,
      },
    });
  } catch (error) {
    console.error('getPublicInstitutions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch active campus institutions.',
    });
  }
};

// @desc    Register a new Student account
// @route   POST /api/auth/register
// @access  Public (Student registration only)
const registerStudent = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((err) => err.msg),
    });
  }

  const { name, email, password, institutionId } = req.body;

  try {
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Full Name is required.',
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.',
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid campus institution.',
      });
    }

    // 1. Verify institution exists and is active
    const institution = await Institution.findOne({
      where: { id: institutionId, status: 'active' },
    });

    if (!institution) {
      return res.status(400).json({
        success: false,
        message: 'Selected campus institution is invalid or currently inactive.',
      });
    }

    // 2. Prevent duplicate email registration
    const formattedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ where: { email: formattedEmail } });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists. Please log in.',
      });
    }

    // 3. Hash password using bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create new student user record (Role enforced strictly as 'student')
    const user = await User.create({
      name: name.trim(),
      email: formattedEmail,
      password: hashedPassword,
      role: 'student',
      institutionId: institution.id,
      status: 'active',
    });

    // 5. Generate JWT token for seamless auto-authentication
    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'Student account created successfully!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        institutionId: user.institutionId,
        vendorId: user.vendorId,
        savedAddress: user.savedAddress,
        avatarUrl: user.avatarUrl,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('registerStudent error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete student registration. Please try again.',
    });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((err) => err.msg),
    });
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account is deactivated or suspended. Please contact support.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        institutionId: user.institutionId,
        vendorId: user.vendorId,
        savedAddress: user.savedAddress,
        avatarUrl: user.avatarUrl,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during login processing.',
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = req.user;
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        institutionId: user.institutionId,
        vendorId: user.vendorId,
        savedAddress: user.savedAddress,
        avatarUrl: user.avatarUrl,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('GetMe error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching user profile',
    });
  }
};

// @desc    Update user profile details
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, savedAddress, avatarUrl } = req.body;
    const user = req.user;

    if (name !== undefined) user.name = name;
    if (savedAddress !== undefined) user.savedAddress = savedAddress;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        institutionId: user.institutionId,
        vendorId: user.vendorId,
        savedAddress: user.savedAddress,
        avatarUrl: user.avatarUrl,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('updateProfile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile.',
    });
  }
};

// @desc    Change user password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Both current password and new password are required.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.',
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password provided is incorrect.',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully!',
    });
  } catch (error) {
    console.error('changePassword error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to change password.',
    });
  }
};

// @desc    Explicit endpoint to trigger seeding if needed
// @route   POST /api/auth/seed
// @access  Public
const seedUsers = async (req, res) => {
  try {
    await initDb();
    return res.status(200).json({
      success: true,
      message: 'Database check and seeding executed.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getPublicInstitutions,
  registerStudent,
  login,
  getMe,
  updateProfile,
  changePassword,
  seedUsers,
};
