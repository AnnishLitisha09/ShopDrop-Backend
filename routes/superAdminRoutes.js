const express = require('express');
const {
  getDashboardStats,
  getInstitutionsList,
  updateInstitutionStatus,
  getSuperAdminAnalytics,
} = require('../controllers/superAdminController');
const { protect, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/dashboard', protect, requireRole('super_admin'), getDashboardStats);
router.get('/analytics', protect, requireRole('super_admin'), getSuperAdminAnalytics);

// Institution Management Directory routes
router.get('/institutions', protect, requireRole('super_admin'), getInstitutionsList);
router.patch('/institutions/:id/status', protect, requireRole('super_admin'), updateInstitutionStatus);

module.exports = router;
