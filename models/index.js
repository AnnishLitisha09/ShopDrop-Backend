const { Sequelize } = require('sequelize');
const bcrypt = require('bcrypt');
const config = require('../config/config.js')[process.env.NODE_ENV || 'development'];

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    dialect: config.dialect,
    logging: false,
    dialectOptions: {
      connectTimeout: 5000,
    },
  }
);

const User = require('./user')(sequelize);
const Institution = require('./institution')(sequelize);
const Vendor = require('./vendor')(sequelize);
const Product = require('./product')(sequelize);
const Order = require('./order')(sequelize);
const OrderItem = require('./orderItem')(sequelize);
const Review = require('./review')(sequelize);
const Complaint = require('./complaint')(sequelize);

// Define Associations
Institution.hasMany(Vendor, { foreignKey: 'institutionId' });
Vendor.belongsTo(Institution, { foreignKey: 'institutionId' });

Institution.hasMany(User, { foreignKey: 'institutionId' });
User.belongsTo(Institution, { foreignKey: 'institutionId' });

Vendor.hasMany(Product, { foreignKey: 'vendorId' });
Product.belongsTo(Vendor, { foreignKey: 'vendorId' });

Institution.hasMany(Product, { foreignKey: 'institutionId' });
Product.belongsTo(Institution, { foreignKey: 'institutionId' });

Order.hasMany(OrderItem, { foreignKey: 'orderId' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });

Vendor.hasMany(OrderItem, { foreignKey: 'vendorId' });
OrderItem.belongsTo(Vendor, { foreignKey: 'vendorId' });

Product.hasMany(OrderItem, { foreignKey: 'productId' });
OrderItem.belongsTo(Product, { foreignKey: 'productId' });

User.hasMany(Order, { foreignKey: 'userId' });
Order.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Review, { foreignKey: 'userId' });
Review.belongsTo(User, { foreignKey: 'userId' });

Vendor.hasMany(Review, { foreignKey: 'vendorId' });
Review.belongsTo(Vendor, { foreignKey: 'vendorId' });

Order.hasMany(Review, { foreignKey: 'orderId' });
Review.belongsTo(Order, { foreignKey: 'orderId' });

Product.hasMany(Review, { foreignKey: 'productId' });
Review.belongsTo(Product, { foreignKey: 'productId' });

User.hasMany(Complaint, { foreignKey: 'userId' });
Complaint.belongsTo(User, { foreignKey: 'userId' });

Institution.hasMany(Complaint, { foreignKey: 'institutionId' });
Complaint.belongsTo(Institution, { foreignKey: 'institutionId' });

Vendor.hasMany(Complaint, { foreignKey: 'vendorId' });
Complaint.belongsTo(Vendor, { foreignKey: 'vendorId' });

Order.hasMany(Complaint, { foreignKey: 'orderId' });
Complaint.belongsTo(Order, { foreignKey: 'orderId' });

const db = {
  sequelize,
  Sequelize,
  User,
  Institution,
  Vendor,
  Product,
  Order,
  OrderItem,
  Review,
  Complaint,
};

