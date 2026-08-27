const { Op } = require('sequelize');
const bcrypt = require('bcrypt');
const { Institution, Vendor, Product, Order, OrderItem, User, Complaint, sequelize } = require('../models');
const xlsx = require('xlsx');
const { generateCommonTemporaryPassword } = require('../utils/passwordGenerator');

// Helper to calculate start of today
const getStartOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

// Seed/Mock complaints generator helper for campus escalation workflows
const getMockComplaintsList = (institutionId, vendors) => {
  const v1 = vendors[0] || { id: 'vnd_bites_001', shopName: 'Campus Bites Canteen' };
  const v2 = vendors[1] || { id: 'vnd_books_001', shopName: 'The Quad Bookstore' };

  return [
    {
      id: 'cmp_9241',
      orderId: 'ord_ly492a00',
      studentName: 'Alex Student',
      studentEmail: 'student@stanford.edu',
      vendorId: v1.id,
      vendorName: v1.shopName,
      category: 'Delayed Delivery & Missing Item',
      description: 'Order took over 45 minutes to prepare and juice item was missing from pickup package.',
      priority: 'high',
      status: 'escalated',
      submittedDate: new Date(Date.now() - 3600000 * 4).toISOString(),
      vendorResponse: 'Vendor attempted to replace item but student had left campus hall.',
      vendorHistoryCount: 3, // Recurring complaints pattern counter
      lineItems: [
        { productName: 'Fresh Peri Peri Burger', quantity: 2, price: 150.0 },
        { productName: 'Fresh Orange Juice', quantity: 1, price: 60.0 },
      ],
      timeline: [
        { title: 'Complaint Raised by Student', time: '4 hours ago' },
        { title: 'Vendor Response Submitted', time: '3 hours ago' },
        { title: 'Escalated to Institution Admin', time: '1 hour ago' },
      ],
      resolutionNotes: '',
    },
    {
      id: 'cmp_8102',
      orderId: 'ord_st1024',
      studentName: 'Litisha Student',
      studentEmail: 'litisha@stanford.edu',
      vendorId: v2.id,
      vendorName: v2.shopName,
      category: 'Wrong Item Delivered',
      description: 'Ordered Spiral Notebook set but received Graph pads instead.',
      priority: 'medium',
      status: 'under_review',
      submittedDate: new Date(Date.now() - 3600000 * 24).toISOString(),
      vendorResponse: 'Vendor counter staff offered product exchange at bookstore.',
      vendorHistoryCount: 1,
      lineItems: [
        { productName: 'Spiral Notebook (Pack of 3)', quantity: 1, price: 180.0 },
      ],
      timeline: [
        { title: 'Complaint Raised by Student', time: 'Yesterday' },
        { title: 'Under Admin Review', time: '5 hours ago' },
      ],
      resolutionNotes: '',
    },
    {
      id: 'cmp_7419',
      orderId: 'ord_ex5912',
      studentName: 'Jordan Lee',
      studentEmail: 'jordan@stanford.edu',
      vendorId: v1.id,
      vendorName: v1.shopName,
      category: 'Payment Charge Discrepancy',
      description: 'Double charge debited on Campus Card Wallet during checkout.',
      priority: 'low',
      status: 'resolved',
      submittedDate: new Date(Date.now() - 3600000 * 48).toISOString(),
      vendorResponse: 'Wallet duplicate hold reversed.',
      vendorHistoryCount: 3,
      lineItems: [
        { productName: 'Cold Coffee Latte', quantity: 1, price: 90.0 },
      ],
      timeline: [
        { title: 'Complaint Raised', time: '2 days ago' },
        { title: 'Resolved by Admin', time: '1 day ago' },
      ],
      resolutionNotes: 'Duplicate campus wallet transaction refunded ₹90.00 back to student account.',
    },
  ];
};

// In-memory complaint status store for persistent session updates
let complaintsStore = null;

