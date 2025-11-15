// utils/email.js

/* const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
  // For development, use Ethereal email (fake SMTP service)
  if (process.env.NODE_ENV === 'development') {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
      port: process.env.EMAIL_PORT || 587,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  // For production, use real SMTP service (e.g., SendGrid, Mailgun, AWS SES)
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Send email function
exports.sendEmail = async (options) => {
  try {
    const transporter = createTransporter();

    // Define email options
    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME || 'MIJOB'} <${process.env.EMAIL_FROM || 'noreply@mijob.ma'}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html || options.message
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log('Email sent:', info.messageId);
    
    // Preview URL (only for Ethereal)
    if (process.env.NODE_ENV === 'development') {
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    }

    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Email could not be sent');
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
  const resetURL = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
  
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

  await this.sendEmail({
    email: user.email,
    subject: 'Bienvenue sur MIJOB ! 🎉',
    message
  });
};

module.exports = exports;
*/


//////////////


// utils/email.js

const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
  // For development, use Ethereal email (fake SMTP service) or configured SMTP
  if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_HOST) {
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  // For production or when EMAIL_HOST is configured
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Send email function
exports.sendEmail = async (options) => {
  try {
    const transporter = createTransporter();

    // Define email options
    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME || 'MIJOB'} <${process.env.EMAIL_FROM || 'noreply@mijob.ma'}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html || options.message
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Email envoyé:', info.messageId);
    
    // Preview URL (only for Ethereal)
    if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_HOST) {
      console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
    }

    return info;
  } catch (error) {
    console.error('❌ Erreur d\'envoi d\'email:', error);
    throw new Error('L\'email n\'a pas pu être envoyé');
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
  const resetURL = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
  
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