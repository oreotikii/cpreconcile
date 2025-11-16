require('dotenv').config();
const axios = require('axios');

async function testEasyecomAuth() {
  const email = process.env.EASYECOM_EMAIL;
  const password = process.env.EASYECOM_PASSWORD;
  const locationKey = process.env.EASYECOM_LOCATION_KEY;
  const apiKey = process.env.EASYECOM_API_KEY;
  const apiUrl = process.env.EASYECOM_API_URL || 'https://api.easyecom.io';

  console.log('\n=== Easyecom Authentication Test ===\n');
  console.log('Credentials check:');
  console.log('  Email:', email ? '✓' : '✗');
  console.log('  Password:', password ? '✓' : '✗');
  console.log('  Location Key:', locationKey ? '✓' : '✗');
  console.log('  API Key:', apiKey ? '✓' : '✗');
  console.log('  API URL:', apiUrl);
  console.log('');

  if (!email || !password || !locationKey || !apiKey) {
    console.error('❌ Missing required credentials in .env file');
    return;
  }

  console.log('Testing POST /access/token...');

  try {
    const response = await axios.post(
      `${apiUrl}/access/token`,
      {
        email: email,
        password: password,
        location_key: locationKey,
      },
      {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    );

    console.log('\n✅ Authentication SUCCESS!');
    console.log('Status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));

    // Extract token from nested structure
    const token = response.data.data?.token?.jwt_token || response.data.token || response.data.access_token;
    const expiresIn = response.data.data?.token?.expires_in;

    if (token) {
      console.log('\n✅ JWT Token received!');
      console.log('Token (first 40 chars):', token.substring(0, 40) + '...');
      if (expiresIn) {
        const expiryDate = new Date(Date.now() + expiresIn * 1000);
        console.log('Token expires in:', expiresIn, 'seconds');
        console.log('Token expires at:', expiryDate.toISOString());
      }

      // Test orders API
      console.log('\nTesting GET /orders/V2/getAllOrders with token...');

      // Get dates for the last 7 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day} 00:00:00`;
      };

      const ordersResponse = await axios.get(
        `${apiUrl}/orders/V2/getAllOrders`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          params: {
            start_date: formatDate(startDate),
            end_date: formatDate(endDate),
          },
        }
      );

      console.log('✅ Orders API SUCCESS!');
      console.log('Status:', ordersResponse.status);
      console.log('Response structure:', JSON.stringify(ordersResponse.data, null, 2));

      if (ordersResponse.data.data) {
        const orders = Array.isArray(ordersResponse.data.data) ? ordersResponse.data.data : [ordersResponse.data.data];
        console.log('Orders found:', orders.length);
        if (orders.length > 0) {
          console.log('First order keys:', Object.keys(orders[0]));
        }
      }
      console.log('\n🎉 Easyecom integration is working!\n');
    } else {
      console.log('\n⚠️  Authentication succeeded but no token in response');
      console.log('Response keys:', Object.keys(response.data));
    }
  } catch (error) {
    console.log('\n❌ Authentication FAILED');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Status Text:', error.response.statusText);
      console.log('Error Data:', JSON.stringify(error.response.data, null, 2));
      console.log('\nRequest details:');
      console.log('  URL:', `${apiUrl}/access/token`);
      console.log('  Headers sent:', {
        'x-api-key': apiKey ? apiKey.substring(0, 10) + '...' : 'missing',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      });
      console.log('  Body:', { email, password: '***', location_key: locationKey });
    } else {
      console.log('Error:', error.message);
    }
    console.log('\n');
  }
}

testEasyecomAuth();