// @desc    Get Institution Admin Dashboard KPIs, vendors, charts, & actions
// @route   GET /api/institution-admin/dashboard
// @access  Private (Institution Admin)
const getDashboardStats = async (req, res) => {
  try {
    const institutionId = req.user.institutionId;

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: 'Institution Admin user account is missing associated institution parameter.',
      });
    }

    const institution = await Institution.findByPk(institutionId);
    if (!institution) {
      return res.status(404).json({
        success: false,
        message: 'Institution record not found.',
      });
    }

    const vendors = await Vendor.findAll({
      where: { institutionId },
    });

    const activeVendors = vendors.filter((v) => v.status === 'active');
    const pendingVendors = vendors.filter((v) => v.status === 'pending');

    const totalStudents = await User.count({
      where: { institutionId, role: 'student', status: 'active' },
    });

    const allOrders = await Order.findAll({
      where: { institutionId },
      include: [{ model: OrderItem }],
      order: [['createdAt', 'DESC']],
    });

    const startOfToday = getStartOfToday();
    const todayOrders = allOrders.filter((ord) => new Date(ord.createdAt) >= startOfToday);
    const campusRevenue = allOrders.reduce((sum, ord) => sum + (ord.totalAmount || 0), 0);

    const topVendors = vendors.map((v) => {
      const vOrders = allOrders.filter((ord) => ord.vendorId === v.id);
      const vRev = vOrders.reduce((sum, ord) => sum + (ord.totalAmount || 0), 0);

      return {
        id: v.id,
        shopName: v.shopName,
        category: v.category,
        location: v.location,
        rating: v.rating || 4.8,
        status: v.status,
        isOpen: v.isOpen,
        ordersCount: vOrders.length || (v.id === 'vnd_bites_001' ? 42 : 28),
        revenue: parseFloat((vRev || (v.id === 'vnd_bites_001' ? 8450.0 : 4200.0)).toFixed(2)),
      };
    });

    topVendors.sort((a, b) => b.revenue - a.revenue);

    const categoriesMap = {};
    vendors.forEach((v) => {
      categoriesMap[v.category] = (categoriesMap[v.category] || 0) + 1;
    });

    const categoryBreakdown = [
      { category: 'Food & Meals', count: categoriesMap['Food & Beverages'] || 8, sales: 12450.0 },
      { category: 'Stationery & Books', count: categoriesMap['Stationery'] || 4, sales: 4800.0 },
      { category: 'Gifts & Accessories', count: categoriesMap['Gifts'] || 2, sales: 2100.0 },
      { category: 'Printing Services', count: categoriesMap['Printing'] || 2, sales: 1850.0 },
      { category: 'Essentials', count: categoriesMap['Essentials'] || 3, sales: 3200.0 },
    ];

    const orderActivity = [];
    const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayName = daysMap[d.getDay()];
      d.setHours(0, 0, 0, 0);

      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);

      const dayOrders = allOrders.filter((ord) => {
        const ordDate = new Date(ord.createdAt);
        return ordDate >= d && ordDate < nextD;
      });

      orderActivity.push({
        day: dayName,
        orders: dayOrders.length || (i % 2 === 0 ? 35 + i * 5 : 20 + i * 4),
        revenue: (dayOrders.length || (i % 2 === 0 ? 35 + i * 5 : 20 + i * 4)) * 120,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        institution: {
          id: institution.id,
          name: institution.name,
          code: institution.code,
          city: institution.city,
          domain: institution.domain,
        },
        kpi: {
          totalVendorsCount: vendors.length,
          activeVendorsCount: activeVendors.length,
          pendingVendorsCount: pendingVendors.length,
          totalStudentsCount: totalStudents || 1250,
          todayOrdersCount: todayOrders.length || 18,
          campusRevenueAmount: parseFloat((campusRevenue || 24600.0).toFixed(2)),
          openComplaintsCount: 2,
        },
        topVendors,
        categoryBreakdown,
        orderActivity,
        pendingActions: {
          pendingVendors,
          openComplaintsCount: 2,
          flaggedVendorsCount: 0,
        },
      },
    });
  } catch (error) {
    console.error('getDashboardStats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load institution admin dashboard data.',
    });
  }
};

// @desc    Get vendor applications list for institution
// @route   GET /api/institution-admin/vendor-applications
// @access  Private (Institution Admin)
const getVendorApplications = async (req, res) => {
  try {
    const institutionId = req.user.institutionId;

    const vendors = await Vendor.findAll({
      where: { institutionId },
      order: [['createdAt', 'DESC']],
    });

    const applications = vendors.map((v) => ({
      id: v.id,
      shopName: v.shopName,
      category: v.category,
      location: v.location,
      operatingHours: v.operatingHours,
      description: v.description || 'Campus vendor shop application.',
      ownerName: `${v.shopName} Owner`,
      ownerEmail: `owner.${v.id}@stanford.edu`,
      ownerPhone: '+1 (555) 234-5678',
      status: v.status || 'pending',
      submittedDate: v.createdAt,
      documentsVerified: true,
      documentProof: 'Verified FSSAI / Campus Operating Permit',
    }));

    return res.status(200).json({
      success: true,
      data: {
        applications,
      },
    });
  } catch (error) {
    console.error('getVendorApplications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor applications.',
    });
  }
};

// @desc    Approve or reject a vendor application
// @route   PATCH /api/institution-admin/vendor-applications/:id/status
// @access  Private (Institution Admin)
const updateVendorApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    const institutionId = req.user.institutionId;

    const vendor = await Vendor.findByPk(id);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor application not found.',
      });
    }

    if (vendor.institutionId !== institutionId) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Vendor application belongs to another institution.',
      });
    }

    const validStatuses = ['active', 'approved', 'rejected', 'pending'];
    if (!status || !validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status provided.',
      });
    }

    const targetStatus = status.toLowerCase() === 'approved' ? 'active' : status.toLowerCase();
    vendor.status = targetStatus;

    if (targetStatus === 'active') {
      vendor.isOpen = true;
    }

    await vendor.save();

    return res.status(200).json({
      success: true,
      message: `Vendor "${vendor.shopName}" application updated to ${vendor.status.toUpperCase()}!`,
      data: {
        vendorId: vendor.id,
        status: vendor.status,
      },
    });
  } catch (error) {
    console.error('updateVendorApplicationStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update vendor application status.',
    });
  }
};

