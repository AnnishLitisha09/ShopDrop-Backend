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

async function testSecurityFix() {
  console.log('--- SECURITY FIX TEST: Vendor Order Authorization ---');
  try {
    const loginRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { email: 'vendor@campusbites.com', password: 'Password123!' });

    const token = loginRes.data.token;

    // Attempt updating non-existent / unauthorized order status
    const updateRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/vendor/orders/invalid_order_id/status',
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }, { status: 'completed' });

    console.log('Vendor Order Security Check Result:', updateRes.status, updateRes.data);
  } catch (err) {
    console.error('Security test error:', err.message);
  }
}

testSecurityFix();
