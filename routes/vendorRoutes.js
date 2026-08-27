const express = require('express');
const {
  getDashboardStats,
  updateVendorStatus,
  getVendorOrders,
  updateOrderStatus,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getVendorAnalytics,
  getVendorComplaints,
} = require('../controllers/vendorController');
const { protect, requireRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

// Dashboard & Analytics routes
router.get('/dashboard', protect, requireRole('vendor'), getDashboardStats);
router.get('/analytics', protect, requireRole('vendor'), getVendorAnalytics);
router.get('/complaints', protect, requireRole('vendor'), getVendorComplaints);
router.patch('/status', protect, requireRole('vendor'), updateVendorStatus);

// Order queue routes
router.get('/orders', protect, requireRole('vendor'), getVendorOrders);
router.patch('/orders/:id/status', protect, requireRole('vendor'), updateOrderStatus);

// Product catalog routes
router.get('/products', protect, requireRole('vendor'), getProducts);
router.post('/products', protect, requireRole('vendor'), createProduct);
router.put('/products/:id', protect, requireRole('vendor'), updateProduct);
router.delete('/products/:id', protect, requireRole('vendor'), deleteProduct);

// Image file upload route
router.post('/upload', protect, requireRole('vendor'), upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file uploaded.' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  return res.status(200).json({
    success: true,
    message: 'Image uploaded successfully!',
    imageUrl: fileUrl,
  });
});

module.exports = router;