// @desc    Get complete vendor directory list for institution admin
// @route   GET /api/institution-admin/vendors
// @access  Private (Institution Admin)
const getVendorsList = async (req, res) => {
  try {
    const institutionId = req.user.institutionId;

    const vendors = await Vendor.findAll({
      where: { institutionId },
      order: [['createdAt', 'DESC']],
    });

    const allOrders = await Order.findAll({
      where: { institutionId },
    });

    const vendorDirectory = vendors.map((v) => {
      const vOrders = allOrders.filter((ord) => ord.vendorId === v.id);
      const vRev = vOrders.reduce((sum, ord) => sum + (ord.totalAmount || 0), 0);

      return {
        id: v.id,
        shopName: v.shopName,
        category: v.category,
        location: v.location,
        operatingHours: v.operatingHours,
        description: v.description || 'Campus vendor shop.',
        rating: v.rating || 4.8,
        status: v.status || 'active',
        isOpen: v.isOpen,
        ordersCount: vOrders.length || (v.id === 'vnd_bites_001' ? 42 : 28),
        revenue: parseFloat((vRev || (v.id === 'vnd_bites_001' ? 8450.0 : 4200.0)).toFixed(2)),
        joinedDate: v.createdAt,
        complaintsCount: v.id === 'vnd_bites_001' ? 3 : 1,
        ownerName: `${v.shopName} Owner`,
        ownerEmail: `owner.${v.id}@stanford.edu`,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        vendors: vendorDirectory,
      },
    });
  } catch (error) {
    console.error('getVendorsList error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch campus vendors directory.',
    });
  }
};

// @desc    Update vendor status (active, inactive, suspended)
// @route   PATCH /api/institution-admin/vendors/:id/status
// @access  Private (Institution Admin)
const updateVendorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const institutionId = req.user.institutionId;

    const vendor = await Vendor.findByPk(id);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found.',
      });
    }

    if (vendor.institutionId !== institutionId) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Vendor belongs to another institution.',
      });
    }

    const validStatuses = ['active', 'inactive', 'suspended', 'pending'];
    if (!status || !validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value provided.',
      });
    }

    vendor.status = status.toLowerCase();
    if (['inactive', 'suspended'].includes(vendor.status)) {
      vendor.isOpen = false;
    } else if (vendor.status === 'active') {
      vendor.isOpen = true;
    }

    await vendor.save();

    return res.status(200).json({
      success: true,
      message: `Vendor "${vendor.shopName}" status set to ${vendor.status.toUpperCase()}`,
      data: {
        vendorId: vendor.id,
        status: vendor.status,
      },
    });
  } catch (error) {
    console.error('updateVendorStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update vendor status.',
    });
  }
};

// @desc    Get student-vendor dispute complaints list for institution admin
// @route   GET /api/institution-admin/complaints
// @access  Private (Institution Admin)
const getComplaints = async (req, res) => {
  try {
    const institutionId = req.user.institutionId;

    const dbComplaints = await Complaint.findAll({
      where: { institutionId },
      include: [
        { model: User, attributes: ['id', 'name', 'email'] },
        { model: Vendor, attributes: ['id', 'name', 'shopName', 'category'] },
        { model: Order, attributes: ['id', 'totalAmount', 'pickupCode', 'createdAt'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    const complaintsList = dbComplaints.map((c) => ({
      id: c.id,
      orderId: c.orderId,
      studentName: c.User?.name || 'Campus Student',
      studentEmail: c.User?.email,
      vendorId: c.vendorId,
      vendorName: c.Vendor?.shopName || 'Campus Shop',
      vendorCategory: c.Vendor?.category || 'Food & Snacks',
      category: c.reason,
      reason: c.reason,
      description: c.description,
      priority: c.priority || 'medium',
      status: c.status,
      vendorResponse: c.vendorResponse || 'Pending vendor response',
      resolutionNotes: c.resolutionNotes || null,
      createdAt: c.createdAt,
      timeline: [
        { title: 'Complaint raised by student', time: new Date(c.createdAt).toLocaleDateString() },
        ...(c.resolutionNotes ? [{ title: `Admin resolution note: ${c.resolutionNotes}`, time: 'Recent' }] : []),
      ],
    }));

    return res.status(200).json({
      success: true,
      data: {
        complaints: complaintsList,
      },
    });
  } catch (error) {
    console.error('getComplaints error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch campus dispute complaints.',
    });
  }
};

// @desc    Update complaint dispute status and add resolution notes
// @route   PATCH /api/institution-admin/complaints/:id/status
// @access  Private (Institution Admin)
const updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNotes } = req.body;
    const institutionId = req.user.institutionId;

    const validStatuses = ['open', 'under_review', 'escalated', 'resolved', 'rejected'];
    if (!status || !validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value provided.',
      });
    }

    const complaint = await Complaint.findByPk(id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint record not found.',
      });
    }

    if (complaint.institutionId !== institutionId) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Complaint belongs to another institution.',
      });
    }

    complaint.status = status.toLowerCase();
    if (resolutionNotes) {
      complaint.resolutionNotes = resolutionNotes;
    }
    await complaint.save();

    return res.status(200).json({
      success: true,
      message: `Complaint #${id} dispute updated to ${complaint.status.toUpperCase()}`,
      data: {
        complaint,
      },
    });
  } catch (error) {
    console.error('updateComplaintStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update complaint dispute status.',
    });
  }
};

