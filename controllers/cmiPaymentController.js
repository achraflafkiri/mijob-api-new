// controllers/cmiPaymentController.js

const crypto = require('crypto');
const User = require('../models/User');

// CMI Configuration (Store in .env file)
const CMI_CONFIG = {
  storeKey: process.env.CMI_STORE_KEY, // Your CMI store key
  merchantId: process.env.CMI_MERCHANT_ID, // Your merchant ID
  okUrl: process.env.CMI_OK_URL || 'https://yourdomain.com/api/payment/cmi/success',
  failUrl: process.env.CMI_FAIL_URL || 'https://yourdomain.com/api/payment/cmi/fail',
  callbackUrl: process.env.CMI_CALLBACK_URL || 'https://yourdomain.com/api/payment/cmi/callback',
  shopUrl: process.env.CMI_SHOP_URL || 'https://yourdomain.com',
  currency: '504', // MAD (Moroccan Dirham)
  language: 'fr' // or 'ar', 'en'
};

/**
 * Initiate CMI Payment
 * Creates payment form data to redirect user to CMI payment gateway
 */
exports.initiatePayment = async (req, res) => {
  try {
    const { amount, description, userEmail } = req.body;
    const userId = req.user.id;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if payment is locked
    if (user.isPaymentLocked()) {
      return res.status(403).json({
        success: false,
        message: 'Payment temporarily locked due to multiple failed attempts'
      });
    }

    // Generate order ID (unique transaction reference)
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Generate CMI customer reference
    const clientId = user.generateCMIReference();
    await user.save();

    // Format amount (CMI expects amount in smallest currency unit, e.g., cents)
    const formattedAmount = (parseFloat(amount) * 100).toFixed(0);

    // Prepare CMI parameters
    const cmiParams = {
      clientid: CMI_CONFIG.merchantId,
      amount: formattedAmount,
      currency: CMI_CONFIG.currency,
      oid: orderId,
      okUrl: CMI_CONFIG.okUrl,
      failUrl: CMI_CONFIG.failUrl,
      callbackUrl: CMI_CONFIG.callbackUrl,
      shopurl: CMI_CONFIG.shopUrl,
      trantype: 'PreAuth', // or 'Auth' for direct payment
      BillToName: user.fullName || user.email,
      BillToCompany: user.userType === 'entreprise' ? user.raisonSociale : '',
      email: user.email,
      tel: user.phone || '',
      BillToStreet1: user.address || user.billingInfo?.address || '',
      BillToCity: user.city || user.billingInfo?.city || '',
      BillToPostalCode: user.billingInfo?.postalCode || '',
      BillToCountry: 'MA',
      lang: user.cmiConfig?.preferredLanguage || CMI_CONFIG.language,
      encoding: 'UTF-8',
      storetype: '3D_PAY_HOSTING', // 3D Secure
      rnd: Date.now().toString(),
      // Optional: For tokenization (saving card)
      ...(req.body.saveCard && {
        EXTRA_CARDSAVINGCARD: 'Y',
        EXTRA_CARDSAVINGCARD_REQUEST: 'Y'
      })
    };

    // Generate hash (security signature)
    const hashData = Object.keys(cmiParams)
      .sort()
      .map(key => cmiParams[key])
      .join('|');
    
    const hash = crypto
      .createHmac('sha512', CMI_CONFIG.storeKey)
      .update(hashData)
      .digest('base64');

    cmiParams.hash = hash;

    // Store transaction in database (create a Transaction model for this)
    // await Transaction.create({
    //   orderId,
    //   userId: user._id,
    //   amount: amount,
    //   currency: 'MAD',
    //   status: 'pending',
    //   cmiParams: cmiParams
    // });

    // Return form data to frontend
    res.status(200).json({
      success: true,
      message: 'Payment initiated',
      data: {
        paymentUrl: 'https://testpayment.cmi.co.ma/fim/est3Dgate', // Test URL
        // Production: 'https://payment.cmi.co.ma/fim/est3Dgate'
        formData: cmiParams,
        orderId: orderId
      }
    });

  } catch (error) {
    console.error('CMI Payment Initiation Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error initiating payment',
      error: error.message
    });
  }
};

/**
 * CMI Success Callback
 * Handle successful payment response from CMI
 */
