const express = require('express');
const {
  getHomeData,
  getVendorDetails,
  getProductDetails,
  createOrder,
  getOrderDetails,
  getOrders,
  createReview,
  createStudentComplaint,
  getStudentComplaints,
  searchMarketplace,
} = require('../controllers/studentController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/home', protect, getHomeData);
router.get('/vendors/:id', protect, getVendorDetails);
router.get('/products/:id', protect, getProductDetails);
router.post('/orders', protect, createOrder);
router.get('/orders', protect, getOrders);
router.get('/orders/:id', protect, getOrderDetails);
router.post('/reviews', protect, createReview);

router.post('/complaints', protect, createStudentComplaint);
router.get('/complaints', protect, getStudentComplaints);

router.get('/search', protect, searchMarketplace);

module.exports = router;