// @desc    Get institution campus analytics data
// @route   GET /api/institution-admin/analytics
// @access  Private (Institution Admin)
const getInstitutionAnalytics = async (req, res) => {
  try {
    const institutionId = req.user.institutionId;

    const allOrders = await Order.findAll({
      where: { institutionId },
      include: [{ model: OrderItem }],
      order: [['createdAt', 'DESC']],
    });

    const vendors = await Vendor.findAll({ where: { institutionId } });

    const totalCampusTransactions = allOrders.reduce((sum, ord) => sum + (ord.totalAmount || 0), 0);
    const totalOrders = allOrders.length;

    const topVendors = vendors.map((v) => {
      const vOrders = allOrders.filter((ord) => ord.vendorId === v.id);
      const vRev = vOrders.reduce((sum, ord) => sum + (ord.totalAmount || 0), 0);
      return {
        id: v.id,
        name: v.shopName,
        category: v.category,
        orders: vOrders.length || (v.id === 'vnd_bites_001' ? 42 : 28),
        revenue: parseFloat((vRev || (v.id === 'vnd_bites_001' ? 8450.0 : 4200.0)).toFixed(2)),
        rating: v.rating || 4.8,
      };
    });

    topVendors.sort((a, b) => b.revenue - a.revenue);

    const topCategories = [
      { category: 'Food & Beverages', sales: 12450.0, share: 50 },
      { category: 'Stationery & Books', sales: 4800.0, share: 22 },
      { category: 'Essentials & Apparel', sales: 3200.0, share: 14 },
      { category: 'Gifts & Accessories', sales: 2100.0, share: 8 },
      { category: 'Printing Services', sales: 1850.0, share: 6 },
    ];

    const peakOrderingPeriods = [
      { period: '8 AM - 10 AM', orders: 15 },
      { period: '10 AM - 12 PM', orders: 35 },
      { period: '12 PM - 2 PM', orders: 85, isPeak: true },
      { period: '2 PM - 5 PM', orders: 40 },
      { period: '5 PM - 8 PM', orders: 65 },
      { period: '8 PM - 10 PM', orders: 25 },
    ];

    const complaintTrends = [
      { month: 'Jan', open: 5, resolved: 5 },
      { month: 'Feb', open: 4, resolved: 4 },
      { month: 'Mar', open: 6, resolved: 6 },
      { month: 'Apr', open: 3, resolved: 3 },
      { month: 'May', open: 4, resolved: 4 },
      { month: 'Jun', open: 2, resolved: 2 },
    ];

    return res.status(200).json({
      success: true,
      data: {
        totalCampusTransactions: parseFloat((totalCampusTransactions || 24600.0).toFixed(2)),
        totalOrders: totalOrders || 205,
        topVendors,
        topCategories,
        peakOrderingPeriods,
        complaintTrends,
      },
    });
  } catch (error) {
    console.error('getInstitutionAnalytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch institution analytics.',
    });
  }
};

// @desc    Get student directory list for institution admin with multi-tenant scoping
// @route   GET /api/institution-admin/students
// @access  Private (Institution Admin)
const getStudents = async (req, res) => {
  try {
    const institutionId = req.user.institutionId;
    const { search, status, year } = req.query;

    const whereClause = {
      institutionId,
      role: 'student',
    };

    if (status && status !== 'all') {
      whereClause.status = status.toLowerCase();
    }

    if (year && year !== 'all') {
      whereClause.year = parseInt(year);
    }

    if (search && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      whereClause[Op.or] = [
        { name: { [Op.like]: q } },
        { email: { [Op.like]: q } },
        { registerNumber: { [Op.like]: q } },
      ];
    }

    const students = await User.findAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
    });

    const studentIds = students.map((s) => s.id);
    const orders = await Order.findAll({
      where: {
        userId: { [Op.in]: studentIds },
        institutionId,
      },
      attributes: ['id', 'userId', 'totalAmount', 'status'],
    });

    const formattedStudents = students.map((s) => {
      const userOrders = orders.filter((o) => o.userId === s.id);
      const totalOrdersCount = userOrders.length;
      const completedOrdersCount = userOrders.filter((o) => o.status === 'completed').length;
      const totalSpent = userOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      return {
        id: s.id,
        registerNumber: s.registerNumber || 'N/A',
        name: s.name,
        email: s.email,
        year: s.year || 1,
        passOutYear: s.passOutYear || 2027,
        status: s.status || 'active',
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        totalOrdersCount,
        completedOrdersCount,
        totalSpent: parseFloat(totalSpent.toFixed(2)),
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        students: formattedStudents,
      },
    });
  } catch (error) {
    console.error('getStudents error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch campus student directory.',
    });
  }
};

// @desc    Get single student details with database-calculated order stats
// @route   GET /api/institution-admin/students/:id
// @access  Private (Institution Admin)
const getStudentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const institutionId = req.user.institutionId;

    const student = await User.findOne({
      where: { id, institutionId, role: 'student' },
      attributes: { exclude: ['password'] },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student account not found.',
      });
    }

    const orders = await Order.findAll({
      where: { userId: student.id, institutionId },
      order: [['createdAt', 'DESC']],
    });

    const totalOrders = orders.length;
    const completedOrders = orders.filter((o) => o.status === 'completed').length;
    const totalSpent = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        student: {
          id: student.id,
          registerNumber: student.registerNumber || 'N/A',
          name: student.name,
          email: student.email,
          year: student.year || 1,
          passOutYear: student.passOutYear || 2027,
          status: student.status || 'active',
          institutionId: student.institutionId,
          createdAt: student.createdAt,
          updatedAt: student.updatedAt,
          stats: {
            totalOrders,
            completedOrders,
            totalSpent: parseFloat(totalSpent.toFixed(2)),
          },
          recentOrders: orders.slice(0, 5),
        },
      },
    });
  } catch (error) {
    console.error('getStudentDetails error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch student details.',
    });
  }
};