exports.handleSuccess = async (req, res) => {
  try {
    const cmiResponse = req.body;

    // Verify hash from CMI
    const receivedHash = cmiResponse.HASH;
    const receivedHashParamsVal = cmiResponse.HASHPARAMSVAL;
    
    // Reconstruct hash to verify
    const hashParams = receivedHashParamsVal.split('|');
    const hashData = hashParams.map(param => cmiResponse[param]).join('|');
    
    const calculatedHash = crypto
      .createHmac('sha512', CMI_CONFIG.storeKey)
      .update(hashData)
      .digest('base64');

    // Verify hash matches
    if (calculatedHash !== receivedHash) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hash - possible fraud attempt'
      });
    }

    // Check transaction status
    const procReturnCode = cmiResponse.ProcReturnCode;
    const orderId = cmiResponse.oid;
    const amount = parseFloat(cmiResponse.amount) / 100; // Convert back from cents

    if (procReturnCode === '00') {
      // Payment successful
      
      // Find user by order ID (you need to store orderId with userId in Transaction)
      // const transaction = await Transaction.findOne({ orderId });
      // const user = await User.findById(transaction.userId);

      // For demo, get user from session or token
      const user = await User.findById(req.user?.id);

      if (user) {
        // Save card if requested and token provided
        if (cmiResponse.EXTRA_CARDSAVINGCARD === 'Y' && cmiResponse.cardToken) {
          await user.addPaymentMethod({
            cmiToken: cmiResponse.cardToken,
            cardType: cmiResponse.cardType?.toLowerCase() || 'visa',
            last4: cmiResponse.maskedCreditCard?.slice(-4),
            maskedCardNumber: cmiResponse.maskedCreditCard,
            cardholderName: cmiResponse.BillToName,
            bankName: cmiResponse.cardIssuer,
            isDefault: user.paymentMethods.length === 0,
            isVerified: true,
            threeDSecureEnabled: true
          });
        }

        // Record successful payment
        await user.recordSuccessfulPayment(amount, null);

        // Update transaction status
        // await transaction.updateOne({ status: 'success', cmiResponse });
      }

      // Redirect to success page
      return res.redirect(`${CMI_CONFIG.shopUrl}/payment/success?orderId=${orderId}`);
    } else {
      // Payment failed
      const user = await User.findById(req.user?.id);
      if (user) {
        await user.recordFailedPayment(amount);
      }

      // Redirect to failure page
      return res.redirect(`${CMI_CONFIG.shopUrl}/payment/failed?error=${cmiResponse.ErrMsg}`);
    }

  } catch (error) {
    console.error('CMI Success Callback Error:', error);
    res.redirect(`${CMI_CONFIG.shopUrl}/payment/error`);
  }
};

/**
 * CMI Fail Callback
 * Handle failed payment response from CMI
 */
exports.handleFail = async (req, res) => {
  try {
    const cmiResponse = req.body;
    const orderId = cmiResponse.oid;
    const errorMsg = cmiResponse.ErrMsg;
    const amount = parseFloat(cmiResponse.amount) / 100;

    // Update user payment history
    const user = await User.findById(req.user?.id);
    if (user) {
      await user.recordFailedPayment(amount);
    }

    // Update transaction
    // await Transaction.updateOne(
    //   { orderId },
    //   { status: 'failed', errorMessage: errorMsg, cmiResponse }
    // );

    res.redirect(`${CMI_CONFIG.shopUrl}/payment/failed?orderId=${orderId}&error=${errorMsg}`);

  } catch (error) {
    console.error('CMI Fail Callback Error:', error);
    res.redirect(`${CMI_CONFIG.shopUrl}/payment/error`);
  }
};

/**
 * CMI Callback (Server-to-Server)
 * This is called by CMI server directly (not through browser)
 */
exports.handleCallback = async (req, res) => {
  try {
    const cmiResponse = req.body;

    // Verify hash
    const receivedHash = cmiResponse.HASH;
    const receivedHashParamsVal = cmiResponse.HASHPARAMSVAL;
    
    const hashParams = receivedHashParamsVal.split('|');
    const hashData = hashParams.map(param => cmiResponse[param]).join('|');
    
    const calculatedHash = crypto
      .createHmac('sha512', CMI_CONFIG.storeKey)
      .update(hashData)
      .digest('base64');

    if (calculatedHash !== receivedHash) {
      return res.status(400).send('ACTION=FAILURE');
    }

    const orderId = cmiResponse.oid;
    const procReturnCode = cmiResponse.ProcReturnCode;

    // Update transaction in database
    // const transaction = await Transaction.findOneAndUpdate(
    //   { orderId },
    //   {
    //     status: procReturnCode === '00' ? 'success' : 'failed',
    //     cmiResponse,
    //     callbackReceivedAt: new Date()
    //   }
    // );

    // Send response to CMI
    if (procReturnCode === '00') {
      res.status(200).send('ACTION=POSTAUTH');
    } else {
      res.status(200).send('ACTION=FAILURE');
    }

  } catch (error) {
    console.error('CMI Callback Error:', error);
    res.status(500).send('ACTION=FAILURE');
  }
};

