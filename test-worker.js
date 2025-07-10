#!/usr/bin/env node

/**
 * Test script for LeadStick Worker API
 * Run: node test-worker.js
 */

const API_URL = 'http://localhost:8787';

async function testWorkerAPI() {
  console.log('🧪 Testing LeadStick Worker API...\n');

  // Test data
  const testLead = {
    location: 'Burleigh Heads',
    service: 'Kitchen benchtop installation',
    name: 'John Test',
    phone: '0412 345 678',
    email: 'test@example.com',
    business: 'Stone Quoter',
    timestamp: new Date().toISOString(),
    source: 'leadstick-widget'
  };

  try {
    // Test 1: CORS Preflight
    console.log('1️⃣ Testing CORS preflight...');
    const preflightResponse = await fetch(API_URL, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    console.log(`   Status: ${preflightResponse.status}`);
    console.log(`   CORS Origin: ${preflightResponse.headers.get('Access-Control-Allow-Origin')}`);
    console.log(`   ✅ CORS preflight ${preflightResponse.status === 200 ? 'passed' : 'failed'}\n`);

    // Test 2: Lead Submission
    console.log('2️⃣ Testing lead submission...');
    const leadResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify(testLead)
    });

    const result = await leadResponse.json();
    console.log(`   Status: ${leadResponse.status}`);
    console.log(`   Response:`, result);
    console.log(`   ✅ Lead submission ${leadResponse.status === 200 ? 'passed' : 'failed'}\n`);

    // Test 3: Invalid Request
    console.log('3️⃣ Testing validation (missing fields)...');
    const invalidResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: 'Test' }) // Missing required fields
    });

    const invalidResult = await invalidResponse.json();
    console.log(`   Status: ${invalidResponse.status}`);
    console.log(`   Response:`, invalidResult);
    console.log(`   ✅ Validation ${invalidResponse.status === 400 ? 'passed' : 'failed'}\n`);

    // Test 4: Method Not Allowed
    console.log('4️⃣ Testing GET method (should fail)...');
    const getResponse = await fetch(API_URL, {
      method: 'GET'
    });

    const getResult = await getResponse.json();
    console.log(`   Status: ${getResponse.status}`);
    console.log(`   Response:`, getResult);
    console.log(`   ✅ Method validation ${getResponse.status === 405 ? 'passed' : 'failed'}\n`);

    console.log('🎉 All tests completed!');
    console.log('\n💡 Note: Email and GA4 tracking will show warnings if API keys are not configured.');
    console.log('   This is expected in local testing.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the worker is running: npm run worker:dev');
  }
}

// Run tests
testWorkerAPI();