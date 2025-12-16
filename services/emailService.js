// services/emailService.js
const nodemailer = require('nodemailer');

// Create transporter with Gmail
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail', // ← Change from 'mail' to 'gmail'
    auth: {
      // user: 'achraf.lafkiri.2@gmail.com',
      // pass: 'cnbc cdpc olqt wbdm' 
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Email templates
const templates = {
  'email-verification': (data) => ({
    subject: 'Verify Your Email - MIJOB',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Verify Your Email Address</h2>
        <p>Hello ${data.name},</p>
        <p>Thank you for registering with MIJOB. Please use the verification code below to verify your email address:</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="margin: 0; color: #333; letter-spacing: 5px;">${data.verificationCode}</h1>
        </div>
        <p>This code will expire in 24 hours.</p>
        <p>If you didn't create an account, please ignore this email.</p>
        <br>
        <p>Best regards,<br>The MIJOB Team</p>
      </div>
    `
  }),

  'password-reset': (data) => ({
    subject: 'Reset Your Password - MIJOB',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Reset Your Password</h2>
        <p>Hello ${data.name},</p>
        <p>You requested to reset your password. Click the button below to reset it:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.resetUrl}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>This link will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <br>
        <p>Best regards,<br>The MIJOB Team</p>
      </div>
    `
  }),

  'reclamation': (data) => ({
    subject: `New Reclamation: ${data.reclamationType} - MIJOB`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
              .header { background: #247F6E; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { padding: 20px; background: #f9f9f9; }
              .card { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #247F6E; }
              .label { font-weight: bold; color: #247F6E; margin-right: 10px; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
              .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
              .badge-new { background: #ffeb3b; color: #333; }
          </style>
      </head>
      <body>
          <div class="header">
              <h1>📝 New Reclamation Received</h1>
          </div>
          
          <div class="content">
              <div style="text-align: center; margin-bottom: 20px;">
                  <span class="badge badge-new">NEW CLAIM</span>
              </div>
              
              <div class="card">
                  <h3>📋 Claim Information</h3>
                  <p><span class="label">Claim ID:</span> ${data.reclamationId}</p>
                  <p><span class="label">Date:</span> ${data.date} at ${data.time}</p>
                  <p><span class="label">Type:</span> ${data.reclamationType.toUpperCase()}</p>
              </div>
              
              <div class="card">
                  <h3>👤 User Information</h3>
                  <p><span class="label">Name:</span> ${data.userName}</p>
                  <p><span class="label">Email:</span> ${data.userEmail}</p>
                  <p><span class="label">User Type:</span> ${data.userType}</p>
              </div>
              
              <div class="card">
                  <h3>📝 Description</h3>
                  <p style="background: #f8f8f8; padding: 15px; border-radius: 6px; white-space: pre-wrap;">
                      ${data.description}
                  </p>
              </div>
            
          </div>
          
          <div class="footer">
              <p>MIJOB Support Team</p>
              <p>This is an automated message. Please do not reply to this email.</p>
          </div>
      </body>
      </html>
    `
  })
};

// Send email
const sendEmail = async ({ email, subject, template, data }) => {
  try {
    const transport = createTransporter();
    const templateData = templates[template](data);

    const mailOptions = {
      from: '"MIJOB" <achraf.lafkiri.2@gmail.com>',
      to: email,
      subject: subject || templateData.subject,
      html: templateData.html
    };

    await transport.sendMail(mailOptions);
    console.log(`✅ Email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    throw new Error('Email could not be sent');
  }
};

module.exports = sendEmail;