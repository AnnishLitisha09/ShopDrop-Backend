const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', (err) => reject(err));
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runInventoryTests() {
  console.log('=== REAL-TIME PRODUCT INVENTORY VERIFICATION ===\n');

  // 1. Login as Student
  let studentToken = null;
  try {
    const loginRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { email: 'student@stanford.edu', password: 'Password123!' });

    console.log('Student Login Status:', loginRes.status);
    studentToken = loginRes.data.token;
  } catch (err) {
    console.error('Student login error:', err.message);
    return;
  }

  // 2. Fetch Product Details for prod_burger_01 (initial stock = 12)
  console.log('\n--- TEST 1: Fetch Product Details (Initial Stock) ---');
  try {
    const prodRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/student/products/prod_burger_01',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${studentToken}` },
    });

    console.log('Product Status:', prodRes.status);
    console.log('Product Name:', prodRes.data.data.product.name);
    console.log('Current Stock:', prodRes.data.data.product.stock);
  } catch (err) {
    console.error('Fetch product error:', err.message);
  }

  // 3. Attempt Checkout with Quantity > Available Stock (e.g. 50 > 10)
  console.log('\n--- TEST 2: Attempt Checkout Over Available Stock ---');
  try {
    const overStockRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/student/orders',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`,
      },
    }, {
      items: [{ id: 'prod_burger_01', name: 'Classic Campus Cheeseburger', price: 180, quantity: 50 }],
      paymentMethod: 'Campus Card Wallet',
      deliveryAddress: { hostelName: 'Tressider Hall', roomNumber: '204', phone: '555-0199' },
    });

    console.log('Over-Stock Order Status:', overStockRes.status);
    console.log('Rejection Message:', overStockRes.data.message);
  } catch (err) {
    console.error('Over-stock test error:', err.message);
  }

  // 4. Attempt Checkout for Out of Stock Item (prod_wrap_09, stock = 0)
  console.log('\n--- TEST 3: Attempt Checkout for Out-of-Stock Item (stock = 0) ---');
  try {
    const outOfStockRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/student/orders',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`,
      },
    }, {
      items: [{ id: 'prod_wrap_09', name: 'Chicken Caesar Wrap', price: 150, quantity: 1 }],
      paymentMethod: 'Campus Card Wallet',
      deliveryAddress: { hostelName: 'Tressider Hall', roomNumber: '204', phone: '555-0199' },
    });

    console.log('Out-of-Stock Order Status:', outOfStockRes.status);
    console.log('Rejection Message:', outOfStockRes.data.message);
  } catch (err) {
    console.error('Out-of-stock test error:', err.message);
  }

  // 5. Successful Order Checkout (e.g. buy 2 units of prod_burger_01)
  console.log('\n--- TEST 4: Successful Order Checkout (Decrements Stock) ---');
  try {
    const validOrderRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/student/orders',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`,
      },
    }, {
      items: [{ id: 'prod_burger_01', name: 'Classic Campus Cheeseburger', price: 180, quantity: 2 }],
      paymentMethod: 'Campus Card Wallet',
      deliveryAddress: { hostelName: 'Tressider Hall', roomNumber: '204', phone: '555-0199' },
    });

    console.log('Order Placement Status:', validOrderRes.status);
    console.log('Order ID:', validOrderRes.data.data?.orderId);

    // Re-query product stock after checkout
    const updatedProdRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/student/products/prod_burger_01',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${studentToken}` },
    });

    console.log('Updated Stock After Purchasing 2 Units:', updatedProdRes.data.data.product.stock);
  } catch (err) {
    console.error('Valid order test error:', err.message);
  }

  // 6. Vendor Updates Stock to 0 and Student Attempts Purchase
  console.log('\n--- TEST 5: Vendor Sets Stock to 0 -> Student Purchase Rejected ---');
  try {
    const vendorLogin = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { email: 'vendor@campusbites.com', password: 'Password123!' });

    const vendorToken = vendorLogin.data.token;

    // Set prod_fries_06 stock to 0
    const updateRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/vendor/products/prod_fries_06',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vendorToken}`,
      },
    }, { stock: 0 });

    console.log('Vendor Updated Stock to 0:', updateRes.data.data.product.name, 'Stock:', updateRes.data.data.product.stock);

    // Student attempts to buy prod_fries_06
    const buyAttempt = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/student/orders',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`,
      },
    }, {
      items: [{ id: 'prod_fries_06', name: 'Crispy Peri Peri French Fries', price: 90, quantity: 1 }],
      paymentMethod: 'Campus Card Wallet',
      deliveryAddress: { hostelName: 'Tressider Hall', roomNumber: '204', phone: '555-0199' },
    });

    console.log('Student Out-of-Stock Order Status:', buyAttempt.status);
    console.log('Rejection Message:', buyAttempt.data.message);

    // Fetch vendor dashboard metrics
    const dashRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/vendor/dashboard',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${vendorToken}` },
    });

    console.log('\nVendor Dashboard Metrics:', dashRes.data.data.kpi);
  } catch (err) {
    console.error('Vendor test error:', err.message);
  }
}

runInventoryTests();
