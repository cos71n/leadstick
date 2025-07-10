#!/usr/bin/env node

/**
 * Interactive setup script for LeadStick environment variables
 * Run: node setup-env.js
 */

const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function setupEnvironment() {
  console.log('🔧 LeadStick Environment Setup\n');
  console.log('This will help you configure your API keys and settings.\n');

  const config = {};

  // Resend API Key
  console.log('📧 Email Configuration (Required)');
  console.log('Get your Resend API key from: https://resend.com/api-keys\n');
  
  config.RESEND_API_KEY = await askQuestion('Enter your Resend API key (re_...): ');
  
  if (!config.RESEND_API_KEY.startsWith('re_')) {
    console.log('⚠️  Warning: Resend API keys typically start with "re_"');
  }

  config.LEAD_EMAIL_RECIPIENT = await askQuestion('Enter recipient email for leads [leads@quickservicepro.com]: ') 
    || 'leads@quickservicepro.com';

  // GA4 Configuration (Optional)
  console.log('\n📊 Analytics Configuration (Optional)');
  console.log('Get GA4 credentials from: GA4 Admin → Data Streams → Measurement Protocol\n');
  
  const setupGA4 = await askQuestion('Set up GA4 server-side tracking? (y/n) [n]: ');
  
  if (setupGA4.toLowerCase() === 'y' || setupGA4.toLowerCase() === 'yes') {
    config.GA4_MEASUREMENT_ID = await askQuestion('Enter GA4 Measurement ID (G-...): ');
    config.GA4_API_SECRET = await askQuestion('Enter GA4 API Secret: ');
  } else {
    config.GA4_MEASUREMENT_ID = '';
    config.GA4_API_SECRET = '';
  }

  // Generate .env file
  const envContent = `# LeadStick Environment Variables
# Generated on ${new Date().toISOString()}

# Required: Resend API Key
RESEND_API_KEY=${config.RESEND_API_KEY}

# Email Configuration
LEAD_EMAIL_RECIPIENT=${config.LEAD_EMAIL_RECIPIENT}
LEAD_EMAIL_FROM=LeadStick <noreply@leadstick.com>

# GA4 Analytics (Optional)
GA4_MEASUREMENT_ID=${config.GA4_MEASUREMENT_ID}
GA4_API_SECRET=${config.GA4_API_SECRET}

# Environment
ENVIRONMENT=development
`;

  fs.writeFileSync('.env', envContent);
  
  console.log('\n✅ Environment configuration saved to .env');
  console.log('\n🚀 Next steps:');
  console.log('1. Start the worker: npm run worker:dev');
  console.log('2. Start the widget: npm run dev');
  console.log('3. Test the integration: node test-worker.js');
  console.log('\n📚 For production deployment, see DEPLOYMENT.md');

  rl.close();
}

// Check if .env already exists
if (fs.existsSync('.env')) {
  console.log('⚠️  .env file already exists!');
  rl.question('Do you want to overwrite it? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      setupEnvironment();
    } else {
      console.log('Setup cancelled. Edit .env manually if needed.');
      rl.close();
    }
  });
} else {
  setupEnvironment();
}