// utils/email.js - IMPROVED VERSION WITH BETTER ERROR HANDLING

const nodemailer = require('nodemailer');

// Create reusable transporter with validation
const createTransporter = () => {
  // Validate environment variables
  if (!process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
    console.error('❌ EMAIL_USERNAME or EMAIL_PASSWORD not configured');
    throw new Error('Email configuration missing. Please check EMAIL_USERNAME and EMAIL_PASSWORD in .env');
  }

  console.log('📧 Email configuration:', {
    host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
    port: process.env.EMAIL_PORT || 587,
    user: process.env.EMAIL_USERNAME ? '***configured***' : 'NOT SET',
    pass: process.env.EMAIL_PASSWORD ? '***configured***' : 'NOT SET'
  });

  // For development, use Ethereal email or configured SMTP
  if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_HOST) {
    console.log('📧 Using Ethereal email (development mode)');
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  // For production or when EMAIL_HOST is configured
  console.log('📧 Using configured SMTP server');
  const transportConfig = {
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: (process.env.EMAIL_PORT === '465'), // true for 465, false for 587
    auth: {
      user: process.env.EMAIL_USERNAME || "client.mijob@gmail.com",
      pass: process.env.EMAIL_PASSWORD || "cejvuuwynzyuxhoq"
    }
  };

  // EMAIL_HOST=smtp.gmail.com
  // EMAIL_PORT=
  // EMAIL_USERNAME=
  // EMAIL_PASSWORD=
  // EMAIL_FROM=noreply@mijob.ma
  // EMAIL_FROM_NAME=MIJOB

  // Add TLS options if needed
  if (transportConfig.port === 587) {
    transportConfig.tls = {
      ciphers: 'SSLv3',
      rejectUnauthorized: false
    };
  }

  return nodemailer.createTransport(transportConfig);
};

// Verify transporter connection
const verifyConnection = async (transporter) => {
  try {
    await transporter.verify();
    console.log('✅ SMTP server connection verified');
    return true;
  } catch (error) {
    console.error('❌ SMTP server connection failed:', error.message);
    return false;
  }
};

// Send email function with improved error handling
exports.sendEmail = async (options) => {
  try {
    console.log('📤 Attempting to send email to:', options.email);

    const transporter = createTransporter();

    // Verify connection before sending
    const isConnected = await verifyConnection(transporter);
    if (!isConnected) {
      throw new Error('Failed to connect to email server');
    }

    // Define email options
    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME || 'MIJOB'} <${process.env.EMAIL_FROM || 'noreply@mijob.ma'}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html || options.message
    };

    console.log('📧 Mail options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Email sent successfully');
    console.log('📧 Message ID:', info.messageId);
    console.log('📧 Response:', info.response);

    // Preview URL (only for Ethereal)
    if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_HOST) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log('📧 Preview URL:', previewUrl);
    }

    return info;
  } catch (error) {
    console.error('❌ Email sending failed');
    console.error('❌ Error message:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error stack:', error.stack);

    // Provide more specific error messages
    let errorMessage = 'L\'email n\'a pas pu être envoyé';

    if (error.code === 'EAUTH') {
      errorMessage = 'Erreur d\'authentification email. Vérifiez les identifiants SMTP.';
    } else if (error.code === 'ESOCKET') {
      errorMessage = 'Impossible de se connecter au serveur email.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Timeout lors de la connexion au serveur email.';
    } else if (error.responseCode === 550) {
      errorMessage = 'Adresse email invalide ou rejetée.';
    }

    throw new Error(errorMessage + ' (' + error.message + ')');
  }
};

// Send verification email
exports.sendVerificationEmail = async (user, verificationToken) => {
  const verificationURL = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;

  const message = `
    Bonjour ${user.firstName || user.entrepriseName},
    
    Bienvenue sur MIJOB !
    
    Veuillez vérifier votre adresse email en cliquant sur le lien ci-dessous :
    ${verificationURL}
    
    Ce lien expire dans 24 heures.
    
    Si vous n'avez pas créé de compte sur MIJOB, veuillez ignorer cet email.
    
    Cordialement,
    L'équipe MIJOB
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #247F6E;">Bonjour ${user.firstName || user.entrepriseName},</h2>
      <p>Bienvenue sur <strong>MIJOB</strong> !</p>
      <p>Veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous :</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationURL}" 
           style="background-color: #247F6E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Vérifier mon email
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">Ce lien expire dans 24 heures.</p>
      <p style="color: #666; font-size: 14px;">Si vous n'avez pas créé de compte sur MIJOB, veuillez ignorer cet email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">Cordialement,<br>L'équipe MIJOB</p>
    </div>
  `;

  await this.sendEmail({
    email: user.email,
    subject: 'Vérifiez votre adresse email - MIJOB',
    message,
    html
  });
};

// Send password reset email
exports.sendPasswordResetEmail = async (user, resetToken) => {
  const resetURL = `${process.env.CLIENT_URL}/auth/reset-password/${resetToken}`;

  const message = `
    Bonjour ${user.firstName || user.entrepriseName},
    
    Vous avez demandé la réinitialisation de votre mot de passe.
    
    Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :
    ${resetURL}
    
    Ce lien expire dans 1 heure.
    
    Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email.
    
    Cordialement,
    L'équipe MIJOB
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #247F6E;">Bonjour ${user.firstName || user.entrepriseName},</h2>
      <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
      <p>Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe :</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetURL}" 
           style="background-color: #247F6E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Réinitialiser mon mot de passe
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">Ce lien expire dans 1 heure.</p>
      <p style="color: #666; font-size: 14px;">Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">Cordialement,<br>L'équipe MIJOB</p>
    </div>
  `;

  await this.sendEmail({
    email: user.email,
    subject: 'Réinitialisation de mot de passe - MIJOB',
    message,
    html
  });
};

// Send welcome email after verification
exports.sendWelcomeEmail = async (user) => {
  const dashboardURL = `${process.env.CLIENT_URL}/dashboard`;

  const message = `
    Bonjour ${user.firstName || user.entrepriseName},
    
    Votre compte MIJOB a été vérifié avec succès !
    
    Vous pouvez maintenant accéder à toutes les fonctionnalités de la plateforme.
    
    ${user.userType === 'partimer' ? 'Commencez à explorer les missions disponibles et postulez à celles qui vous intéressent.' : 'Commencez à publier vos missions et trouvez les meilleurs talents.'}
    
    Visitez votre tableau de bord : ${dashboardURL}
    
    Cordialement,
    L'équipe MIJOB
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #247F6E;">Bienvenue sur MIJOB! 🎉</h2>
      <p>Bonjour <strong>${user.firstName || user.entrepriseName}</strong>,</p>
      <p>Votre compte MIJOB a été vérifié avec succès !</p>
      <p>Vous pouvez maintenant accéder à toutes les fonctionnalités de la plateforme.</p>
      <p>${user.userType === 'partimer' ? 'Commencez à explorer les missions disponibles et postulez à celles qui vous intéressent.' : 'Commencez à publier vos missions et trouvez les meilleurs talents.'}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${dashboardURL}" 
           style="background-color: #247F6E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Accéder à mon tableau de bord
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">Cordialement,<br>L'équipe MIJOB</p>
    </div>
  `;

  await this.sendEmail({
    email: user.email,
    subject: 'Bienvenue sur MIJOB ! 🎉',
    message,
    html
  });
};

module.exports = exports;