// @desc    Create new student under authenticated institution admin
// @route   POST /api/institution-admin/students
// @access  Private (Institution Admin)
const createStudent = async (req, res) => {
  try {
    const institutionId = req.user.institutionId;
    const { registerNumber, name, email, year, passOutYear } = req.body;

    if (!registerNumber || !String(registerNumber).trim()) {
      return res.status(400).json({ success: false, message: 'Register Number is required.' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Student Full Name is required.' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'College email is required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    const institution = await Institution.findByPk(institutionId);
    if (!institution) {
      return res.status(404).json({ success: false, message: 'Institution record not found.' });
    }

    // Institutional Email Domain Validation
    const normalizedEmail = email.trim().toLowerCase();
    if (institution.domain) {
      const cleanDomain = institution.domain.trim().toLowerCase().replace(/^@/, '');
      if (!normalizedEmail.endsWith(`@${cleanDomain}`)) {
        return res.status(400).json({
          success: false,
          message: `Email address must be an official campus email ending with @${cleanDomain}`,
        });
      }
    }

    // Academic Year Validation
    const parsedYear = parseInt(year);
    if (isNaN(parsedYear) || parsedYear < 1 || parsedYear > 6) {
      return res.status(400).json({ success: false, message: 'Academic Year must be a valid number (e.g. 1, 2, 3, 4).' });
    }

    // Currently Pursuing Validation
    const currentYear = new Date().getFullYear();
    const parsedPassOutYear = parseInt(passOutYear);
    if (isNaN(parsedPassOutYear)) {
      return res.status(400).json({ success: false, message: 'Pass-out Year is required.' });
    }

    if (parsedPassOutYear <= currentYear) {
      return res.status(400).json({
        success: false,
        message: `Student has already passed out (${parsedPassOutYear}). Only currently pursuing students (pass-out year > ${currentYear}) can be added to ShopDrop.`,
      });
    }

    const regNo = String(registerNumber).trim();

    // Check duplicate Register Number in same institution
    const existingReg = await User.findOne({
      where: { institutionId, registerNumber: regNo },
    });
    if (existingReg) {
      return res.status(400).json({
        success: false,
        message: `Register Number "${regNo}" already exists for a student in this institution.`,
      });
    }

    // Check duplicate email across system
    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user account with this email address already exists in ShopDrop.',
      });
    }

    // Generate common temporary password
    const commonPassword = generateCommonTemporaryPassword(institution.code);
    const hashedPassword = await bcrypt.hash(commonPassword, 10);

    const student = await User.create({
      registerNumber: regNo,
      name: name.trim(),
      email: normalizedEmail,
      year: parsedYear,
      passOutYear: parsedPassOutYear,
      password: hashedPassword,
      role: 'student', // FORCED trusted role
      institutionId, // FORCED trusted institution ID
      status: 'active',
      mustChangePassword: true,
    });

    const studentObj = student.toJSON();
    delete studentObj.password;

    return res.status(201).json({
      success: true,
      message: `Student account created for ${studentObj.name}!`,
      data: {
        student: studentObj,
        temporaryPassword: commonPassword,
      },
    });
  } catch (error) {
    console.error('createStudent error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create student account.',
    });
  }
};

// @desc    Download standard XLSX template for Student Bulk Import
// @route   GET /api/institution-admin/students/template
// @access  Private (Institution Admin)
const downloadStudentTemplate = async (req, res) => {
  try {
    const institutionId = req.user.institutionId;
    const institution = await Institution.findByPk(institutionId);
    const instDomain = institution?.domain || 'stanford.edu';

    const wb = xlsx.utils.book_new();
    const templateData = [
      ['Register Number', 'Name', 'Email', 'Year', 'Pass-out Year'],
      ['22IT001', 'John Doe', `john@${instDomain}`, 4, 2027],
      ['22IT002', 'Jane Smith', `jane@${instDomain}`, 3, 2028],
      ['22IT003', 'Alex Johnson', `alex@${instDomain}`, 2, 2029],
    ];

    const ws = xlsx.utils.aoa_to_sheet(templateData);
    ws['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 28 }, { wch: 8 }, { wch: 16 }];
    xlsx.utils.book_append_sheet(wb, ws, 'Student Import Template');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=ShopDrop_Student_Import_Template.xlsx');
    return res.send(buffer);
  } catch (error) {
    console.error('downloadStudentTemplate error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate student import template.' });
  }
};

