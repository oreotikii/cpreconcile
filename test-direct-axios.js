require('dotenv').config();
const axios = require('axios');

async function testDirectAxios() {
  const email = process.env.EASYECOM_EMAIL;
  const password = process.env.EASYECOM_PASSWORD;
  const locationKey = process.env.EASYECOM_LOCATION_KEY;
  const apiKey = process.env.EASYECOM_API_KEY;

  console.log('\n=== Testing Direct Axios (no client instance) ===\n');

  try {
    // Direct axios call - mimicking what httpie does
    const response = await axios({
      method: 'POST',
      url: 'https://api.easyecom.io/access/token',
      headers: {
        'x-api-key': apiKey,
      },
      data: {
        email: email,
        password: password,
        location_key: locationKey,
      },
    });

    console.log('✅ SUCCESS!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    const token = response.data.token || response.data.access_token;
    if (token) {
      console.log('\n✅ Token received:', token.substring(0, 30) + '...');
    }
  } catch (error) {
    console.log('❌ FAILED');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

testDirectAxios();
