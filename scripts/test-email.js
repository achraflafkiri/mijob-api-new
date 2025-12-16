// scripts/test-email.js
// Run this script to test your email configuration
// Usage: node scripts/test-email.js

require('dotenv').config();
const nodemailer = require('nodemailer');

const testEmailConfiguration = async () => {
  console.log('='.repeat(60));
  console.log('📧 MIJOB - Email Configuration Test');
  console.log('='.repeat(60));
  console.log('');

  // Step 1: Check environment variables
  console.log('1️⃣ Checking environment variables...');
  console.log('');
  
  const config = {
    EMAIL_HOST: process.env.EMAIL_HOST,
    EMAIL_PORT: process.env.EMAIL_PORT,
    EMAIL_USERNAME: process.env.EMAIL_USERNAME,
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? '***configured***' : 'NOT SET',
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
    NODE_ENV: process.env.NODE_ENV
  };

  console.table(config);
  console.log('');

  // Check for missing critical variables
  const missingVars = [];
  if (!process.env.EMAIL_USERNAME) missingVars.push('EMAIL_USERNAME');
  if (!process.env.EMAIL_PASSWORD) missingVars.push('EMAIL_PASSWORD');

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(v => console.error(`   - ${v}`));
    console.log('');
    console.log('💡 To fix this:');
    console.log('   1. Create a .env file in your project root if it doesn\'t exist');
    console.log('   2. Add the following variables:');
    console.log('');
    console.log('   # For development (using Ethereal Email)');
    console.log('   EMAIL_USERNAME=your_ethereal_username');
    console.log('   EMAIL_PASSWORD=your_ethereal_password');
    console.log('');
    console.log('   # For production (using your SMTP server)');
    console.log('   EMAIL_HOST=smtp.yourprovider.com');
    console.log('   EMAIL_PORT=587');
    console.log('   EMAIL_USERNAME=your_email@domain.com');
    console.log('   EMAIL_PASSWORD=your_email_password');
    console.log('   EMAIL_FROM=noreply@mijob.ma');
    console.log('   EMAIL_FROM_NAME=MIJOB');
    console.log('');
    console.log('📚 To get free Ethereal credentials for testing:');
    console.log('   Visit: https://ethereal.email/create');
    console.log('');
    return;
  }

  // Step 2: Create transporter
  console.log('2️⃣ Creating email transporter...');
  console.log('');

  let transporter;
  try {
    const transportConfig = {
      host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    };

    // Add TLS options for port 587
    if (transportConfig.port === 587) {
      transportConfig.tls = {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      };
    }

    console.log('Transport configuration:', {
      host: transportConfig.host,
      port: transportConfig.port,
      secure: transportConfig.secure
    });
    console.log('');

    transporter = nodemailer.createTransporter(transportConfig);
    console.log('✅ Transporter created successfully');
    console.log('');
  } catch (error) {
    console.error('❌ Failed to create transporter:', error.message);
    return;
  }

  // Step 3: Verify connection
  console.log('3️⃣ Verifying SMTP connection...');
  console.log('');

  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!');
    console.log('');
  } catch (error) {
    console.error('❌ SMTP connection failed:');
    console.error('   Error:', error.message);
    console.error('   Code:', error.code);
    console.log('');
    console.log('💡 Common issues:');
    console.log('   - Incorrect EMAIL_HOST');
    console.log('   - Incorrect EMAIL_PORT');
    console.log('   - Wrong EMAIL_USERNAME or EMAIL_PASSWORD');
    console.log('   - Firewall blocking outgoing SMTP connections');
    console.log('   - 2FA enabled without app-specific password');
    console.log('');
    return;
  }

  // Step 4: Send test email
  console.log('4️⃣ Sending test email...');
  console.log('');

  const testEmail = process.env.EMAIL_USERNAME; // Send to same address for testing

  const mailOptions = {
    from: `${process.env.EMAIL_FROM_NAME || 'MIJOB Test'} <${process.env.EMAIL_FROM || process.env.EMAIL_USERNAME}>`,
    to: testEmail,
    subject: 'MIJOB - Test Email Configuration',
    text: 'This is a test email from MIJOB. If you receive this, your email configuration is working correctly!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #247F6E;">MIJOB Email Test</h2>
        <p>Congratulations! Your email configuration is working correctly.</p>
        <div style="background-color: #f0f9ff; padding: 15px; border-left: 4px solid #247F6E; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold;">Configuration Details:</p>
          <ul style="margin: 10px 0;">
            <li>Host: ${process.env.EMAIL_HOST || 'smtp.ethereal.email'}</li>
            <li>Port: ${process.env.EMAIL_PORT || 587}</li>
            <li>Environment: ${process.env.NODE_ENV || 'development'}</li>
          </ul>
        </div>
        <p>You can now send verification emails to your users!</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">MIJOB Email Test Script</p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully!');
    console.log('');
    console.log('📧 Email details:');
    console.log('   Message ID:', info.messageId);
    console.log('   To:', testEmail);
    console.log('   Subject:', mailOptions.subject);
    console.log('');

    // Show preview URL for Ethereal
    if (process.env.EMAIL_HOST === 'smtp.ethereal.email' || !process.env.EMAIL_HOST) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('🌐 Preview URL (Ethereal):');
        console.log('   ' + previewUrl);
        console.log('');
      }
    }

    console.log('='.repeat(60));
    console.log('✅ All tests passed! Your email configuration is working.');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('❌ Failed to send test email:');
    console.error('   Error:', error.message);
    console.error('   Code:', error.code);
    console.log('');
  }
};

// Run the test
testEmailConfiguration().catch(console.error);