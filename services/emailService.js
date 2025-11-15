const nodemailer = require('nodemailer');

// Create transporter with Gmail
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail', // ← Change from 'mail' to 'gmail'
    auth: {
      user: 'achraf.lafkiri.2@gmail.com',
      pass: 'cnbc cdpc olqt wbdm' // Keep spaces in app password
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