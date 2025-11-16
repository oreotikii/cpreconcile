require('dotenv').config();
const axios = require('axios');

async function testOrdersEndpoints() {
  // First authenticate
  const apiUrl = process.env.EASYECOM_API_URL || 'https://api.easyecom.io';
  const apiKey = process.env.EASYECOM_API_KEY;

  console.log('Authenticating first...\n');
  const authResponse = await axios.post(
    `${apiUrl}/access/token`,
    {
      email: process.env.EASYECOM_EMAIL,
      password: process.env.EASYECOM_PASSWORD,
      location_key: process.env.EASYECOM_LOCATION_KEY,
    },
    {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    }
  );

  const token = authResponse.data.data.token.jwt_token;
  console.log('✅ Token received\n');

  // Test different order endpoints
  const endpoints = [
    { method: 'GET', path: '/orders', name: 'GET /orders' },
    { method: 'GET', path: '/api/orders', name: 'GET /api/orders' },
    { method: 'GET', path: '/orders/V2/getOrders', name: 'GET /orders/V2/getOrders' },
    { method: 'GET', path: '/api/v2/orders', name: 'GET /api/v2/orders' },
    { method: 'GET', path: '/v2/orders', name: 'GET /v2/orders' },
    { method: 'POST', path: '/orders/getOrders', name: 'POST /orders/getOrders' },
    { method: 'POST', path: '/api/orders/list', name: 'POST /api/orders/list' },
    { method: 'GET', path: '/order/list', name: 'GET /order/list' },
  ];

  console.log('Testing order endpoints...\n');

  for (const endpoint of endpoints) {
    try {
      const config = {
        method: endpoint.method,
        url: `${apiUrl}${endpoint.path}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      };

      if (endpoint.method === 'GET') {
        config.params = { limit: 1, offset: 0 };
      } else {
        config.data = { limit: 1, offset: 0 };
      }

      const response = await axios(config);

      console.log(`✅ SUCCESS: ${endpoint.name}`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Response keys:`, Object.keys(response.data));
      if (response.data.data) {
        console.log(`   Orders found: ${Array.isArray(response.data.data) ? response.data.data.length : 'Not an array'}`);
      }
      console.log('');
      break; // Stop at first success
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        if (status === 404) {
          console.log(`❌ ${endpoint.name} - 404 Not Found`);
        } else if (status === 405) {
          console.log(`❌ ${endpoint.name} - 405 Method Not Allowed`);
        } else {
          console.log(`❌ ${endpoint.name} - ${status} ${error.response.statusText}`);
          if (error.response.data && typeof error.response.data === 'object') {
            console.log(`   Error:`, error.response.data);
          }
        }
      } else {
        console.log(`❌ ${endpoint.name} - ${error.message}`);
      }
    }
  }
}

testOrdersEndpoints().catch(console.error);