db.initDb = async () => {
  try {
    await sequelize.authenticate();
    console.log('[Database] MySQL connection established.');

    // Unified Database Schema Migration Map - Ensures all table columns exist cleanly
    const tableMigrations = {
      users: [
        'savedAddress JSON',
        'registerNumber VARCHAR(255)',
        'year INT',
        'passOutYear INT',
        'mustChangePassword TINYINT(1) DEFAULT 0',
      ],
      institutions: [
        'addressFieldsConfig JSON',
        'city VARCHAR(255)',
        'domain VARCHAR(255)',
      ],
      vendors: [
        'description TEXT',
        'location VARCHAR(255)',
        'operatingHours VARCHAR(255)',
        'paymentMethods VARCHAR(255)',
      ],
      products: [
        'stock INT DEFAULT 10',
      ],
      orders: [
        'deliveryAddress JSON',
        'serviceFee FLOAT DEFAULT 0.99',
        'vendorCount INT DEFAULT 1',
        'paymentMethod VARCHAR(255) DEFAULT "Campus Card Wallet"',
        'pickupNotes TEXT',
      ],
      order_items: [
        'vendorId VARCHAR(255)',
        'status ENUM("pending", "accepted", "preparing", "ready", "completed", "rejected") DEFAULT "pending"',
      ],
    };

    // Run table migrations
    for (const [tableName, columnDefinitions] of Object.entries(tableMigrations)) {
      for (const colDef of columnDefinitions) {
        try {
          await sequelize.query(`ALTER TABLE ${tableName} ADD COLUMN ${colDef};`);
        } catch (e) {
          // Column already exists
        }
      }
    }

    try {
      await sequelize.query(`UPDATE order_items oi JOIN products p ON oi.productId = p.id SET oi.vendorId = p.vendorId WHERE oi.vendorId IS NULL;`);
    } catch (e) {
      // Ignore
    }

    try {
      await sequelize.query(`ALTER TABLE vendors MODIFY COLUMN status ENUM('active', 'pending', 'inactive', 'suspended') DEFAULT 'active';`);
    } catch (e) {
      // Ignore
    }

    await sequelize.sync();

    // Default Institution Address Fields Configuration
    const defaultAddressConfig = [
      {
        key: 'hostelName',
        label: 'Hostel / Hall Name',
        placeholder: 'e.g. Cedar Hall / Ricketts House',
        required: true,
      },
      {
        key: 'roomNumber',
        label: 'Room / Block Number',
        placeholder: 'e.g. Room 304, Block B',
        required: true,
      },
      {
        key: 'landmark',
        label: 'Campus Landmark / Notes',
        placeholder: 'e.g. Near West Dining Hall',
        required: false,
      },
    ];

    // Seed/Update Institution record
    const [inst] = await Institution.findOrCreate({
      where: { id: 'inst_stanford_001' },
      defaults: {
        name: 'Stanford University',
        code: 'STANFORD',
        logoUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=150',
        addressFieldsConfig: defaultAddressConfig,
        city: 'Palo Alto',
        domain: 'stanford.edu',
        status: 'active',
      },
    });

    if (inst) {
      let updated = false;
      if (!inst.addressFieldsConfig) {
        inst.addressFieldsConfig = defaultAddressConfig;
        updated = true;
      }
      if (!inst.domain) {
        inst.domain = 'stanford.edu';
        updated = true;
      }
      if (!inst.city) {
        inst.city = 'Palo Alto';
        updated = true;
      }
      if (updated) await inst.save();
    }

    // Seed default data if vendors table is empty
    const vendorCount = await Vendor.count();
    if (vendorCount === 0) {
      console.log('[Database] Seeding multi-tenant campus marketplace baseline...');
      const defaultPassword = await bcrypt.hash('Password123!', 10);

      // Seed Users
      const [studentUser] = await User.findOrCreate({
        where: { email: 'student@stanford.edu' },
        defaults: {
          name: 'Alex Student',
          password: defaultPassword,
          role: 'student',
          institutionId: 'inst_stanford_001',
          status: 'active',
        },
      });

      await User.findOrCreate({
        where: { email: 'superadmin@shopdrop.edu' },
        defaults: {
          name: 'Super Admin',
          password: defaultPassword,
          role: 'super_admin',
          status: 'active',
        },
      });

      await User.findOrCreate({
        where: { email: 'admin@stanford.edu' },
        defaults: {
          name: 'Stanford Institution Admin',
          password: defaultPassword,
          role: 'institution_admin',
          institutionId: 'inst_stanford_001',
          status: 'active',
        },
      });

      await User.findOrCreate({
        where: { email: 'vendor@campusbites.com' },
        defaults: {
          name: 'Campus Bites Vendor',
          password: defaultPassword,
          role: 'vendor',
          institutionId: 'inst_stanford_001',
          vendorId: 'vnd_bites_001',
          status: 'active',
        },
      });

      // Seed Campus Vendors
      await Vendor.bulkCreate([
        {
          id: 'vnd_bites_001',
          name: 'Campus Bites Canteen',
          shopName: 'Campus Bites Canteen',
          category: 'Food',
          description: 'Serving hot gourmet burgers, crispy fries, wraps, and quick bites for hungry campus students.',
          location: 'Student Union Building, Ground Floor Food Court',
          operatingHours: '8:00 AM - 10:00 PM (Mon-Sat)',
          paymentMethods: 'Campus Card, Credit/Debit, UPI',
          logoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200',
          bannerUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
          rating: 4.8,
          reviewCount: 142,
          isOpen: true,
          pickupTime: '10-15 mins',
          institutionId: 'inst_stanford_001',
          status: 'active',
        },
        {
          id: 'vnd_stationery_002',
          name: 'The Quad Bookstore & Supplies',
          shopName: 'The Quad Bookstore',
          category: 'Stationery',
          description: 'Your one-stop campus store for textbooks, spiral notebooks, lab coats, stationary sets, and art supplies.',
          location: 'Tressider Memorial Quad, East Wing',
          operatingHours: '9:00 AM - 7:00 PM (Mon-Fri)',
          paymentMethods: 'Campus Card, Credit/Debit, Apple Pay',
          logoUrl: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=200',
          bannerUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800',
          rating: 4.7,
          reviewCount: 88,
          isOpen: true,
          pickupTime: '5-10 mins',
          institutionId: 'inst_stanford_001',
          status: 'active',
        },
        {
          id: 'vnd_print_003',
          name: 'PrintHub Express',
          shopName: 'PrintHub Express',
          category: 'Printing',
          description: 'Instant document printing, poster plotting, project binding, and thesis hardbound laminating.',
          location: 'Green Library Commons, Room 102',
          operatingHours: '24/7 Self-Service & Counter (8 AM - 11 PM)',
          paymentMethods: 'Campus Card, UPI',
          logoUrl: 'https://images.unsplash.com/photo-1562654501-a0ccc0fc3fb1?w=200',
          bannerUrl: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800',
          rating: 4.9,
          reviewCount: 210,
          isOpen: true,
          pickupTime: 'Instant / 5 mins',
          institutionId: 'inst_stanford_001',
          status: 'active',
        },
        {
          id: 'vnd_coffee_004',
          name: 'Oval Espresso Bar',
          shopName: 'Oval Espresso Bar',
          category: 'Food',
          description: 'Specialty cold brews, iced lattes, organic teas, avocado toast, and fresh bakery pastries.',
          location: 'Oval Park Pavilion',
          operatingHours: '7:30 AM - 8:00 PM (Daily)',
          paymentMethods: 'Campus Card, Credit/Debit, Google Pay',
          logoUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=200',
          bannerUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800',
          rating: 4.6,
          reviewCount: 95,
          isOpen: true,
          pickupTime: '5-8 mins',
          institutionId: 'inst_stanford_001',
          status: 'active',
        },
        {
          id: 'vnd_gifts_005',
          name: 'Campus Merch & Gifts',
          shopName: 'Campus Merch & Gifts',
          category: 'Gifts & Accessories',
          description: 'Official university hoodies, caps, water bottles, keychains, and alumni souvenirs.',
          location: 'Visitor Center Arcade, Shop 4',
          operatingHours: '10:00 AM - 6:00 PM (Daily)',
          paymentMethods: 'Campus Card, Credit/Debit',
          logoUrl: 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=200',
          bannerUrl: 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=800',
          rating: 4.5,
          reviewCount: 60,
          isOpen: true,
          pickupTime: '10 mins',
          institutionId: 'inst_stanford_001',
          status: 'active',
        },
        {
          id: 'vnd_shoes_006',
          name: 'Campus Kicks & Footwear',
          shopName: 'Campus Kicks & Footwear',
          category: 'Footwear',
          description: 'Sneakers, sports shoes, sandals, and shoe care kits for campus athletes and students.',
          location: 'Arrillaga Sports Center, Shop 2',
          operatingHours: 'Closed Today',
          paymentMethods: 'Credit/Debit, UPI',
          logoUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200',
          bannerUrl: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800',
          rating: 4.4,
          reviewCount: 32,
          isOpen: false,
          pickupTime: 'Closed',
          institutionId: 'inst_stanford_001',
          status: 'active',
        },
      ]);

      // Seed Products
      await Product.bulkCreate([
        {
          id: 'prod_burger_01',
          name: 'Classic Campus Cheeseburger',
          description: 'Grilled beef patty with cheddar cheese, lettuce, and secret campus sauce.',
          price: 180.0,
          category: 'Meals',
          imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400',
          isAvailable: true,
          stock: 12,
          institutionId: 'inst_stanford_001',
          vendorId: 'vnd_bites_001',
        },
        {
          id: 'prod_fries_06',
          name: 'Crispy Peri Peri French Fries',
          description: 'Golden fried potatoes tossed in spicy Peri Peri seasoning.',
          price: 90.0,
          category: 'Snacks',
          imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400',
          isAvailable: true,
          stock: 4,
          institutionId: 'inst_stanford_001',
          vendorId: 'vnd_bites_001',
        },
        {
          id: 'prod_wrap_09',
          name: 'Chicken Caesar Wrap',
          description: 'Grilled chicken breast, romaine lettuce, parmesan cheese, and caesar dressing in a whole wheat tortilla.',
          price: 150.0,
          category: 'Meals',
          imageUrl: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400',
          isAvailable: true,
          stock: 0,
          institutionId: 'inst_stanford_001',
          vendorId: 'vnd_bites_001',
        },
        {
          id: 'prod_soda_10',
          name: 'Chilled Lemon Iced Tea',
          description: 'Refreshing brewed black tea infused with fresh lemon and mint leaves.',
          price: 60.0,
          category: 'Beverages',
          imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400',
          isAvailable: true,
          stock: 15,
          institutionId: 'inst_stanford_001',
          vendorId: 'vnd_bites_001',
        },
        {
          id: 'prod_latte_02',
          name: 'Iced Oat Milk Caramel Latte',
          description: 'Freshly brewed espresso over ice, creamy oat milk, and caramel drizzle.',
          price: 120.0,
          category: 'Beverages',
          imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=400',
          isAvailable: true,
          stock: 8,
          institutionId: 'inst_stanford_001',
          vendorId: 'vnd_coffee_004',
        },
        {
          id: 'prod_croissant_11',
          name: 'Butter Croissant & Espresso Combo',
          description: 'Freshly baked flaky butter croissant paired with a double espresso shot.',
          price: 140.0,
          category: 'Combos',
          imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400',
          isAvailable: true,
          stock: 3,
          institutionId: 'inst_stanford_001',
          vendorId: 'vnd_coffee_004',
        },
        {
          id: 'prod_notebook_03',
          name: 'Hardcover Spiral Campus Notebook (200 pgs)',
          description: 'Durable A5 grid-lined notebook perfect for lectures and lab work.',
          price: 80.0,
          category: 'Notebooks',
          imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400',
          isAvailable: true,
          stock: 25,
          institutionId: 'inst_stanford_001',
          vendorId: 'vnd_stationery_002',
        },
        {
          id: 'prod_pens_07',
          name: 'Quick-Dry Gel Pen Set (Pack of 5)',
          description: 'Smooth 0.5mm black gel ink pens.',
          price: 110.0,
          category: 'Pens & Stationery',
          imageUrl: 'https://images.unsplash.com/photo-1585336261026-8f57857820f2?w=400',
          isAvailable: true,
          stock: 10,
          institutionId: 'inst_stanford_001',
          vendorId: 'vnd_stationery_002',
        },
        {
          id: 'prod_print_04',
          name: 'A4 Color Printing & Lamination (Per Page)',
          description: 'High-res 300dpi color laser printing with glossy protective lamination.',
          price: 10.0,
          category: 'Printing',
          imageUrl: 'https://images.unsplash.com/photo-1562654501-a0ccc0fc3fb1?w=400',
          isAvailable: true,
          stock: 100,
          institutionId: 'inst_stanford_001',
          vendorId: 'vnd_print_003',
        },
        {
          id: 'prod_hoodie_05',
          name: 'Stanford Cardinal Red Fleece Hoodie',
          description: 'Official cotton blend university embroidered hoodie.',
          price: 999.0,
          category: 'Apparel',
          imageUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=400',
          isAvailable: true,
          stock: 2,
          institutionId: 'inst_stanford_001',
          vendorId: 'vnd_gifts_005',
        },
      ]);

      console.log('[Database] Seeded campus baseline vendors and products in Rupees.');
    }
  } catch (error) {
    console.error('[Database] Sync Error:', error.message);
  }
};

module.exports = db;
