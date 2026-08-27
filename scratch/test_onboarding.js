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

async function testAll() {
  console.log('--- TEST 1: Public Registration Disabled ---');
  try {
    const res1 = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { name: 'Test', email: 'test@gmail.com', password: 'Password123!', institutionId: 'inst_stanford_001' });

    console.log('Result 1 (Register):', res1.status, res1.data);
  } catch (err) {
    console.error('Test 1 error:', err.message);
  }

  console.log('\n--- TEST 2: Login as Institution Admin ---');
  let token = null;
  try {
    const loginRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { email: 'admin@stanford.edu', password: 'Password123!' });

    console.log('Login Result:', loginRes.status, loginRes.data.success ? 'Success' : loginRes.data.message);
    token = loginRes.data.token;
  } catch (err) {
    console.error('Login error:', err.message);
  }

  if (token) {
    console.log('\n--- TEST 3: Create Student with Passed-out Year (Invalid) ---');
    const res3 = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/institution-admin/students',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }, {
      registerNumber: '22IT999',
      name: 'Alumni Student',
      email: 'alumni@stanford.edu',
      year: 4,
      passOutYear: 2024,
    });
    console.log('Result 3 (Passed Out Student):', res3.status, res3.data);

    console.log('\n--- TEST 4: Create Student with Non-Matching Domain (Invalid) ---');
    const res4 = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/institution-admin/students',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }, {
      registerNumber: '22IT998',
      name: 'Gmail Student',
      email: 'student@gmail.com',
      year: 2,
      passOutYear: 2028,
    });
    console.log('Result 4 (Non-matching Domain):', res4.status, res4.data);

    console.log('\n--- TEST 5: Create Valid Currently Pursuing Student ---');
    const testRegNo = `22IT${Math.floor(100 + Math.random() * 900)}`;
    const testEmail = `student${Date.now()}@stanford.edu`;
    const res5 = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/institution-admin/students',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }, {
      registerNumber: testRegNo,
      name: 'Valid Student',
      email: testEmail,
      year: 2,
      passOutYear: 2028,
    });
    console.log('Result 5 (Valid Student Onboarded):', res5.status, res5.data);
  }
}

testAll();
