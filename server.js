require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint (required by Render)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Yoco API configuration
const YOCO_SECRET_KEY = process.env.YOCO_SECRET_KEY;
const YOCO_API_URL = 'https://payments.yoco.com/api/v1/checkouts';

// Create Yoco checkout session
app.post('/api/create-yoco-checkout', async (req, res) => {
  try {
    const { amountInCents, currency, successUrl, cancelUrl, metadata } = req.body;

    // Validate required fields
    if (!amountInCents || !currency || !successUrl || !cancelUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amountInCents, currency, successUrl, cancelUrl'
      });
    }

    if (!YOCO_SECRET_KEY) {
      console.error('YOCO_SECRET_KEY not configured');
      return res.status(500).json({
        success: false,
        error: 'Payment service not configured'
      });
    }

    // Create checkout session with Yoco
    const checkoutData = {
      amount: amountInCents,
      currency: currency,
      successUrl: successUrl,
      cancelUrl: cancelUrl,
      metadata: metadata || {}
    };

    console.log('Creating Yoco checkout session...');
    const yocoResponse = await axios.post(YOCO_API_URL, checkoutData, {
      headers: {
        'Authorization': Bearer ,
        'Content-Type': 'application/json'
      }
    });

    const checkoutId = yocoResponse.data.id;
    const redirectUrl = https://payments.yoco.com/checkout/;

    console.log('Yoco checkout created:', checkoutId);

    res.json({
      success: true,
      checkoutId: checkoutId,
      redirectUrl: redirectUrl
    });

  } catch (error) {
    console.error('Error creating Yoco checkout:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to create checkout session'
    });
  }
});

// Newsletter subscription
app.post('/api/newsletter-subscribe', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Email configuration
    const ZOHO_EMAIL = process.env.ZOHO_EMAIL;
    const ZOHO_PASSWORD = process.env.ZOHO_PASSWORD;

    if (!ZOHO_EMAIL || !ZOHO_PASSWORD) {
      console.error('Zoho email credentials not configured');
      return res.status(500).json({
        success: false,
        error: 'Email service not configured'
      });
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: 'smtp.zoho.com',
      port: 587,
      secure: false,
      auth: {
        user: ZOHO_EMAIL,
        pass: ZOHO_PASSWORD
      }
    });

    // Send subscription email
    const mailOptions = {
      from: ZOHO_EMAIL,
      to: ZOHO_EMAIL,
      subject: 'New Newsletter Subscription',
      text: New newsletter subscription:\n\nEmail: \nTimestamp: 
    };

    await transporter.sendMail(mailOptions);
    console.log('Newsletter subscription saved:', email);

    res.json({
      success: true,
      message: 'Successfully subscribed to newsletter'
    });

  } catch (error) {
    console.error('Error subscribing to newsletter:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to subscribe to newsletter'
    });
  }
});

// Track abandoned cart
app.post('/api/track-abandoned-cart', async (req, res) => {
  try {
    const cartData = req.body;
    
    // Log abandoned cart (you can extend this to save to database)
    console.log('Abandoned cart tracked:', JSON.stringify(cartData, null, 2));

    res.json({
      success: true,
      message: 'Cart tracked'
    });

  } catch (error) {
    console.error('Error tracking abandoned cart:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track cart'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(Server running on port );
  console.log(Health check: http://localhost:/health);
});