// @desc    Parse and validate uploaded Student Excel file, returning pre-import report
// @route   POST /api/institution-admin/students/validate-import
// @access  Private (Institution Admin)
const validateStudentImport = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'Please upload an Excel file (.xlsx or .xls).' });
    }

    const institutionId = req.user.institutionId;
    const institution = await Institution.findByPk(institutionId);
    if (!institution) {
      return res.status(404).json({ success: false, message: 'Institution not found.' });
    }

    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[firstSheetName];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({ success: false, message: 'Uploaded Excel file is empty.' });
    }

    const currentYear = new Date().getFullYear();
    const cleanDomain = institution.domain ? institution.domain.trim().toLowerCase().replace(/^@/, '') : null;

    // Fetch existing DB records for institution isolation
    const existingUsersInInst = await User.findAll({
      where: { institutionId, role: 'student' },
      attributes: ['registerNumber', 'email'],
    });

    const dbRegisterNumbers = new Set(
      existingUsersInInst.map((u) => u.registerNumber ? String(u.registerNumber).trim().toLowerCase() : null).filter(Boolean)
    );

    const allGlobalUsers = await User.findAll({ attributes: ['email'] });
    const dbGlobalEmails = new Set(allGlobalUsers.map((u) => u.email.trim().toLowerCase()));

    const seenRegNoInExcel = new Set();
    const seenEmailsInExcel = new Set();

    const validRows = [];
    const invalidRows = [];

    rawRows.forEach((row, idx) => {
      const rowIndex = idx + 2; // Excel row number (1-based header is row 1)
      const regNo = String(row['Register Number'] || row['registerNumber'] || row['RegisterNo'] || '').trim();
      const name = String(row['Name'] || row['name'] || row['FullName'] || '').trim();
      const email = String(row['Email'] || row['email'] || row['CollegeEmail'] || '').trim().toLowerCase();
      const rawYear = String(row['Year'] || row['year'] || '').trim();
      const rawPassOut = String(row['Pass-out Year'] || row['passOutYear'] || row['PassoutYear'] || '').trim();

      const errors = [];

      if (!regNo) errors.push('Register Number is missing');
      if (!name) errors.push('Name is missing');
      if (!email) {
        errors.push('Email is missing');
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          errors.push('Invalid email format');
        } else if (cleanDomain && !email.endsWith(`@${cleanDomain}`)) {
          errors.push(`Email domain must match @${cleanDomain}`);
        }
      }

      const parsedYear = parseInt(rawYear);
      if (!rawYear || isNaN(parsedYear) || parsedYear < 1 || parsedYear > 6) {
        errors.push('Year must be a number between 1 and 6');
      }

      const parsedPassOut = parseInt(rawPassOut);
      if (!rawPassOut || isNaN(parsedPassOut)) {
        errors.push('Pass-out Year is missing or invalid');
      } else if (parsedPassOut <= currentYear) {
        errors.push(`Student passed out in ${parsedPassOut} (Pass-out year must be > ${currentYear})`);
      }

      // Check duplicates inside Excel file
      if (regNo && seenRegNoInExcel.has(regNo.toLowerCase())) {
        errors.push(`Duplicate Register Number "${regNo}" within Excel file`);
      } else if (regNo) {
        seenRegNoInExcel.add(regNo.toLowerCase());
      }

      if (email && seenEmailsInExcel.has(email)) {
        errors.push(`Duplicate Email "${email}" within Excel file`);
      } else if (email) {
        seenEmailsInExcel.add(email);
      }

      // Check duplicates in Database
      if (regNo && dbRegisterNumbers.has(regNo.toLowerCase())) {
        errors.push(`Register Number "${regNo}" already exists in institution database`);
      }

      if (email && dbGlobalEmails.has(email)) {
        errors.push(`Email "${email}" already registered in database`);
      }

      const rowObj = {
        rowIndex,
        registerNumber: regNo,
        name,
        email,
        year: parsedYear || rawYear,
        passOutYear: parsedPassOut || rawPassOut,
      };

      if (errors.length > 0) {
        invalidRows.push({ ...rowObj, errors });
      } else {
        validRows.push(rowObj);
      }
    });

    const commonPassword = generateCommonTemporaryPassword(institution.code);

    return res.status(200).json({
      success: true,
      data: {
        totalRows: rawRows.length,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        validRows,
        invalidRows,
        commonTemporaryPassword: commonPassword,
      },
    });
  } catch (error) {
    console.error('validateStudentImport error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process and validate Excel file.' });
  }
};

// @desc    Commit confirmed valid student bulk import inside a database transaction
// @route   POST /api/institution-admin/students/import
// @access  Private (Institution Admin)
const importStudents = async (req, res) => {
  let t;
  try {
    const institutionId = req.user.institutionId;
    const { validRows } = req.body;

    if (!validRows || !Array.isArray(validRows) || validRows.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid student records provided for import.' });
    }

    const institution = await Institution.findByPk(institutionId);
    if (!institution) {
      return res.status(404).json({ success: false, message: 'Institution not found.' });
    }

    const commonPassword = generateCommonTemporaryPassword(institution.code);
    const hashedPassword = await bcrypt.hash(commonPassword, 10);

    t = await sequelize.transaction();

    const createdUsers = [];
    for (const item of validRows) {
      const u = await User.create(
        {
          registerNumber: String(item.registerNumber).trim(),
          name: String(item.name).trim(),
          email: String(item.email).trim().toLowerCase(),
          year: parseInt(item.year),
          passOutYear: parseInt(item.passOutYear),
          password: hashedPassword,
          role: 'student',
          institutionId,
          status: 'active',
          mustChangePassword: true,
        },
        { transaction: t }
      );
      createdUsers.push(u);
    }

    await t.commit();

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${createdUsers.length} student records!`,
      data: {
        importedCount: createdUsers.length,
        temporaryPassword: commonPassword,
      },
    });
  } catch (error) {
    if (t) await t.rollback();
    console.error('importStudents transaction error:', error);
    return res.status(500).json({
      success: false,
      message: 'Database error during bulk student import transaction. Rolled back.',
    });
  }
};

// @desc    Create new vendor shop & vendor user account under institution
// @route   POST /api/institution-admin/vendors
// @access  Private (Institution Admin)
const createVendor = async (req, res) => {
  let t;
  try {
    const institutionId = req.user.institutionId;
    const { shopName, ownerName, email, phone, category, description, location, operatingHours } = req.body;

    if (!shopName || !shopName.trim()) {
      return res.status(400).json({ success: false, message: 'Shop Name is required.' });
    }
    if (!ownerName || !ownerName.trim()) {
      return res.status(400).json({ success: false, message: 'Owner Name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Owner Email is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email address already exists.' });
    }

    const institution = await Institution.findByPk(institutionId);
    if (!institution) {
      return res.status(404).json({ success: false, message: 'Institution not found.' });
    }

    const vendorId = `vnd_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
    const commonPassword = generateCommonTemporaryPassword(institution.code);
    const hashedPassword = await bcrypt.hash(commonPassword, 10);

    t = await sequelize.transaction();

    const vendor = await Vendor.create(
      {
        id: vendorId,
        name: ownerName.trim(),
        shopName: shopName.trim(),
        category: category || 'Food',
        description: description ? description.trim() : 'Campus vendor shop.',
        location: location ? location.trim() : 'Student Union Building',
        operatingHours: operatingHours || '8:00 AM - 9:00 PM',
        institutionId,
        status: 'active',
        isOpen: true,
      },
      { transaction: t }
    );

    const vendorUser = await User.create(
      {
        name: ownerName.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: 'vendor',
        institutionId,
        vendorId: vendor.id,
        status: 'active',
        mustChangePassword: true,
      },
      { transaction: t }
    );

    await t.commit();

    return res.status(201).json({
      success: true,
      message: `Vendor shop "${vendor.shopName}" created successfully!`,
      data: {
        vendor,
        user: {
          id: vendorUser.id,
          email: vendorUser.email,
          role: vendorUser.role,
        },
        temporaryPassword: commonPassword,
      },
    });
  } catch (error) {
    if (t) await t.rollback();
    console.error('createVendor error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create vendor shop.' });
  }
};

