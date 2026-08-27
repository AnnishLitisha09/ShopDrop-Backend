const express = require('express');
const {
  getDashboardStats,
  getVendorApplications,
  updateVendorApplicationStatus,
  getVendorsList,
  updateVendorStatus,
  createVendor,
  downloadVendorTemplate,
  validateVendorImport,
  importVendors,
  getComplaints,
  updateComplaintStatus,
  getInstitutionAnalytics,
  getStudents,
  getStudentDetails,
  createStudent,
  downloadStudentTemplate,
  validateStudentImport,
  importStudents,
  updateStudent,
  updateStudentStatus,
} = require('../controllers/institutionAdminController');
const { protect, requireRole } = require('../middleware/authMiddleware');
const { excelUpload } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.get('/dashboard', protect, requireRole('institution_admin'), getDashboardStats);
router.get('/analytics', protect, requireRole('institution_admin'), getInstitutionAnalytics);

// Student Directory Management & Excel Import routes
router.get('/students', protect, requireRole('institution_admin'), getStudents);
router.get('/students/template', protect, requireRole('institution_admin'), downloadStudentTemplate);
router.post('/students/validate-import', protect, requireRole('institution_admin'), excelUpload.single('file'), validateStudentImport);
router.post('/students/import', protect, requireRole('institution_admin'), importStudents);
router.get('/students/:id', protect, requireRole('institution_admin'), getStudentDetails);
router.post('/students', protect, requireRole('institution_admin'), createStudent);
router.put('/students/:id', protect, requireRole('institution_admin'), updateStudent);
router.patch('/students/:id/status', protect, requireRole('institution_admin'), updateStudentStatus);

// Vendor Application, Directory & Excel Import routes
router.get('/vendor-applications', protect, requireRole('institution_admin'), getVendorApplications);
router.patch('/vendor-applications/:id/status', protect, requireRole('institution_admin'), updateVendorApplicationStatus);

router.get('/vendors', protect, requireRole('institution_admin'), getVendorsList);
router.get('/vendors/template', protect, requireRole('institution_admin'), downloadVendorTemplate);
router.post('/vendors/validate-import', protect, requireRole('institution_admin'), excelUpload.single('file'), validateVendorImport);
router.post('/vendors/import', protect, requireRole('institution_admin'), importVendors);
router.post('/vendors', protect, requireRole('institution_admin'), createVendor);
router.patch('/vendors/:id/status', protect, requireRole('institution_admin'), updateVendorStatus);

// Student-Vendor Complaint Dispute routes
router.get('/complaints', protect, requireRole('institution_admin'), getComplaints);
router.patch('/complaints/:id/status', protect, requireRole('institution_admin'), updateComplaintStatus);

module.exports = router;
