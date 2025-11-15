import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

/**
 * Test script specifically for Easyecom V2.1 JWT token authentication
 * Based on official documentation requirements:
 * - email (registered email)
 * - password (account password)
 * - location_key (from Location Master page)
 */
async function testEasyecomTokenAuth() {
  const email = process.env.EASYECOM_EMAIL;
  const password = process.env.EASYECOM_PASSWORD;
  const locationKey = process.env.EASYECOM_LOCATION_KEY;
  const apiKey = process.env.EASYECOM_API_KEY;
  const apiUrl = process.env.EASYECOM_API_URL || 'https://api.easyecom.io';

  console.log('\n=== Easyecom V2.1 JWT Token Authentication Test ===\n');

  // Check credentials
  console.log('Checking credentials...');
  const missing = [];
  if (!email) missing.push('EASYECOM_EMAIL');
  if (!password) missing.push('EASYECOM_PASSWORD');
  if (!locationKey) missing.push('EASYECOM_LOCATION_KEY');
  if (!apiKey) missing.push('EASYECOM_API_KEY');

  if (missing.length > 0) {
    console.error('❌ Missing credentials:', missing.join(', '));
    console.error('\nPlease set these in your .env file:');
    missing.forEach(cred => console.error(`  - ${cred}`));
    return;
  }

  console.log('✓ All credentials found');
  console.log(`  Email: ${email}`);
  console.log(`  Location Key: ***${locationKey.slice(-4)}`);
  console.log(`  API Key: ***${apiKey.slice(-4)}`);
  console.log(`  API URL: ${apiUrl}\n`);

  // Test payload based on documentation
  const authPayload = {
    email: email,
    password: password,
    location_key: locationKey,
  };

  // Common token endpoints to try
  const tokenEndpoints = [
    '/token',
    '/api/token',
    '/auth/token',
    '/getToken',
    '/api/getToken',
    '/auth/getToken',
    '/api/auth/token',
    '/login',
    '/api/login',
    '/auth/login',
    '/authenticate',
    '/api/authenticate',
    '/auth/authenticate',
    '/v2/token',
    '/v2/auth/token',
    '/api/v2/token',
  ];

  console.log('Testing token endpoints with email, password, location_key...\n');

  for (const endpoint of tokenEndpoints) {
    console.log(`Testing: ${apiUrl}${endpoint}`);

    try {
      const response = await axios.post(`${apiUrl}${endpoint}`, authPayload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`\n✅ SUCCESS! Found working endpoint: ${endpoint}`);
      console.log(`Status: ${response.status}`);
      console.log(`Response data:`, JSON.stringify(response.data, null, 2));

      // Check for token in response
      const token = response.data.token || response.data.access_token || response.data.jwt;

      if (token) {
        console.log(`\n🎉 JWT Token received: ***${token.slice(-10)}`);
        console.log('\nNow testing token with orders API...\n');

        // Test the token with orders endpoint
        await testTokenWithOrders(apiUrl, token, apiKey);
      } else {
        console.log('\n⚠️  Response received but no token found in:', Object.keys(response.data));
      }

      return;
    } catch (error: any) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;

      if (status === 404) {
        console.log(`  ❌ 404 - Endpoint not found`);
      } else if (status === 401) {
        console.log(`  ❌ 401 - Unauthorized: ${message}`);
        console.log(`     Response:`, error.response?.data);
      } else if (status === 400) {
        console.log(`  ❌ 400 - Bad Request: ${message}`);
        console.log(`     This endpoint exists but payload might be wrong`);
        console.log(`     Response:`, error.response?.data);
      } else if (status) {
        console.log(`  ❌ ${status} - ${message}`);
        console.log(`     Response:`, error.response?.data);
      } else {
        console.log(`  ❌ Network error: ${message}`);
      }
    }
  }

  console.log('\n\n⚠️  All endpoints failed!');
  console.log('\n📧 NEXT STEPS:');
  console.log('1. Check the Easyecom API documentation for the exact endpoint URL');
  console.log('2. Look for "Get API Token" or similar in their docs');
  console.log('3. Verify the endpoint might be different (e.g., /v1/token, /users/login, etc.)');
  console.log('4. Share the exact endpoint from docs so we can test it');
  console.log('5. Contact Easyecom support at care@easyecom.io with this test output\n');
}

async function testTokenWithOrders(apiUrl: string, token: string, apiKey: string) {
  const testCombinations = [
    {
      name: 'Bearer token + x-api-key',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    },
    {
      name: 'Bearer token only',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    {
      name: 'x-access-token + x-api-key',
      headers: {
        'x-access-token': token,
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    },
    {
      name: 'Access-Token + x-api-key',
      headers: {
        'Access-Token': token,
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    },
  ];

  for (const combo of testCombinations) {
    console.log(`  Testing orders with: ${combo.name}`);

    try {
      const response = await axios.get(`${apiUrl}/orders/V2/getOrders`, {
        headers: combo.headers,
        params: {
          limit: 1,
          offset: 0,
        },
      });

      console.log(`  ✅ SUCCESS! Orders API works with ${combo.name}`);
      console.log(`     Status: ${response.status}`);
      console.log(`     Orders found: ${response.data.data?.length || 0}`);
      console.log('\n🎉 AUTHENTICATION FULLY WORKING!\n');
      return true;
    } catch (error: any) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      console.log(`  ❌ ${status} - ${message}`);
    }
  }

  console.log('\n  ⚠️  Token obtained but orders API still failing');
  console.log('  The token endpoint works but something else is needed\n');
  return false;
}

testEasyecomTokenAuth().catch(console.error);
