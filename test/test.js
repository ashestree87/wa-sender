const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
let token = '';
let campaignId = '';

async function runTests() {
  try {
    // Register user
    console.log('1. Testing user registration...');
    const registerResponse = await axios.post(`${API_URL}/auth/register`, {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });
    console.log('Registration successful:', registerResponse.data);

    // Login
    console.log('\n2. Testing login...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'test@example.com',
      password: 'password123'
    });
    token = loginResponse.data.token;
    console.log('Login successful, token received');

    // Create campaign
    console.log('\n3. Creating test campaign...');
    const campaignResponse = await axios.post(
      `${API_URL}/campaigns`,
      {
        name: 'Test Campaign',
        description: 'Testing WhatsApp automation',
        messageTemplate: 'Hi {name}, this is a test message!',
        useAI: true,
        aiPrompt: 'Make the message friendly and casual',
        scheduledStartTime: new Date(Date.now() + 3600000) // 1 hour from now
      },
      {
        headers: { 'x-auth-token': token }
      }
    );
    campaignId = campaignResponse.data.id;
    console.log('Campaign created:', campaignResponse.data);

    // Add recipients
    console.log('\n4. Adding recipients to campaign...');
    const recipientsResponse = await axios.post(
      `${API_URL}/campaigns/${campaignId}/recipients`,
      {
        recipients: [
          {
            phoneNumber: '1234567890',
            name: 'John Doe'
          },
          {
            phoneNumber: '0987654321',
            name: 'Jane Smith'
          }
        ]
      },
      {
        headers: { 'x-auth-token': token }
      }
    );
    console.log('Recipients added:', recipientsResponse.data);

    // Get campaign details
    console.log('\n5. Getting campaign details...');
    const campaignDetailsResponse = await axios.get(
      `${API_URL}/campaigns/${campaignId}`,
      {
        headers: { 'x-auth-token': token }
      }
    );
    console.log('Campaign details:', campaignDetailsResponse.data);

    // Get campaign recipients
    console.log('\n6. Getting campaign recipients...');
    const recipientsListResponse = await axios.get(
      `${API_URL}/campaigns/${campaignId}/recipients`,
      {
        headers: { 'x-auth-token': token }
      }
    );
    console.log('Campaign recipients:', recipientsListResponse.data);

  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

runTests(); 