/**
 * Add Payment Method Directly (Without CMI - Temporary until CMI integration)
 * This saves the card details directly to the user model
 */
exports.addPaymentMethodDirect = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      cardType,
      last4,
      maskedCardNumber,
      expiryMonth,
      expiryYear,
      cardholderName,
      isDefault,
      saveCard
    } = req.body;

    // Validate required fields
    if (!last4 || !expiryMonth || !expiryYear || !cardholderName) {
      return res.status(400).json({
        success: false,
        message: 'Informations de carte incomplètes'
      });
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Check if user has reached payment method limit (optional)
    if (user.paymentMethods && user.paymentMethods.length >= 5) {
      return res.status(400).json({
        success: false,
        message: 'Limite de cartes enregistrées atteinte (5 maximum)'
      });
    }

    // Prepare payment method data
    const paymentMethodData = {
      cardType: cardType || 'visa',
      last4: last4,
      maskedCardNumber: maskedCardNumber || `XXXX-XXXX-XXXX-${last4}`,
      expiryMonth: expiryMonth.padStart(2, '0'),
      expiryYear: expiryYear,
      cardholderName: cardholderName.toUpperCase(),
      isDefault: isDefault !== undefined ? isDefault : user.paymentMethods.length === 0,
      isVerified: true, // Auto-verify for direct save
      threeDSecureEnabled: false, // Will be true with CMI
      status: 'active',
      addedAt: new Date()
    };

    // Add payment method to user
    await user.addPaymentMethod(paymentMethodData);

    console.log('✅ Payment method added successfully for user:', userId);

    res.status(200).json({
      success: true,
      message: 'Carte enregistrée avec succès',
      data: {
        paymentMethod: {
          id: user.paymentMethods[user.paymentMethods.length - 1]._id,
          cardType: paymentMethodData.cardType,
          last4: paymentMethodData.last4,
          maskedCardNumber: paymentMethodData.maskedCardNumber,
          expiryMonth: paymentMethodData.expiryMonth,
          expiryYear: paymentMethodData.expiryYear,
          cardholderName: paymentMethodData.cardholderName,
          isDefault: paymentMethodData.isDefault,
          status: paymentMethodData.status
        }
      }
    });

  } catch (error) {
    console.error('❌ Add payment method error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement de la carte',
      error: error.message
    });
  }
};

/**
 * Get user's saved payment methods
 */
exports.getPaymentMethods = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+paymentMethods');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Return payment methods without sensitive data
    const paymentMethods = user.paymentMethods.map(pm => ({
      id: pm._id,
      cardType: pm.cardType,
      last4: pm.last4,
      maskedCardNumber: pm.maskedCardNumber,
      bankName: pm.bankName,
      expiryMonth: pm.expiryMonth,
      expiryYear: pm.expiryYear,
      cardholderName: pm.cardholderName,
      isDefault: pm.isDefault,
      status: pm.status,
      isExpired: user.isPaymentMethodExpired(pm._id),
      addedAt: pm.addedAt,
      lastUsedAt: pm.lastUsedAt
    }));

    res.status(200).json({
      success: true,
      data: {
        paymentMethods,
        paymentHistory: user.paymentHistory
      }
    });

  } catch (error) {
    console.error('Get Payment Methods Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment methods',
      error: error.message
    });
  }
};

/**
 * Delete a payment method
 */
exports.deletePaymentMethod = async (req, res) => {
  try {
    const { paymentMethodId } = req.params;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await user.removePaymentMethod(paymentMethodId);

    res.status(200).json({
      success: true,
      message: 'Payment method deleted successfully'
    });

  } catch (error) {
    console.error('Delete Payment Method Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting payment method',
      error: error.message
    });
  }
};

/**
 * Set default payment method
 */
exports.setDefaultPaymentMethod = async (req, res) => {
  try {
    const { paymentMethodId } = req.params;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await user.setDefaultPaymentMethod(paymentMethodId);

    res.status(200).json({
      success: true,
      message: 'Default payment method updated'
    });

  } catch (error) {
    console.error('Set Default Payment Method Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting default payment method',
      error: error.message
    });
  }
};