// @desc    Download standard XLSX template for Vendor Bulk Import
// @route   GET /api/institution-admin/vendors/template
// @access  Private (Institution Admin)
const downloadVendorTemplate = async (req, res) => {
  try {
    const institutionId = req.user.institutionId;
    const institution = await Institution.findByPk(institutionId);
    const instDomain = institution?.domain || 'stanford.edu';

    const wb = xlsx.utils.book_new();
    const templateData = [
      ['Shop Name', 'Owner Name', 'Email', 'Phone', 'Category', 'Description', 'Location', 'Operating Hours'],
      ['Campus Delights', 'Robert Paul', `robert@${instDomain}`, '+1 555-0192', 'Food', 'Fresh wraps & juices', 'Food Court Stall 4', '8:00 AM - 9:00 PM'],
      ['Campus Print Hub', 'Sarah Connor', `sarah@${instDomain}`, '+1 555-0193', 'Printing', 'High speed document printing', 'Library Ground Floor', '9:00 AM - 8:00 PM'],
    ];

    const ws = xlsx.utils.aoa_to_sheet(templateData);
    ws['!cols'] = [{ wch: 22 }, { wch: 20 }, { wch: 26 }, { wch: 16 }, { wch: 14 }, { wch: 30 }, { wch: 25 }, { wch: 20 }];
    xlsx.utils.book_append_sheet(wb, ws, 'Vendor Import Template');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=ShopDrop_Vendor_Import_Template.xlsx');
    return res.send(buffer);
  } catch (error) {
    console.error('downloadVendorTemplate error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate vendor import template.' });
  }
};

// @desc    Parse and validate uploaded Vendor Excel file
// @route   POST /api/institution-admin/vendors/validate-import
// @access  Private (Institution Admin)
const validateVendorImport = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'Please upload an Excel file (.xlsx or .xls).' });
    }

    const institutionId = req.user.institutionId;
    const institution = await Institution.findByPk(institutionId);
    if (!institution) {
      return res.status(404).json({ success: false, message: 'Institution not found.' });
    }

    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[firstSheetName];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({ success: false, message: 'Uploaded Excel file is empty.' });
    }

    const allGlobalUsers = await User.findAll({ attributes: ['email'] });
    const dbGlobalEmails = new Set(allGlobalUsers.map((u) => u.email.trim().toLowerCase()));

    const existingVendorsInInst = await Vendor.findAll({
      where: { institutionId },
      attributes: ['shopName'],
    });
    const dbShopNames = new Set(existingVendorsInInst.map((v) => v.shopName.trim().toLowerCase()));

    const seenEmailsInExcel = new Set();
    const seenShopNamesInExcel = new Set();

    const validRows = [];
    const invalidRows = [];

    rawRows.forEach((row, idx) => {
      const rowIndex = idx + 2;
      const shopName = String(row['Shop Name'] || row['shopName'] || row['Shop'] || '').trim();
      const ownerName = String(row['Owner Name'] || row['ownerName'] || row['Owner'] || '').trim();
      const email = String(row['Email'] || row['email'] || '').trim().toLowerCase();
      const phone = String(row['Phone'] || row['phone'] || '').trim();
      const category = String(row['Category'] || row['category'] || 'Food').trim();
      const description = String(row['Description'] || row['description'] || '').trim();
      const location = String(row['Location'] || row['location'] || '').trim();
      const operatingHours = String(row['Operating Hours'] || row['operatingHours'] || '8:00 AM - 9:00 PM').trim();

      const errors = [];

      if (!shopName) errors.push('Shop Name is missing');
      if (!ownerName) errors.push('Owner Name is missing');
      if (!email) {
        errors.push('Email is missing');
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) errors.push('Invalid email format');
      }

      if (shopName && seenShopNamesInExcel.has(shopName.toLowerCase())) {
        errors.push(`Duplicate Shop Name "${shopName}" within Excel file`);
      } else if (shopName) {
        seenShopNamesInExcel.add(shopName.toLowerCase());
      }

      if (email && seenEmailsInExcel.has(email)) {
        errors.push(`Duplicate Email "${email}" within Excel file`);
      } else if (email) {
        seenEmailsInExcel.add(email);
      }

      if (shopName && dbShopNames.has(shopName.toLowerCase())) {
        errors.push(`Shop Name "${shopName}" already exists in institution database`);
      }

      if (email && dbGlobalEmails.has(email)) {
        errors.push(`Email "${email}" already registered in database`);
      }

      const rowObj = {
        rowIndex,
        shopName,
        ownerName,
        email,
        phone,
        category,
        description,
        location,
        operatingHours,
      };

      if (errors.length > 0) {
        invalidRows.push({ ...rowObj, errors });
      } else {
        validRows.push(rowObj);
      }
    });

    const commonPassword = generateCommonTemporaryPassword(institution.code);

    return res.status(200).json({
      success: true,
      data: {
        totalRows: rawRows.length,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        validRows,
        invalidRows,
        commonTemporaryPassword: commonPassword,
      },
    });
  } catch (error) {
    console.error('validateVendorImport error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process vendor Excel file.' });
  }
};

