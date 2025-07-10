/**
 * Attribution Tracking Test Suite
 * Tests first-touch, last-touch, and multi-session attribution
 */

const API_URL = 'http://localhost:8787';

// Test data with different attribution scenarios
const testScenarios = [
  {
    name: 'Google Ads Lead',
    leadData: {
      location: 'Gold Coast',
      service: 'Kitchen benchtop installation',
      name: 'Sarah Johnson',
      phone: '0412 345 678',
      business: 'Stone Quoter',
      timestamp: new Date().toISOString(),
      source: 'leadstick-widget',
      attribution: {
        firstTouch: {
          source: 'google',
          medium: 'cpc',
          campaign: 'kitchen-benchtops-q2-2024',
          content: 'ad-variant-a',
          term: 'stone benchtops gold coast',
          gclid: 'CjwKCAjw5v2wBhBrEiwAXDDoJQwKvQx...',
          fbclid: '',
          msclkid: '',
          ttclid: '',
          landingPage: 'https://stonequoter.com.au/kitchen-benchtops?utm_source=google&utm_medium=cpc&utm_campaign=kitchen-benchtops-q2-2024&gclid=CjwKCAjw5v2wBhBrEiwAXDDoJQwKvQx...',
          referrer: 'https://www.google.com/',
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
        },
        lastTouch: {
          source: 'direct',
          medium: 'direct',
          campaign: '',
          content: '',
          term: '',
          gclid: '',
          fbclid: '',
          msclkid: '',
          ttclid: '',
          landingPage: 'https://stonequoter.com.au/',
          referrer: '',
          timestamp: new Date().toISOString()
        },
        sessionId: 'session_abc123_' + Date.now()
      }
    }
  },
  {
    name: 'Facebook Ads Lead',
    leadData: {
      location: 'Brisbane',
      service: 'Bathroom vanity top',
      name: 'Mike Chen',
      phone: '0423 456 789',
      business: 'Stone Quoter',
      timestamp: new Date().toISOString(),
      source: 'leadstick-widget',
      attribution: {
        firstTouch: {
          source: 'facebook',
          medium: 'social',
          campaign: 'bathroom-renovation-winter',
          content: 'carousel-ad-1',
          term: '',
          gclid: '',
          fbclid: 'IwAR3xJ8mN5pQwKvR2wBhBrEi...',
          msclkid: '',
          ttclid: '',
          landingPage: 'https://stonequoter.com.au/bathroom?utm_source=facebook&utm_medium=social&utm_campaign=bathroom-renovation-winter&fbclid=IwAR3xJ8mN5pQwKvR2wBhBrEi...',
          referrer: 'https://www.facebook.com/',
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // 1 day ago
        },
        lastTouch: {
          source: 'facebook',
          medium: 'social',
          campaign: 'bathroom-renovation-winter',
          content: 'carousel-ad-1',
          term: '',
          gclid: '',
          fbclid: 'IwAR3xJ8mN5pQwKvR2wBhBrEi...',
          msclkid: '',
          ttclid: '',
          landingPage: 'https://stonequoter.com.au/bathroom?utm_source=facebook&utm_medium=social&utm_campaign=bathroom-renovation-winter&fbclid=IwAR3xJ8mN5pQwKvR2wBhBrEi...',
          referrer: 'https://www.facebook.com/',
          timestamp: new Date().toISOString()
        },
        sessionId: 'session_def456_' + Date.now()
      }
    }
  },
  {
    name: 'Organic SEO Lead',
    leadData: {
      location: 'Sunshine Coast',
      service: 'Outdoor kitchen stone',
      name: 'Emma Wilson',
      phone: '0434 567 890',
      business: 'Stone Quoter',
      timestamp: new Date().toISOString(),
      source: 'leadstick-widget',
      attribution: {
        firstTouch: {
          source: 'google',
          medium: 'organic',
          campaign: '',
          content: '',
          term: '',
          gclid: '',
          fbclid: '',
          msclkid: '',
          ttclid: '',
          landingPage: 'https://stonequoter.com.au/outdoor-kitchens',
          referrer: 'https://www.google.com/',
          timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
        },
        lastTouch: {
          source: 'google',
          medium: 'organic',
          campaign: '',
          content: '',
          term: '',
          gclid: '',
          fbclid: '',
          msclkid: '',
          ttclid: '',
          landingPage: 'https://stonequoter.com.au/gallery',
          referrer: 'https://www.google.com/',
          timestamp: new Date().toISOString()
        },
        sessionId: 'session_ghi789_' + Date.now()
      }
    }
  },
  {
    name: 'Direct Traffic Lead',
    leadData: {
      location: 'Tweed Heads',
      service: 'Kitchen island benchtop',
      name: 'David Brown',
      phone: '0445 678 901',
      business: 'Stone Quoter',
      timestamp: new Date().toISOString(),
      source: 'leadstick-widget',
      attribution: {
        firstTouch: {
          source: 'direct',
          medium: 'direct',
          campaign: '',
          content: '',
          term: '',
          gclid: '',
          fbclid: '',
          msclkid: '',
          ttclid: '',
          landingPage: 'https://stonequoter.com.au/',
          referrer: '',
          timestamp: new Date().toISOString()
        },
        lastTouch: {
          source: 'direct',
          medium: 'direct',
          campaign: '',
          content: '',
          term: '',
          gclid: '',
          fbclid: '',
          msclkid: '',
          ttclid: '',
          landingPage: 'https://stonequoter.com.au/',
          referrer: '',
          timestamp: new Date().toISOString()
        },
        sessionId: 'session_jkl012_' + Date.now()
      }
    }
  }
];

