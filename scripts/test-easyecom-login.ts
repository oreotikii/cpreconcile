import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

/**
 * Test script to check if Easyecom requires login/authentication first
 * Run with: npm run test:easyecom:login
 */
async function testEasyecomLogin() {
  const apiKey = process.env.EASYECOM_API_KEY;
  const email = process.env.EASYECOM_EMAIL;
  const apiUrl = process.env.EASYECOM_API_URL || 'https://api.easyecom.io';

  console.log('\n=== Easyecom API Login/Authentication Test ===\n');

  if (!apiKey || !email) {
    console.error('❌ Missing credentials!');
    return;
  }

  console.log('✓ Credentials found');
  console.log(`  API URL: ${apiUrl}`);
  console.log(`  Email: ${email}`);
  console.log(`  API Key: ***${apiKey.slice(-4)}\n`);

  // Common authentication/login endpoints to try
  const loginEndpoints = [
    '/auth/login',
    '/api/auth/login',
    '/v2/auth/login',
    '/login',
    '/api/login',
    '/authenticate',
    '/api/authenticate',
    '/token',
    '/api/token',
    '/oauth/token',
  ];

  // Try different authentication payload formats
  const authPayloads = [
    {
      name: 'Email and Password',
      data: {
        email: email,
        password: apiKey,
      },
    },
    {
      name: 'Email and API Key',
      data: {
        email: email,
        api_key: apiKey,
      },
    },
    {
      name: 'Email and apiKey (camelCase)',
      data: {
        email: email,
        apiKey: apiKey,
      },
    },
    {
      name: 'Username and Password',
      data: {
        username: email,
        password: apiKey,
      },
    },
  ];

  console.log('Testing login endpoints...\n');

  for (const endpoint of loginEndpoints) {
    for (const payload of authPayloads) {
      const testName = `${endpoint} with ${payload.name}`;

      try {
        const response = await axios.post(`${apiUrl}${endpoint}`, payload.data, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        console.log(`✅ SUCCESS: ${testName}`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Response:`, JSON.stringify(response.data, null, 2));

        // If we got a token, try using it
        const token = response.data.token || response.data.access_token || response.data.accessToken;
        if (token) {
          console.log(`\n   Found token: ***${token.slice(-10)}`);
          console.log('   Testing token with getOrders endpoint...\n');

          await testWithToken(apiUrl, token);
        }

        return;
      } catch (error: any) {
        // Only log if it's not a 404 (endpoint doesn't exist)
        if (error.response?.status !== 404) {
          const status = error.response?.status;
          const message = error.response?.data?.message || error.message;

          if (status === 401 || status === 403) {
            console.log(`   ${testName}: ❌ ${status} - ${message}`);
          }
        }
      }
    }
  }

  console.log('\n⚠️  No working login endpoint found.\n');
  console.log('This suggests Easyecom might:');
  console.log('1. Use direct API key authentication (not token-based)');
  console.log('2. Require credentials from a different source');
  console.log('3. Have a different authentication flow\n');
  console.log('📧 Contact Easyecom support at care@easyecom.io for:');
  console.log('   - Correct API authentication method');
  console.log('   - API key generation instructions');
  console.log('   - API documentation access\n');
}

async function testWithToken(apiUrl: string, token: string) {
  const authMethods = [
    {
      name: 'Bearer token',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    {
      name: 'Access-Token header',
      headers: {
        'Access-Token': token,
        'Content-Type': 'application/json',
      },
    },
    {
      name: 'x-access-token header',
      headers: {
        'x-access-token': token,
        'Content-Type': 'application/json',
      },
    },
  ];

  for (const method of authMethods) {
    try {
      const response = await axios.get(`${apiUrl}/orders/V2/getOrders`, {
        headers: method.headers,
        params: {
          limit: 1,
          offset: 0,
        },
      });

      console.log(`   ✅ Token works with ${method.name}!`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Orders endpoint accessible!\n`);
      return true;
    } catch (error: any) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      console.log(`   ❌ ${method.name}: ${status} - ${message}`);
    }
  }

  console.log('\n   Token obtained but not working with any method.\n');
  return false;
}

testEasyecomLogin().catch(console.error);
