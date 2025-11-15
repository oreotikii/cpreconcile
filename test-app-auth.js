require('dotenv').config();
const axios = require('axios');

async function testAppAuth() {
  console.log('\n=== Testing App Authentication ===\n');

  // Check if .env is loaded
  const email = process.env.EASYECOM_EMAIL;
  const password = process.env.EASYECOM_PASSWORD;
  const locationKey = process.env.EASYECOM_LOCATION_KEY;
  const apiKey = process.env.EASYECOM_API_KEY;
  const apiUrl = process.env.EASYECOM_API_URL || 'https://api.easyecom.io';

  console.log('Step 1: Check credentials loaded from .env');
  console.log('  EASYECOM_EMAIL:', email ? '✓ loaded' : '✗ MISSING');
  console.log('  EASYECOM_PASSWORD:', password ? '✓ loaded' : '✗ MISSING');
  console.log('  EASYECOM_LOCATION_KEY:', locationKey ? '✓ loaded' : '✗ MISSING');
  console.log('  EASYECOM_API_KEY:', apiKey ? '✓ loaded' : '✗ MISSING');
  console.log('  EASYECOM_API_URL:', apiUrl, '\n');

  if (!email || !password || !locationKey || !apiKey) {
    console.error('❌ Missing credentials in .env file!');
    console.log('\nMake sure your .env file exists and contains:');
    console.log('EASYECOM_EMAIL=your_email');
    console.log('EASYECOM_PASSWORD=your_password');
    console.log('EASYECOM_LOCATION_KEY=your_location_key');
    console.log('EASYECOM_API_KEY=your_api_key\n');
    return;
  }

  console.log('Step 2: Test authentication endpoint');
  console.log('  Endpoint: POST', apiUrl + '/access/token');
  console.log('  Headers: x-api-key');
  console.log('  Body: {email, password, location_key}\n');

  try {
    const response = await axios.post(
      apiUrl + '/access/token',
      {
        email: email,
        password: password,
        location_key: locationKey,
      },
      {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Authentication SUCCESS!');
    console.log('  Status:', response.status);
    console.log('  Response keys:', Object.keys(response.data));

    const token = response.data.token || response.data.access_token;
    if (token) {
      console.log('  Token received:', token.substring(0, 30) + '...');
      console.log('\nStep 3: Test orders API with token');
      await testOrders(apiUrl, token, apiKey);
    } else {
      console.log('  ⚠️ No token in response');
      console.log('  Response:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.log('\n❌ Authentication FAILED');
    if (error.response) {
      console.log('  Status:', error.response.status);
      console.log('  Error:', error.response.data);
      console.log('  Headers sent:', {
        'x-api-key': apiKey ? apiKey.substring(0, 10) + '...' : 'missing',
        'Content-Type': 'application/json',
      });
    } else {
      console.log('  Error:', error.message);
    }
  }
}

async function testOrders(apiUrl, token, apiKey) {
  try {
    const response = await axios.get(apiUrl + '/orders/V2/getOrders', {
      headers: {
        'Authorization': 'Bearer ' + token,
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      params: {
        limit: 1,
        offset: 0,
      },
    });

    console.log('✅ Orders API SUCCESS!');
    console.log('  Status:', response.status);
    console.log('  Orders found:', response.data.data ? response.data.data.length : 0);
    console.log('\n🎉 Full authentication flow working!\n');
  } catch (error) {
    console.log('❌ Orders API FAILED');
    if (error.response) {
      console.log('  Status:', error.response.status);
      console.log('  Error:', error.response.data);
    } else {
      console.log('  Error:', error.message);
    }
  }
}

testAppAuth();
