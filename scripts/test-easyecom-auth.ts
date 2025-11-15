import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

/**
 * Test script to verify Easyecom API credentials
 * Run with: npm run dev:test-easyecom
 */
async function testEasyecomAuth() {
  const apiKey = process.env.EASYECOM_API_KEY;
  const email = process.env.EASYECOM_EMAIL;
  const apiUrl = process.env.EASYECOM_API_URL || 'https://api.easyecom.io';

  console.log('\n=== Easyecom API Authentication Test ===\n');

  // Check if credentials are set
  if (!apiKey || !email) {
    console.error('❌ Missing credentials!');
    console.error('Please set the following in your .env file:');
    console.error('  - EASYECOM_API_KEY');
    console.error('  - EASYECOM_EMAIL');
    return;
  }

  console.log('✓ Credentials found');
  console.log(`  API URL: ${apiUrl}`);
  console.log(`  Email: ${email}`);
  console.log(`  API Key: ***${apiKey.slice(-4)}\n`);

  // Test different header combinations
  const headerCombinations = [
    {
      name: 'x-api-key and x-api-email (lowercase)',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'x-api-email': email,
      },
      params: {},
    },
    {
      name: 'X-Api-Key and X-Api-Email (Pascal-Case)',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Api-Email': email,
      },
      params: {},
    },
    {
      name: 'Authorization Bearer Token (if API key is token)',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      params: {},
    },
    {
      name: 'Access-Token header (webhook style)',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': apiKey,
      },
      params: {},
    },
    {
      name: 'Email and Password in headers',
      headers: {
        'Content-Type': 'application/json',
        'email': email,
        'password': apiKey,
      },
      params: {},
    },
    {
      name: 'Email and API Key in query params',
      headers: {
        'Content-Type': 'application/json',
      },
      params: {
        email: email,
        api_key: apiKey,
      },
    },
    {
      name: 'api_key and email in headers (underscore)',
      headers: {
        'Content-Type': 'application/json',
        'api_key': apiKey,
        'email': email,
      },
      params: {},
    },
  ];

  for (const combo of headerCombinations) {
    console.log(`Testing: ${combo.name}`);
    try {
      const response = await axios.get(`${apiUrl}/orders/V2/getOrders`, {
        headers: combo.headers,
        params: {
          limit: 1,
          offset: 0,
          ...combo.params,
        },
      });

      console.log(`✅ SUCCESS with ${combo.name}!`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Data structure:`, Object.keys(response.data));
      console.log('\n');
      return;
    } catch (error: any) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;

      if (status === 401) {
        console.log(`❌ 401 Unauthorized - Wrong credentials or headers`);
      } else if (status === 403) {
        console.log(`❌ 403 Forbidden - Credentials might be correct but no access`);
      } else if (status === 404) {
        console.log(`❌ 404 Not Found - Wrong endpoint`);
      } else {
        console.log(`❌ Error ${status}: ${message}`);
      }

      if (error.response?.data) {
        console.log(`   Response:`, error.response.data);
      }
      console.log('');
    }
  }

  console.log('\n⚠️  All authentication methods failed.');
  console.log('\nTroubleshooting steps:');
  console.log('1. Verify your API key is correct in Easyecom dashboard');
  console.log('2. Check that your email matches your Easyecom account');
  console.log('3. Ensure API access is enabled for your account');
  console.log('4. Contact Easyecom support for API documentation');
  console.log('5. Check if there are IP restrictions on your API key\n');
}

testEasyecomAuth().catch(console.error);