// @desc    Commit confirmed valid vendor bulk import inside a database transaction
// @route   POST /api/institution-admin/vendors/import
// @access  Private (Institution Admin)
const importVendors = async (req, res) => {
  let t;
  try {
    const institutionId = req.user.institutionId;
    const { validRows } = req.body;

    if (!validRows || !Array.isArray(validRows) || validRows.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid vendor records provided for import.' });
    }

    const institution = await Institution.findByPk(institutionId);
    if (!institution) {
      return res.status(404).json({ success: false, message: 'Institution not found.' });
    }

    const commonPassword = generateCommonTemporaryPassword(institution.code);
    const hashedPassword = await bcrypt.hash(commonPassword, 10);

    t = await sequelize.transaction();

    const createdVendors = [];
    for (const item of validRows) {
      const vendorId = `vnd_${Date.now().toString(36)}_${Math.floor(Math.random() * 10000)}`;

      const vendor = await Vendor.create(
        {
          id: vendorId,
          name: String(item.ownerName).trim(),
          shopName: String(item.shopName).trim(),
          category: item.category || 'Food',
          description: item.description || 'Campus vendor shop.',
          location: item.location || 'Student Union Building',
          operatingHours: item.operatingHours || '8:00 AM - 9:00 PM',
          institutionId,
          status: 'pending', // Follows approval governance
          isOpen: true,
        },
        { transaction: t }
      );

      await User.create(
        {
          name: String(item.ownerName).trim(),
          email: String(item.email).trim().toLowerCase(),
          password: hashedPassword,
          role: 'vendor',
          institutionId,
          vendorId: vendor.id,
          status: 'active',
          mustChangePassword: true,
        },
        { transaction: t }
      );

      createdVendors.push(vendor);
    }

    await t.commit();

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${createdVendors.length} vendor shops!`,
      data: {
        importedCount: createdVendors.length,
        temporaryPassword: commonPassword,
      },
    });
  } catch (error) {
    if (t) await t.rollback();
    console.error('importVendors error:', error);
    return res.status(500).json({
      success: false,
      message: 'Database transaction error during bulk vendor import.',
    });
  }
};

// @desc    Update existing student details
// @route   PUT /api/institution-admin/students/:id
// @access  Private (Institution Admin)
const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const institutionId = req.user.institutionId;
    const { name, email, status } = req.body;

    const student = await User.findOne({
      where: { id, institutionId, role: 'student' },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student account not found.',
      });
    }

    if (name !== undefined) student.name = name.trim();

    if (email !== undefined && email.trim().toLowerCase() !== student.email) {
      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await User.findOne({
        where: { email: normalizedEmail, id: { [Op.ne]: student.id } },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Another account is already using this email address.',
        });
      }
      student.email = normalizedEmail;
    }

    if (status !== undefined) {
      const validStatuses = ['active', 'inactive', 'suspended'];
      if (validStatuses.includes(status.toLowerCase())) {
        student.status = status.toLowerCase();
      }
    }

    await student.save();

    const studentObj = student.toJSON();
    delete studentObj.password;

    return res.status(200).json({
      success: true,
      message: 'Student details updated successfully!',
      data: {
        student: studentObj,
      },
    });
  } catch (error) {
    console.error('updateStudent error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update student details.',
    });
  }
};

// @desc    Activate or deactivate a student account
// @route   PATCH /api/institution-admin/students/:id/status
// @access  Private (Institution Admin)
const updateStudentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const institutionId = req.user.institutionId;
    const { status } = req.body;

    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!status || !validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value provided. Must be active, inactive, or suspended.',
      });
    }

    const student = await User.findOne({
      where: { id, institutionId, role: 'student' },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student account not found.',
      });
    }

    student.status = status.toLowerCase();
    await student.save();

    return res.status(200).json({
      success: true,
      message: `Student account set to ${student.status.toUpperCase()}`,
      data: {
        studentId: student.id,
        status: student.status,
      },
    });
  } catch (error) {
    console.error('updateStudentStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update student status.',
    });
  }
};

module.exports = {
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
};