async function testCORS() {
  console.log('🔍 Testing CORS preflight...');
  try {
    const response = await fetch(API_URL, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://stonequoter.com.au',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    console.log(`✅ CORS preflight: ${response.status} ${response.statusText}`);
    return true;
  } catch (error) {
    console.error('❌ CORS test failed:', error.message);
    return false;
  }
}

async function testAttributionScenario(scenario) {
  console.log(`\n📊 Testing: ${scenario.name}`);
  console.log(`   First Touch: ${scenario.leadData.attribution.firstTouch.source} (${scenario.leadData.attribution.firstTouch.medium})`);
  console.log(`   Last Touch: ${scenario.leadData.attribution.lastTouch.source} (${scenario.leadData.attribution.lastTouch.medium})`);
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://stonequoter.com.au'
      },
      body: JSON.stringify(scenario.leadData)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ Lead submitted successfully`);
      console.log(`   Lead ID: ${result.leadId}`);
      console.log(`   Email: ${result.email}`);
      console.log(`   Analytics: ${result.analytics}`);
      
      // Log attribution details
      const attribution = scenario.leadData.attribution;
      const daysToConvert = Math.floor((new Date(attribution.lastTouch.timestamp) - new Date(attribution.firstTouch.timestamp)) / (1000 * 60 * 60 * 24));
      console.log(`   Time to Convert: ${daysToConvert} days`);
      
      if (attribution.firstTouch.gclid) {
        console.log(`   Google Ads ID: ${attribution.firstTouch.gclid.substring(0, 20)}...`);
      }
      if (attribution.firstTouch.fbclid) {
        console.log(`   Facebook Ads ID: ${attribution.firstTouch.fbclid.substring(0, 20)}...`);
      }
      
      return true;
    } else {
      console.error(`❌ Lead submission failed: ${result.error || 'Unknown error'}`);
      console.error(`   Details: ${result.message || 'No details'}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Request failed: ${error.message}`);
    return false;
  }
}

async function testInvalidData() {
  console.log('\n🚫 Testing validation with invalid data...');
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        location: 'Gold Coast',
        // Missing required fields: service, name, phone
        attribution: {
          firstTouch: { source: 'test', medium: 'test', timestamp: new Date().toISOString() },
          lastTouch: { source: 'test', medium: 'test', timestamp: new Date().toISOString() },
          sessionId: 'test_session'
        }
      })
    });

    const result = await response.json();
    
    if (response.status === 400) {
      console.log(`✅ Validation working: ${response.status} ${response.statusText}`);
      console.log(`   Missing fields: ${result.missingFields?.join(', ')}`);
      return true;
    } else {
      console.error(`❌ Validation failed - expected 400, got ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Validation test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 LeadStick Attribution Tracking Test Suite');
  console.log('============================================\n');
  
  const results = {
    cors: false,
    scenarios: [],
    validation: false
  };
  
  // Test CORS
  results.cors = await testCORS();
  
  // Test each attribution scenario
  for (const scenario of testScenarios) {
    const success = await testAttributionScenario(scenario);
    results.scenarios.push({ name: scenario.name, success });
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Test validation
  results.validation = await testInvalidData();
  
  // Summary
  console.log('\n📋 Test Results Summary');
  console.log('=======================');
  console.log(`CORS: ${results.cors ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Validation: ${results.validation ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log('\nAttribution Scenarios:');
  results.scenarios.forEach(result => {
    console.log(`  ${result.name}: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
  });
  
  const totalTests = 2 + results.scenarios.length;
  const passedTests = (results.cors ? 1 : 0) + (results.validation ? 1 : 0) + results.scenarios.filter(r => r.success).length;
  
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests/totalTests) * 100)}%)`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All attribution tracking tests passed!');
    console.log('📧 Check your email for attribution-enhanced lead notifications.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the worker logs for details.');
  }
}

// Run the test suite
runAllTests().catch(console.error);