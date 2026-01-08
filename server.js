const express = require('express');
const cors = require('cors');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;
const path = require('path');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const handlebars = require('handlebars');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// CORS configuration - allow all origins including GitHub Pages
app.use(cors({
  origin: '*', // Allow all origins (GitHub Pages, localhost, etc.)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-password', 'Accept'],
  exposedHeaders: ['Content-Type'],
  credentials: false
}));
app.use(express.json());

// ============================================
// YOCO API CONFIGURATION
// ============================================
// Get Yoco credentials from .env file
// Required in .env: YOCO_SECRET_KEY=your_secret_key_here
// API Endpoints:
// - Main API: https://api.yoco.com
// - Checkouts: https://payments.yoco.com/api/checkouts
// ============================================
const YOCO_API_URL = 'https://payments.yoco.com';
const YOCO_SECRET_KEY = process.env.YOCO_SECRET_KEY?.trim();

// ============================================
// TELEGRAM BOT CONFIGURATION (FREE)
// ============================================
// Telegram Chat ID to receive notifications - set in .env as TELEGRAM_CHAT_ID
// Telegram Bot Token - set in .env as TELEGRAM_BOT_TOKEN
// Get both for FREE from @BotFather on Telegram
// IMPORTANT: You must send a message to your bot first before it can message you!
// ============================================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID?.trim() ? String(process.env.TELEGRAM_CHAT_ID.trim()) : null;

// Initialize Telegram Bot (only if token is provided)
let telegramBot = null;
if (TELEGRAM_BOT_TOKEN) {
  try {
    telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
    console.log('✅ Telegram Bot initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Telegram Bot:', error.message);
  }
} else {
  console.warn('⚠️ WARNING: TELEGRAM_BOT_TOKEN is not set in .env file!');
  console.warn('   Notifications will not work until Telegram Bot is configured.');
  console.warn('   Get your FREE bot token from: https://t.me/BotFather');
  console.warn('   Get your chat ID by messaging @userinfobot on Telegram');
}

// Validate Yoco configuration
if (!YOCO_SECRET_KEY) {
  console.error('❌ ERROR: YOCO_SECRET_KEY is not set in .env file!');
  console.error('   Please add YOCO_SECRET_KEY=your_key to your .env file');
  process.exit(1);
}

console.log('✅ Yoco API configured');
console.log('   API URL:', `${YOCO_API_URL}/api/checkouts`);
console.log('   Key loaded:', YOCO_SECRET_KEY ? `Yes (${YOCO_SECRET_KEY.length} chars)` : 'No');

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check requested from:', req.headers.origin || req.headers.referer || 'unknown');
  res.json({ 
    status: 'ok', 
    message: 'Yoco Payment API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test endpoint to verify CORS and connectivity
app.get('/api/test', (req, res) => {
  console.log('Test endpoint requested from:', req.headers.origin || req.headers.referer || 'unknown');
  res.json({ 
    success: true, 
    message: 'Backend is reachable',
    backendUrl: 'https://saint-ventura-backend.onrender.com',
    timestamp: new Date().toISOString()
  });
});

// Keep-alive endpoint - ping this to keep server active
app.get('/keep-alive', (req, res) => {
  console.log('Keep-alive ping received at:', new Date().toISOString());
  res.json({ 
    status: 'alive', 
    message: 'Server is active',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Helper function to create admin notification
async function createNotification(title, message, type = 'info') {
  try {
    const notifications = await readDataFile('notifications');
    notifications.push({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type: type,
      title: title,
      message: message,
      date: new Date().toISOString(),
      read: false
    });
    await writeDataFile('notifications', notifications);
    console.log('✅ Notification created:', title);
  } catch (error) {
    console.error('❌ Error creating notification:', error);
  }
}

// Telegram messaging function (FREE - no costs!)
// Sends Telegram messages to the configured chat ID and creates admin notification
async function sendWhatsApp({ message, to, notificationTitle, notificationType }) {
  // Validate Telegram configuration
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ Telegram credentials not configured');
    console.error('   Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env file');
    console.error('   Get FREE bot token from: https://t.me/BotFather');
    console.error('   Get chat ID from: https://t.me/userinfobot');
    return { success: false, error: 'Telegram credentials not configured - check .env file' };
  }
  
  if (!telegramBot) {
    return { success: false, error: 'Telegram Bot not initialized' };
  }
  
  // Use provided chat ID or default (ensure it's a string)
  const chatId = String(to || TELEGRAM_CHAT_ID);
  
  console.log('📱 Preparing to send Telegram message...');
  console.log('   To Chat ID:', chatId);
  console.log('   Chat ID type:', typeof chatId);
  console.log('   Message length:', message.length, 'characters');
  
  // Send Telegram message with retry logic
  let lastError = null;
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📱 Attempting to send Telegram message (attempt ${attempt}/${maxRetries})...`);
      
      // Try sending with Markdown first, fallback to plain text if it fails
      let messageResult;
      try {
        messageResult = await telegramBot.sendMessage(chatId, message, {
          parse_mode: 'Markdown'
        });
      } catch (markdownError) {
        // If Markdown parsing fails, try without it
        console.log('   Markdown parse failed, trying plain text...');
        messageResult = await telegramBot.sendMessage(chatId, message);
      }
      
      console.log('✅ Telegram message sent successfully!');
      console.log('   To Chat ID:', chatId);
      console.log('   Message ID:', messageResult.message_id);
      
      // Create notification in admin dashboard
      if (notificationTitle) {
        // Extract plain text from message (remove markdown)
        const plainMessage = message.replace(/\*|\_|`/g, '').substring(0, 200);
        await createNotification(notificationTitle, plainMessage, notificationType || 'info');
      }
      
      return { success: true, messageId: messageResult.message_id, status: 'sent' };
    } catch (error) {
      lastError = error;
      console.error(`❌ Telegram attempt ${attempt}/${maxRetries} failed:`);
      console.error('   Error code:', error.code);
      console.error('   Error message:', error.message);
      console.error('   Error response:', error.response);
      
      // If it's a rate limit or temporary error and we have retries left, wait and retry
      if (attempt < maxRetries && (error.code === 'ETELEGRAM' || error.response?.statusCode === 429)) {
        const waitTime = attempt * 2; // Progressive backoff: 2s, 4s
        console.log(`   Retrying in ${waitTime} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        continue;
      }
      
      // For other errors or last attempt, return error
      break;
    }
  }
  
  // All retries failed
  console.error('❌ Telegram message failed after all retries');
  console.error('   Final error:', lastError?.message);
  console.error('   Error code:', lastError?.code);
  
  // Provide more detailed error message
  let errorMessage = lastError?.message || 'Telegram sending failed';
  const errorBody = lastError?.response?.body;
  const errorDescription = errorBody?.description || errorBody?.error_code ? ` (${errorBody.description || errorBody.error_code})` : '';
  
  if (lastError?.response?.statusCode === 401) {
    errorMessage = 'Telegram Bot token invalid. Please check TELEGRAM_BOT_TOKEN in .env file.';
  } else if (lastError?.response?.statusCode === 400) {
    if (errorBody?.description?.includes('chat not found') || errorBody?.description?.includes('chat_id')) {
      errorMessage = `Invalid chat ID or bot hasn't received a message from you yet. Please:\n1. Find your bot on Telegram (search for the username you created)\n2. Send it any message (like "Hello")\n3. Then try again. Current chat ID: ${TELEGRAM_CHAT_ID}${errorDescription}`;
    } else {
      errorMessage = `Invalid chat ID: ${errorBody?.description || 'Please check TELEGRAM_CHAT_ID in .env file'}${errorDescription}`;
    }
  } else if (lastError?.response?.statusCode === 429) {
    errorMessage = 'Rate limit exceeded. Please wait before sending more messages.';
  }
  
  console.error('   Full error details:', JSON.stringify({
    statusCode: lastError?.response?.statusCode,
    body: errorBody,
    message: lastError?.message
  }, null, 2));
  
  return { success: false, error: errorMessage, code: lastError?.code };
}

// Telegram test endpoint - test Telegram configuration
app.post('/api/test-email', async (req, res) => {
  try {
    const result = await sendWhatsApp({
      message: `🧪 *Test Telegram Message - Saint Ventura Backend*\n\nSent at: ${new Date().toISOString()}\nServer: ${process.env.NODE_ENV || 'development'}\n\nThis is a test message to verify Telegram notifications are working.`,
      to: TELEGRAM_CHAT_ID
    });
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: `Test Telegram message sent successfully to chat ID ${TELEGRAM_CHAT_ID}`,
        messageId: result.messageId,
        status: result.status
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: 'Failed to send test Telegram message',
        details: result.error || 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Telegram test error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Telegram test failed',
      code: error.code
    });
  }
});

// Internal keep-alive mechanism - ping ourselves every 10 minutes
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    const https = require('https');
    const url = process.env.BACKEND_URL || 'https://saint-ventura-backend.onrender.com';
    https.get(`${url}/keep-alive`, (res) => {
      console.log('Internal keep-alive ping sent, status:', res.statusCode);
    }).on('error', (err) => {
      console.log('Keep-alive ping failed (this is ok if server is starting):', err.message);
    });
  }, 10 * 60 * 1000); // Every 10 minutes
  
  console.log('Internal keep-alive mechanism started (pings every 10 minutes)');
}

// Create Yoco checkout session
app.post('/api/create-yoco-checkout', async (req, res) => {
  try {
    const {
      amountInCents,
      currency = 'ZAR',
      successUrl,
      cancelUrl,
      metadata
    } = req.body;

    // Validate required fields
    if (!amountInCents || amountInCents <= 0) {
      return res.status(400).json({ 
        error: 'Invalid amount. Amount must be greater than 0.' 
      });
    }

    if (!successUrl || !cancelUrl) {
      return res.status(400).json({ 
        error: 'Success URL and Cancel URL are required.' 
      });
    }

    // Validate URLs are HTTPS for live API
    if (successUrl && !successUrl.startsWith('https://')) {
      return res.status(400).json({ 
        error: 'Success URL must use HTTPS protocol for live transactions. Current: ' + successUrl
      });
    }
    
    if (cancelUrl && !cancelUrl.startsWith('https://')) {
      return res.status(400).json({ 
        error: 'Cancel URL must use HTTPS protocol for live transactions. Current: ' + cancelUrl
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
    
    console.log('Yoco checkout request data:', {
      amount: amountInCents,
      currency: currency,
      successUrl: successUrl,
      cancelUrl: cancelUrl,
      hasMetadata: !!metadata
    });

    // Call Yoco API to create checkout
    console.log('📞 Calling Yoco API:', `${YOCO_API_URL}/api/checkouts`);
    console.log('   Amount:', amountInCents, 'cents');
    console.log('   Currency:', currency);
    
    let response;
    let lastError;
    const maxRetries = 3;
    
    // Simple retry logic
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        response = await axios.post(
          `${YOCO_API_URL}/api/checkouts`,
          checkoutData,
          {
            headers: {
              'Authorization': `Bearer ${YOCO_SECRET_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );
        console.log('✅ Yoco API success on attempt', attempt);
        break;
      } catch (error) {
        lastError = error;
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        console.error(`❌ Yoco API attempt ${attempt}/${maxRetries} failed:`, status || message);
        
        if (attempt < maxRetries) {
          const delay = 1000 * attempt;
          console.log(`   Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    if (!response) {
      const errorMsg = lastError?.response?.data?.message || lastError?.message || 'Unknown error';
      throw new Error(`Yoco API failed: ${errorMsg}`);
    }

    // Log full Yoco response for debugging
    console.log('📦 Full Yoco API response:', JSON.stringify(response.data, null, 2));
    
    // Extract checkout ID and URL from Yoco response
    // Yoco API returns: { id: "checkout_id", redirectUrl: "https://..." }
    const checkoutId = response.data?.id || response.data?.checkoutId;
    
    if (!checkoutId) {
      console.error('❌ Invalid Yoco response - no checkout ID');
      console.error('   Response keys:', Object.keys(response.data || {}));
      console.error('   Full response:', response.data);
      throw new Error('Invalid response from Yoco API - no checkout ID');
    }
    
    // Get redirect URL from response or construct it
    // Yoco typically returns redirectUrl in the response
    let redirectUrl = response.data.redirectUrl || 
                     response.data.url || 
                     response.data.checkoutUrl ||
                     response.data.link;
    
    // If no redirect URL, construct it using the checkout ID
    // Use the standard Yoco checkout URL that works on all devices
    if (!redirectUrl) {
      // Standard Yoco checkout URL format - works on all devices (mobile, desktop, tablet)
      redirectUrl = `https://payments.yoco.com/checkout/${checkoutId}`;
      console.log('⚠️ No redirectUrl in response, constructing:', redirectUrl);
    }
    
    // Ensure the URL is a full HTTPS URL (required for all devices)
    if (redirectUrl && !redirectUrl.startsWith('http')) {
      redirectUrl = `https://${redirectUrl}`;
    }
    
    // Validate the redirect URL is a valid Yoco URL
    if (!redirectUrl.includes('yoco.com') && !redirectUrl.includes('checkout')) {
      console.error('⚠️ Warning: Redirect URL does not appear to be a Yoco checkout URL:', redirectUrl);
    }
    
    console.log('✅ Checkout created successfully!');
    console.log('   Checkout ID:', checkoutId);
    console.log('   Redirect URL:', redirectUrl);
    
    // Send success response to frontend
    res.json({
      success: true,
      checkoutId: checkoutId,
      redirectUrl: redirectUrl
    });

  } catch (error) {
    // Detailed error logging
    const status = error.response?.status || 500;
    const errorData = error.response?.data;
    const errorMessage = errorData?.message || errorData?.error || error.message || 'Failed to create checkout';
    
    console.error('❌ Checkout error occurred:');
    console.error('   Status:', status);
    console.error('   Message:', errorMessage);
    console.error('   Error data:', JSON.stringify(errorData, null, 2));
    
    // Log request details for debugging
    if (error.config) {
      console.error('   Request URL:', error.config.url);
      console.error('   Request method:', error.config.method);
    }
    
    // User-friendly error messages
    let userMessage = errorMessage;
    if (status === 401 || status === 403) {
      userMessage = 'Authentication failed. Check YOCO_SECRET_KEY in .env file.';
      console.error('   ⚠️ This is an authentication error - check your API key!');
    } else if (status === 404) {
      userMessage = 'Yoco API endpoint not found. Check API URL.';
      console.error('   ⚠️ This is a 404 error - check the API endpoint URL!');
    } else if (!error.response) {
      userMessage = 'Cannot connect to Yoco API. Check internet connection.';
      console.error('   ⚠️ No response from Yoco - network issue!');
    }
    
    res.status(status).json({ 
      success: false,
      error: userMessage 
    });
  }
});

// Contact form email endpoint (updated to store in inbox)
app.post('/api/contact-form', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        success: false,
        error: 'Name, email, subject, and message are required' 
      });
    }

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ 
        success: false,
        error: 'Valid email address is required' 
      });
    }

    // Store in inbox
    try {
      const inbox = await readDataFile('inbox');
      inbox.push({
        id: Date.now().toString(),
        from: email,
        name: name,
        phone: phone || '',
        subject: subject,
        body: message,
        date: new Date().toISOString(),
        read: false
      });
      await writeDataFile('inbox', inbox);

      // Create notification
      const notifications = await readDataFile('notifications');
      notifications.push({
        id: Date.now().toString(),
        type: 'contact',
        title: 'New Contact Form Submission',
        message: `${name} (${email}): ${subject}`,
        date: new Date().toISOString(),
        read: false
      });
      await writeDataFile('notifications', notifications);
    } catch (error) {
      console.error('Error storing contact form in inbox:', error);
    }

    // Send Telegram message to support
    const telegramMessage = `📧 *New Contact Form Submission*\n\n*Name:* ${name}\n*Email:* ${email}\n*Phone:* ${phone || 'Not provided'}\n*Subject:* ${subject}\n\n*Message:*\n${message}`;
    
    sendWhatsApp({
      message: telegramMessage,
      to: TELEGRAM_CHAT_ID
    }).then(result => {
      if (result.success) {
        console.log(`✅ Contact form Telegram message SENT successfully to chat ID ${TELEGRAM_CHAT_ID}`);
        console.log('Telegram details:', { 
          messageId: result.messageId,
          status: result.status,
          to: TELEGRAM_CHAT_ID,
          name: name,
          email: email
        });
      }
    }).catch(error => {
      console.error(`❌ FAILED to send contact form Telegram message to chat ID ${TELEGRAM_CHAT_ID}`);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: name,
        email: email
      });
    });
    
    // Return success immediately (email sends in background)
    res.json({ 
      success: true, 
      message: 'Contact form submitted successfully' 
    });

  } catch (error) {
    console.error('Error sending contact form email:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to send contact form';
    
    if (error.response?.statusCode === 401) {
      errorMessage = 'Telegram Bot token invalid. Please check TELEGRAM_BOT_TOKEN in .env file.';
      console.error('Authentication error - Check TELEGRAM_BOT_TOKEN in .env');
    } else if (error.response?.statusCode === 400) {
      errorMessage = 'Invalid chat ID. Please check TELEGRAM_CHAT_ID in .env file.';
      console.error('Invalid chat ID - Check TELEGRAM_CHAT_ID in .env');
    } else if (error.message) {
      errorMessage = `Telegram error: ${error.message}`;
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage 
    });
  }
});

// Newsletter subscription email endpoint
app.post('/api/newsletter-subscribe', async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ 
        success: false,
        error: 'Valid email address is required' 
      });
    }

    // Save to subscriber list
    try {
      const subscribers = await readDataFile('subscribers');
      const emailLower = email.toLowerCase().trim();
      
      // Check if email already exists
      const existingSubscriber = subscribers.find(s => s.email.toLowerCase().trim() === emailLower);
      
      if (!existingSubscriber) {
        subscribers.push({
          id: Date.now().toString(),
          email: emailLower,
          date: new Date().toISOString()
        });
        await writeDataFile('subscribers', subscribers);
        console.log(`✅ Subscriber added to list: ${emailLower}`);
        
        // Send welcome email with professional template
        if (resendClient || emailTransporter) {
          try {
            // Get featured products (first 4 products)
            const featuredProducts = PRODUCTS.slice(0, 4).map(p => {
              let imageUrl = null;
              if (p.images && p.images.length > 0 && p.images[0]) {
                imageUrl = p.images[0].trim();
                // Validate URL format
                if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
                  imageUrl = null;
                }
              }
              return {
                name: p.name || '',
                price: p.price || 0,
                description: p.description || '',
                image: imageUrl
              };
            });
            
            const welcomeEmailHtml = generateEmailTemplate('new-subscriber', {
              heading: 'Welcome to Saint Ventura!',
              content: `Thank you for subscribing to our newsletter! You'll be the first to know about:\n\n• New product launches\n• Exclusive promotions and sales\n• Special offers and discounts\n• Latest news and updates\n\nWe're excited to have you as part of the Saint Ventura family! Check out some of our featured products below.`,
              ctaText: 'Explore Our Collection',
              ctaLink: BRAND_WEBSITE,
              products: featuredProducts,
              includeSlideshow: true,
              includeSocialMedia: true
            });
            
            // Replace {{EMAIL}} placeholder in unsubscribe link with actual email
            const emailWithUnsubscribe = welcomeEmailHtml.replace(/\{\{EMAIL\}\}/g, encodeURIComponent(emailLower));
            
            await sendEmailViaResendOrSMTP({
              from: process.env.EMAIL_USER || process.env.FROM_EMAIL || 'contact@saintventura.co.za',
              to: emailLower,
              subject: 'Welcome to Saint Ventura!',
              text: `Thank you for subscribing to our newsletter! You'll be the first to know about new products, exclusive promotions, and special offers. Visit ${BRAND_WEBSITE} to explore our collection. Follow us on Instagram, TikTok, and YouTube!`,
              html: emailWithUnsubscribe
            });
            console.log(`✅ Welcome email sent to: ${emailLower}`);
          } catch (emailError) {
            console.error(`⚠️ Failed to send welcome email to ${emailLower}:`, emailError.message);
            // Don't fail the subscription if email fails
          }
        }
      } else {
        console.log(`ℹ️  Subscriber already exists: ${emailLower}`);
      }
    } catch (error) {
      console.error('Error saving subscriber:', error);
      // Continue even if saving fails - don't block the subscription
    }

    // Send Telegram message to support (this will also create a notification via sendWhatsApp)
    const telegramMessage = `📬 *New Newsletter Subscription*\n\nEmail: ${email}\n\nTime: ${new Date().toLocaleString('en-ZA')}`;
    
    sendWhatsApp({
      message: telegramMessage,
      to: TELEGRAM_CHAT_ID,
      notificationTitle: 'New Newsletter Subscription',
      notificationType: 'subscription'
    }).then(result => {
      if (result.success) {
        console.log(`✅ Newsletter subscription Telegram message SENT successfully to chat ID ${TELEGRAM_CHAT_ID}`);
        console.log('Telegram details:', { 
          messageId: result.messageId,
          status: result.status,
          to: TELEGRAM_CHAT_ID,
          subscriberEmail: email
        });
      }
    }).catch(error => {
      console.error(`❌ FAILED to send newsletter Telegram message to chat ID ${TELEGRAM_CHAT_ID}`);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        subscriberEmail: email
      });
    });
    
    // Return success immediately (email sends in background)
    res.json({ 
      success: true, 
      message: 'Subscription request sent successfully' 
    });

  } catch (error) {
    console.error('Error sending newsletter subscription email:', error);
    console.error('Error details:', {
      code: error.code,
      command: error.command,
      response: error.response,
      message: error.message
    });
    
    // Provide more specific error messages
    let errorMessage = 'Failed to send subscription request';
    
    if (error.response?.statusCode === 401) {
      errorMessage = 'Telegram Bot token invalid. Please check TELEGRAM_BOT_TOKEN in .env file.';
      console.error('Authentication error - Check TELEGRAM_BOT_TOKEN in .env');
    } else if (error.response?.statusCode === 400) {
      errorMessage = 'Invalid chat ID. Please check TELEGRAM_CHAT_ID in .env file.';
      console.error('Invalid chat ID - Check TELEGRAM_CHAT_ID in .env');
    } else if (error.message) {
      errorMessage = `Telegram error: ${error.message}`;
    }
    
    // Return error to frontend
    res.status(500).json({ 
      success: false,
      error: errorMessage 
    });
  }
});

// Checkout email notification endpoint - sends customer details when they click "Proceed to Payment"
app.post('/api/send-checkout-email', async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      shippingMethod,
      deliveryAddress,
      orderItems,
      subtotal,
      shipping,
      total,
      timestamp
    } = req.body;

    // Validate required fields
    if (!customerName || !customerEmail) {
      return res.status(400).json({ 
        success: false,
        error: 'Customer name and email are required' 
      });
    }

    // Format order items for email
    let itemsText = '';
    let itemsHtml = '';
    
    if (Array.isArray(orderItems)) {
      // Handle array of order items
      itemsText = orderItems.map(item => {
        const sizeText = item.size ? `, Size: ${item.size}` : '';
        const colorText = item.color ? `, Color: ${item.color}` : '';
        return `  - ${item.name}${sizeText}${colorText} (Qty: ${item.quantity}) - R${(item.price * item.quantity).toFixed(2)}`;
      }).join('\n');
      
      itemsHtml = orderItems.map(item => {
        const sizeText = item.size ? `, Size: ${item.size}` : '';
        const colorText = item.color ? `, Color: ${item.color}` : '';
        return `<li><strong>${item.name}</strong>${sizeText}${colorText} (Qty: ${item.quantity}) - R${(item.price * item.quantity).toFixed(2)}</li>`;
      }).join('');
    } else if (typeof orderItems === 'string') {
      // Handle string format (backward compatibility)
      itemsText = orderItems.split('\n').map(item => `  ${item}`).join('\n');
      itemsHtml = orderItems.split('\n').map(item => `<li>${item}</li>`).join('');
    } else {
      itemsText = 'No items listed';
      itemsHtml = '<li>No items listed</li>';
    }

    // Format delivery address
    let deliveryHtml = '';
    if (deliveryAddress) {
      deliveryHtml = `<p><strong>Delivery Address:</strong><br>${deliveryAddress.replace(/\n/g, '<br>')}</p>`;
    }

    // Store checkout email in inbox
    try {
      const inbox = await readDataFile('inbox');
      const emailBody = `New Order Checkout\n\nCustomer: ${customerName}\nEmail: ${customerEmail}\nPhone: ${customerPhone || 'Not provided'}\n\nShipping Method: ${shippingMethod}\nDelivery Address: ${deliveryAddress || 'Not provided'}\n\nOrder Items:\n${itemsText}\n\nSubtotal: R${subtotal.toFixed(2)}\nShipping: R${shipping.toFixed(2)}\nTotal: R${total.toFixed(2)}`;
      
      inbox.push({
        id: Date.now().toString(),
        from: customerEmail,
        name: customerName,
        phone: customerPhone || '',
        subject: `New Order Checkout - ${customerName}`,
        body: emailBody,
        date: new Date().toISOString(),
        read: false
      });
      await writeDataFile('inbox', inbox);
    } catch (error) {
      console.error('Error storing checkout email in inbox:', error);
    }

    // Create notification for new checkout
    try {
      const notifications = await readDataFile('notifications');
      notifications.push({
        id: Date.now().toString(),
        type: 'checkout',
        title: 'New Checkout Initiated',
        message: `${customerName} (${customerEmail}) - R${total.toFixed(2)}`,
        date: new Date().toISOString(),
        read: false
      });
      await writeDataFile('notifications', notifications);
    } catch (error) {
      console.error('Error creating checkout notification:', error);
    }

    // Add to abandoned carts when checkout notification is received
    try {
      const abandonedCarts = await readDataFile('abandonedCarts');
      const emailLower = customerEmail.toLowerCase().trim();
      
      // Remove old cart for this email if exists
      const filteredCarts = abandonedCarts.filter(c => c.email?.toLowerCase().trim() !== emailLower);
      
      // Format order items for abandoned cart
      const cartItems = Array.isArray(orderItems) ? orderItems.map(item => ({
        id: item.id || Date.now().toString(),
        name: item.name,
        quantity: item.quantity || 1,
        price: item.price || 0,
        size: item.size || '',
        color: item.color || ''
      })) : [];
      
      // Add new abandoned cart entry
      filteredCarts.push({
        id: Date.now().toString(),
        email: emailLower,
        customerName: customerName,
        customerPhone: customerPhone || '',
        shippingMethod: shippingMethod,
        deliveryAddress: deliveryAddress,
        deliveryDetails: req.body.deliveryDetails || {},
        items: cartItems,
        subtotal: subtotal || 0,
        shipping: shipping || 0,
        total: total || 0,
        date: new Date().toISOString()
      });
      
      await writeDataFile('abandonedCarts', filteredCarts);
      console.log(`✅ Added checkout to abandoned carts for: ${emailLower}`);
    } catch (error) {
      console.error('Error adding to abandoned carts:', error);
      // Don't fail the checkout notification if abandoned cart tracking fails
    }

    // Prepare Telegram message for support
    const supportTelegramMessage = `🛒 *New Order Checkout Initiated*\n\n*Customer Details:*\nName: ${customerName}\nEmail: ${customerEmail}\nPhone: ${customerPhone || 'Not provided'}\n\n*Shipping Method:* ${shippingMethod}\n\n*Delivery Address:*\n${deliveryAddress || 'Not provided'}\n\n*Order Items:*\n${itemsText}\n\n*Order Summary:*\nSubtotal: R${subtotal.toFixed(2)}\nShipping: R${shipping.toFixed(2)}\n*Total: R${total.toFixed(2)}*\n\nTime: ${timestamp || new Date().toLocaleString('en-ZA')}\n\n⚠️ Customer proceeding to payment...`;

    // Send Telegram message to support (customer doesn't get Telegram, only support)
    const supportTelegramPromise = sendWhatsApp({
      message: supportTelegramMessage,
      to: TELEGRAM_CHAT_ID
    });

    // Wait for Telegram message to be sent
    const supportResult = await supportTelegramPromise;

    if (supportResult.success) {
      console.log(`✅ Checkout Telegram notification SENT successfully to chat ID ${TELEGRAM_CHAT_ID}`);
    } else {
      console.error('❌ FAILED to send checkout Telegram to support:', supportResult.error);
    }

    // Return success if Telegram was sent
    if (supportResult.success) {
      res.json({ 
        success: true,
        message: 'Checkout notification sent successfully',
        telegramSent: supportResult.success
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: 'Failed to send checkout notification' 
      });
    }

  } catch (error) {
    console.error('Error sending checkout notification:', error);
    console.error('Error details:', {
      code: error.code,
      response: error.response,
      message: error.message
    });
    
    // Provide more specific error messages
    let errorMessage = 'Failed to send checkout Telegram notification';
    
    if (error.response?.statusCode === 401) {
      errorMessage = 'Telegram Bot token invalid. Please check TELEGRAM_BOT_TOKEN in .env file.';
      console.error('Authentication error - Check TELEGRAM_BOT_TOKEN in .env');
    } else if (error.response?.statusCode === 400) {
      errorMessage = 'Invalid chat ID. Please check TELEGRAM_CHAT_ID in .env file.';
      console.error('Invalid chat ID - Check TELEGRAM_CHAT_ID in .env');
    } else if (error.message) {
      errorMessage = `Telegram error: ${error.message}`;
    }
    
    // Return error to frontend
    res.status(500).json({ 
      success: false,
      error: errorMessage 
    });
  }
});

// Order confirmation email endpoint
app.post('/api/send-order-confirmation', async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      shippingMethod,
      deliveryAddress,
      deliveryDetails,
      orderItems,
      subtotal,
      shipping,
      total,
      orderId
    } = req.body;

    // Validate required fields
    if (!customerName || !customerEmail) {
      return res.status(400).json({ 
        success: false,
        error: 'Customer name and email are required' 
      });
    }

    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Order items are required' 
      });
    }

    // Format order items for email
    const orderDate = new Date().toLocaleDateString('en-ZA', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Format delivery information
    let deliveryInfo = '';
    if (shippingMethod === 'door' && deliveryDetails) {
      deliveryInfo = `Delivery Address:\n${deliveryDetails.street || ''}\n${deliveryDetails.suburb ? deliveryDetails.suburb + '\n' : ''}${deliveryDetails.city || ''}, ${deliveryDetails.province || ''}\n${deliveryDetails.postalCode || ''}${deliveryDetails.extra ? '\n' + deliveryDetails.extra : ''}`;
    } else if (shippingMethod === 'uj' && deliveryDetails) {
      deliveryInfo = `Delivery Location: UJ ${deliveryDetails.campus || 'Campus'} Campus`;
    }

    // Check order status to customize email content
    let orderStatus = 'fulfilled'; // Default
    if (orderId) {
      try {
        const orders = await readDataFile('orders');
        const order = orders.find(o => o.id === orderId);
        if (order) {
          orderStatus = order.status || 'fulfilled';
        }
      } catch (error) {
        console.error('Error checking order status:', error);
      }
    }
    
    // Build order details content
    const orderDetailsText = `Order ${orderId ? `ID: ${orderId}` : 'Details'}: ${orderDate}\n\nOrder Items:\n${orderItems.map(item => {
      const size = item.size ? `, Size: ${item.size}` : '';
      const color = item.color ? `, Color: ${item.color}` : '';
      return `- ${item.name}${size}${color} (Qty: ${item.quantity}) - R${(item.price * item.quantity).toFixed(2)}`;
    }).join('\n')}\n\nOrder Summary:\nSubtotal: R${subtotal.toFixed(2)}\nShipping: R${shipping.toFixed(2)}\nTotal: R${total.toFixed(2)}\n\nDelivery Method: ${shippingMethod === 'door' ? 'Door-to-Door Courier' : shippingMethod === 'uj' ? 'UJ Campus Delivery' : 'Testing Delivery'}\n${deliveryInfo ? deliveryInfo + '\n' : ''}`;

    // Customize email content based on order status
    let emailContent;
    let emailTextContent;
    
    if (orderStatus === 'no stock') {
      // Email for out of stock orders
      emailContent = `Dear ${customerName},\n\nWe're absolutely thrilled to confirm that your order has been successfully processed and your payment has been received! Thank you for choosing Saint Ventura for your premium streetwear needs.\n\n${orderDetailsText}\n\nYour order is being fulfilled and will come soon! We're working diligently to source the items for your order and ensure that every piece meets our exacting quality standards. Our team is committed to getting your order to you as quickly as possible, and we'll keep you updated every step of the way.\n\nWe understand how exciting it is to receive your new pieces, and we appreciate your patience as we prepare your order with the utmost care and attention to detail. Once your items are ready, they'll be carefully packaged and shipped to you immediately.\n\nIf you have any questions about your order, shipping, or anything else, please don't hesitate to reach out to us. We're here to help and ensure you have an exceptional experience with Saint Ventura.\n\nThank you again for your purchase. We can't wait for you to experience the quality and style that defines Saint Ventura!`;
      
      emailTextContent = `Order Confirmation - Thank You!\n\nDear ${customerName},\n\nThank you for your order! Your payment has been successfully processed.\n\n${orderDetailsText}\n\nYour order is being fulfilled and will come soon! We're working diligently to source the items for your order and will keep you updated every step of the way.\n\nThank you for choosing Saint Ventura!`;
    } else {
      // Email for fulfilled orders (in stock)
      emailContent = `Dear ${customerName},\n\nWe're absolutely thrilled to confirm that your order has been successfully processed and your payment has been received! Thank you for choosing Saint Ventura for your premium streetwear needs.\n\n${orderDetailsText}\n\nYour order is now being prepared with the utmost care and attention to detail. Our team is working diligently to ensure that every item meets our exacting quality standards before it's carefully packaged and shipped to you.\n\nWe understand how exciting it is to receive your new pieces, and we're committed to getting them to you as quickly as possible. Enjoy your package!\n\nIf you have any questions about your order, shipping, or anything else, please don't hesitate to reach out to us. We're here to help and ensure you have an exceptional experience with Saint Ventura.\n\nThank you again for your purchase. We can't wait for you to experience the quality and style that defines Saint Ventura!`;
      
      emailTextContent = `Order Confirmation - Thank You!\n\nDear ${customerName},\n\nThank you for your order! Your payment has been successfully processed.\n\n${orderDetailsText}\n\nThank you for choosing Saint Ventura!`;
    }

    // Prepare customer email content using template
    const customerOrderEmailText = emailTextContent;

    // Map order items to products for email template
    const orderProducts = orderItems.map(item => {
      // Try to find product image from PRODUCTS array
      const product = PRODUCTS.find(p => 
        p.id === item.id || 
        p.id === parseInt(item.id) ||
        p.name === item.name
      );
      
      let imageUrl = null;
      if (product) {
        // Try to get color-specific image first
        if (item.color && product.availableColors) {
          const colorMatch = product.availableColors.find(c => 
            c.name.toLowerCase() === item.color.toLowerCase()
          );
          if (colorMatch && colorMatch.image) {
            imageUrl = colorMatch.image.trim();
          }
        }
        // Fallback to first product image
        if (!imageUrl && product.images && product.images.length > 0) {
          imageUrl = product.images[0].trim();
        }
        // Validate URL format
        if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
          imageUrl = null;
        }
      }
      
      const size = item.size ? `Size: ${item.size}` : '';
      const color = item.color ? `${item.size ? ', ' : ''}Color: ${item.color}` : '';
      const description = [size, color].filter(d => d).join(', ').trim();
      
      return {
        name: item.name,
        price: item.price * item.quantity,
        description: description || '',
        image: imageUrl
      };
    });

    // Generate email using template
        const customerOrderEmailHtml = generateEmailTemplate('order-confirmation', {
          heading: `Order Confirmation - Thank You, ${customerName}!`,
          content: emailContent,
          products: orderProducts,
          includeSocialMedia: true,
          isSubscribed: true
        });

    // Send order confirmation email to customer
    let emailSent = false;
    let emailError = null;
    let emailResult = null;
    try {
      console.log(`📧 Attempting to send order confirmation email to: ${customerEmail}`);
      emailResult = await sendEmailViaResendOrSMTP({
        from: process.env.EMAIL_USER || process.env.FROM_EMAIL || 'contact@saintventura.co.za',
        to: customerEmail,
        subject: 'Order Confirmation - Saint Ventura',
        text: customerOrderEmailText,
        html: customerOrderEmailHtml
      });
      emailSent = emailResult && emailResult.success !== false;
      if (emailSent) {
        console.log(`✅ Order confirmation email sent successfully to ${customerEmail} for order ${orderId || 'N/A'}`);
        console.log(`   Email method: ${emailResult.method || 'unknown'}`);
      } else {
        console.warn(`⚠️ Email sending returned but success=false for ${customerEmail}`);
      }
    } catch (err) {
      emailError = err;
      emailSent = false;
      console.error(`❌ Failed to send order confirmation email to ${customerEmail}:`, err.message);
      console.error('   Error name:', err.name);
      console.error('   Error stack:', err.stack);
      if (err.response) {
        console.error('   Response status:', err.response.status);
        console.error('   Response data:', JSON.stringify(err.response.data || {}, null, 2));
      }
      // Don't fail the entire request if email fails - still send Telegram notification
    }

    // Create notification for completed order
    try {
      const notifications = await readDataFile('notifications');
      notifications.push({
        id: Date.now().toString(),
        type: 'order',
        title: 'Order Completed',
        message: `${customerName} (${customerEmail}) - R${total.toFixed(2)}`,
        date: new Date().toISOString(),
        read: false
      });
      await writeDataFile('notifications', notifications);
    } catch (error) {
      console.error('Error creating order notification:', error);
    }

    // Save completed order to orders.json
    try {
      const orders = await readDataFile('orders');
      const finalOrderId = orderId || `ORDER-${Date.now()}`;
      
      // Check if order already exists (avoid duplicates)
      const existingOrder = orders.find(o => o.id === finalOrderId);
      if (!existingOrder) {
        // Enhance order items with product images and details
        const enhancedOrderItems = orderItems.map(item => {
          const product = PRODUCTS.find(p => 
            p.id === item.id || 
            p.id === parseInt(item.id) ||
            p.name === item.name
          );
          
          let imageUrl = null;
          if (product) {
            // Try to get color-specific image first
            if (item.color && product.availableColors) {
              const colorMatch = product.availableColors.find(c => 
                c.name.toLowerCase() === item.color.toLowerCase()
              );
              if (colorMatch && colorMatch.image) {
                imageUrl = colorMatch.image.trim();
              }
            }
            // Fallback to first product image
            if (!imageUrl && product.images && product.images.length > 0) {
              imageUrl = product.images[0].trim();
            }
          }
          
          // Validate URL format
          if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
            imageUrl = null;
          }
          
          return {
            ...item,
            image: imageUrl || item.image || null,
            imageUrl: imageUrl || item.imageUrl || null
          };
        });
        
        // Check stock availability for all items
        let hasOutOfStockItems = false;
        try {
          const inventory = await readDataFile('inventory');
          for (const item of enhancedOrderItems) {
            const inventoryItem = inventory.find(inv => {
              const productMatch = inv.productId === item.id || 
                                  inv.productId === parseInt(item.id) ||
                                  inv.productName === item.name;
              
              if (!productMatch) return false;
              
              // Match by variant if size/color provided
              if (item.size || item.color) {
                const variantStr = (inv.variant || '').toLowerCase();
                const variantIdStr = (inv.variantId || '').toLowerCase();
                const sizeStr = (item.size || '').toLowerCase();
                const colorStr = (item.color || '').toLowerCase();
                const isOneSize = sizeStr === 'one size fits all';
                
                // For "One Size Fits All" products, inventory only stores color, so match by color only
                if (isOneSize && colorStr) {
                  const variantIdMatchesColor = variantIdStr === colorStr || variantIdStr === colorStr.trim();
                  const variantMatchesColor = variantStr === colorStr || variantStr === colorStr.trim();
                  if (variantIdMatchesColor || variantMatchesColor) {
                    return true;
                  }
                }
                
                // For regular products, match using both size and color
                const variantMatch = (!item.size || isOneSize || inv.variant?.toLowerCase().includes(sizeStr)) &&
                                    (!item.color || inv.variant?.toLowerCase().includes(colorStr) || inv.variantId?.toLowerCase() === colorStr);
                return variantMatch;
              }
              
              return true; // If no size/color specified, match any variant of the product
            });
            
            const requiredQuantity = item.quantity || 1;
            const availableStock = inventoryItem ? (parseInt(inventoryItem.stock) || 0) : 0;
            
            if (!inventoryItem || availableStock < requiredQuantity) {
              hasOutOfStockItems = true;
              console.warn(`⚠️ Item ${item.name} (Size: ${item.size || 'N/A'}, Color: ${item.color || 'N/A'}) is out of stock or not found in inventory. Required: ${requiredQuantity}, Available: ${availableStock}`);
              // Don't break - continue checking all items to mark all out of stock items
            }
          }
        } catch (stockCheckError) {
          console.error('Error checking stock:', stockCheckError);
          // If stock check fails, assume items are available (don't block order)
        }
        
        // Check if order already exists with "pending checkout" status and update it
        const existingOrderIndex = orders.findIndex(o => o.id === finalOrderId);
        
        if (existingOrderIndex !== -1 && orders[existingOrderIndex].status === 'pending checkout') {
          // Update existing order from "pending checkout" to "pending fulfilment"
          orders[existingOrderIndex].status = 'pending fulfilment';
          orders[existingOrderIndex].customerName = customerName;
          orders[existingOrderIndex].customerEmail = customerEmail;
          orders[existingOrderIndex].customerPhone = req.body.customerPhone || orders[existingOrderIndex].customerPhone || '';
          orders[existingOrderIndex].shippingMethod = shippingMethod;
          orders[existingOrderIndex].deliveryAddress = deliveryAddress;
          orders[existingOrderIndex].deliveryDetails = deliveryDetails;
          orders[existingOrderIndex].items = enhancedOrderItems;
          orders[existingOrderIndex].subtotal = subtotal;
          orders[existingOrderIndex].shipping = shipping;
          orders[existingOrderIndex].total = total;
          orders[existingOrderIndex].date = new Date().toISOString();
          orders[existingOrderIndex].paymentMethod = 'yoco';
          orders[existingOrderIndex].orderType = 'online';
          orders[existingOrderIndex].hasOutOfStockItems = hasOutOfStockItems;
          orders[existingOrderIndex].updatedAt = new Date().toISOString();
          
          await writeDataFile('orders', orders);
          console.log(`✅ Updated order ${finalOrderId} from "pending checkout" to "pending fulfilment"`);
        } else {
          // Determine order status for website orders:
          // - Always set to "pending fulfilment" (admin will mark as fulfilled after shipping)
          // - hasOutOfStockItems flag will indicate if any items are out of stock
          const orderStatus = 'pending fulfilment';
          
          orders.push({
            id: finalOrderId,
            customerName,
            customerEmail,
            customerPhone: req.body.customerPhone || '', // Optional field
            shippingMethod,
            deliveryAddress,
            deliveryDetails,
            items: enhancedOrderItems, // Store as array with images and details
            subtotal,
            shipping,
            total,
            date: new Date().toISOString(),
            status: orderStatus, // pending fulfilment (admin will mark as fulfilled)
            paymentMethod: 'yoco', // Assuming Yoco payment gateway
            orderType: 'online', // Mark as online order
            hasOutOfStockItems: hasOutOfStockItems // Track if order has out of stock items
          });
          await writeDataFile('orders', orders);
          console.log(`✅ Saved completed order to orders.json: ${finalOrderId} with status: ${orderStatus}`);
        }
        
        // Reduce stock when order is fulfilled (from abandoned cart or website orders)
        // Note: Stock is only reduced when admin marks order as fulfilled, not here
        // This section is kept for backward compatibility but stock reduction happens when status changes to fulfilled
        if (false) { // Disabled - stock reduction happens when order status changes to fulfilled
          try {
            const inventory = await readDataFile('inventory');
            for (const item of orderItems) {
              // Find inventory item matching product and variant (size/color)
              const inventoryItem = inventory.find(inv => {
                const productMatch = inv.productId === item.id || 
                                    inv.productId === parseInt(item.id) ||
                                    inv.productName === item.name;
                
                if (!productMatch) return false;
                
                // Match by variant if size/color provided
                if (item.size || item.color) {
                  const variantStr = (inv.variant || '').toLowerCase();
                  const variantIdStr = (inv.variantId || '').toLowerCase();
                  const sizeStr = (item.size || '').toLowerCase();
                  const colorStr = (item.color || '').toLowerCase();
                  const isOneSize = sizeStr === 'one size fits all';
                  
                  // For "One Size Fits All" products, inventory only stores color, so match by color only
                  if (isOneSize && colorStr) {
                    const variantIdMatchesColor = variantIdStr === colorStr || variantIdStr === colorStr.trim();
                    const variantMatchesColor = variantStr === colorStr || variantStr === colorStr.trim();
                    if (variantIdMatchesColor || variantMatchesColor) {
                      return true;
                    }
                  }
                  
                  // For regular products, match using both size and color
                  const variantMatch = (!item.size || isOneSize || inv.variant?.toLowerCase().includes(sizeStr)) &&
                                      (!item.color || inv.variant?.toLowerCase().includes(colorStr) || inv.variantId?.toLowerCase() === colorStr);
                  return variantMatch;
                }
                
                return true; // If no size/color specified, match any variant of the product
              });
              
              if (inventoryItem) {
                const quantityToReduce = item.quantity || 1;
                const currentStock = inventoryItem.stock || 0;
                const newStock = Math.max(0, currentStock - quantityToReduce);
                
                // Reduce stock cost by (cost per unit × quantity) but keep cost per unit consistent
                if (inventoryItem.costPerUnit && inventoryItem.costPerUnit > 0) {
                  const costToReduce = inventoryItem.costPerUnit * quantityToReduce;
                  inventoryItem.stockCost = Math.max(0, (inventoryItem.stockCost || 0) - costToReduce);
                  // Cost per unit stays the same - don't recalculate it
                }
                
                inventoryItem.stock = newStock;
                inventoryItem.updatedAt = new Date().toISOString();
                
                if (currentStock === 0) {
                  console.log(`⚠️ Item ${inventoryItem.productName} (${inventoryItem.variant || 'default'}) was out of stock - order still processed and marked as fulfilled`);
                } else {
                  console.log(`✅ Reduced stock for ${inventoryItem.productName} (${inventoryItem.variant || 'default'}): ${currentStock} -> ${newStock}`);
                }
              } else {
                console.warn(`⚠️ Inventory item not found for ${item.name} (Size: ${item.size || 'N/A'}, Color: ${item.color || 'N/A'}) - order will still be processed and marked as fulfilled`);
              }
            }
            await writeDataFile('inventory', inventory);
          } catch (stockError) {
            console.error('Error reducing stock:', stockError);
          }
        }
      } else {
        // Update existing order status if it came from abandoned cart
        if (isFromAbandonedCart && existingOrder.status !== 'fulfilled') {
          existingOrder.status = 'fulfilled';
          await writeDataFile('orders', orders);
          console.log(`✅ Updated order ${finalOrderId} status to fulfilled (from abandoned cart)`);
        } else {
          console.log(`⚠️ Order ${finalOrderId} already exists in orders.json, skipping duplicate`);
        }
      }
    } catch (error) {
      console.error('Error saving completed order to orders.json:', error);
      // Don't fail the order confirmation if order saving fails
    }

    // Check if order came from abandoned cart and mark as fulfilled
    let isFromAbandonedCart = false;
    try {
      const abandonedCarts = await readDataFile('abandonedCarts');
      const emailLower = customerEmail.toLowerCase().trim();
      
      // Check if this email has an abandoned cart
      const matchingCart = abandonedCarts.find(c => c.email?.toLowerCase().trim() === emailLower);
      if (matchingCart) {
        isFromAbandonedCart = true;
        // Remove cart for this email
        const filteredCarts = abandonedCarts.filter(c => c.email?.toLowerCase().trim() !== emailLower);
        await writeDataFile('abandonedCarts', filteredCarts);
        console.log(`✅ Removed completed order from abandoned carts for: ${emailLower}`);
      }
    } catch (error) {
      console.error('Error checking/removing from abandoned carts:', error);
      // Don't fail the order confirmation if abandoned cart check fails
    }

    // Prepare Telegram message for support
    const orderItemsText = orderItems.map(item => {
      const sizeText = item.size ? `, Size: ${item.size}` : '';
      const colorText = item.color ? `, Color: ${item.color}` : '';
      return `• ${item.name}${sizeText}${colorText}\n  Qty: ${item.quantity} × R${item.price.toFixed(2)} = R${(item.price * item.quantity).toFixed(2)}`;
    }).join('\n\n');

    const supportTelegramMessage = `✅ *NEW ORDER CONFIRMED - PAYMENT SUCCESSFUL*\n\n*Order ${orderId ? `ID: ${orderId}` : 'Details'}:*\nDate: ${orderDate}\n\n*Customer Information:*\nName: ${customerName}\nEmail: ${customerEmail}\n\n*Order Items:*\n${orderItemsText}\n\n*Order Summary:*\nSubtotal: R${subtotal.toFixed(2)}\nShipping: R${shipping.toFixed(2)}\n*TOTAL: R${total.toFixed(2)}*\n\n*Delivery Method:*\n${shippingMethod === 'door' ? 'Door-to-Door Courier' : shippingMethod === 'uj' ? 'UJ Campus Delivery' : 'Testing Delivery'}\n${deliveryAddress ? `\n*Delivery Address:*\n${deliveryAddress}` : ''}\n\n🎉 Payment successful! Please process this order.`;

    // Send Telegram message to support (customer doesn't get Telegram, only support)
    const supportTelegramPromise = sendWhatsApp({
      message: supportTelegramMessage,
      to: TELEGRAM_CHAT_ID
    });

    // Wait for Telegram message to be sent
    const supportResult = await supportTelegramPromise;

    if (supportResult.success) {
      console.log(`✅ Order confirmation Telegram SENT successfully to chat ID ${TELEGRAM_CHAT_ID}`);
    } else {
      console.error('❌ FAILED to send order confirmation Telegram to support:', supportResult.error);
    }

    // Return success response
    res.json({ 
      success: true, 
      message: 'Order confirmation processed successfully',
      emailSent: emailSent,
      emailError: emailError ? emailError.message : null,
      whatsappSent: supportResult.success,
      orderId: orderId || null
    });

  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to send order confirmation WhatsApp';
    
    if (error.response?.statusCode === 401) {
      errorMessage = 'Telegram Bot token invalid. Please check TELEGRAM_BOT_TOKEN in .env file.';
      console.error('Authentication error - Check TELEGRAM_BOT_TOKEN in .env');
    } else if (error.response?.statusCode === 400) {
      errorMessage = 'Invalid chat ID. Please check TELEGRAM_CHAT_ID in .env file.';
      console.error('Invalid chat ID - Check TELEGRAM_CHAT_ID in .env');
    } else if (error.message) {
      errorMessage = `Telegram error: ${error.message}`;
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage 
    });
  }
});

// Webhook endpoint for Yoco payment notifications
app.post('/api/yoco-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const webhookData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    console.log('Yoco webhook received:', webhookData);

    // Verify webhook signature if Yoco provides one
    // TODO: Add webhook signature verification for production
    
    // Check if payment was successful
    const paymentStatus = webhookData.status || webhookData.event || webhookData.type;
    const checkoutId = webhookData.checkoutId || webhookData.id || webhookData.checkout?.id;
    const metadata = webhookData.metadata || webhookData.checkout?.metadata || {};
    const orderId = metadata.orderId;

    if (paymentStatus === 'succeeded' || paymentStatus === 'checkout.succeeded' || webhookData.type === 'checkout.succeeded') {
      console.log('✅ Payment succeeded, processing order:', orderId);
      
      if (orderId) {
        await fulfillPOSOrderIfNeeded(orderId);
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Get payment status (optional - for checking payment status)
app.get('/api/payment-status/:checkoutId', async (req, res) => {
  try {
    const { checkoutId } = req.params;

    const response = await axios.get(
      `${YOCO_API_URL}/api/checkouts/${checkoutId}`,
      {
        headers: {
          'Authorization': `Bearer ${YOCO_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const paymentData = response.data;
    const orderId = paymentData.metadata?.orderId;

    // If payment is successful and order is POS, fulfill it
    if (paymentData.status === 'succeeded' && orderId && orderId.startsWith('POS-')) {
      await fulfillPOSOrderIfNeeded(orderId);
    }

    res.json({
      success: true,
      payment: paymentData
    });
  } catch (error) {
    console.error('Error fetching payment status:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || 'Failed to fetch payment status'
    });
  }
});

// Verify and fulfill POS order after Yoco payment
app.post('/api/verify-pos-payment', async (req, res) => {
  try {
    const { orderId, checkoutId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Order ID is required' });
    }

    // Check if it's a POS order
    if (!orderId.startsWith('POS-')) {
      return res.json({ success: false, error: 'Not a POS order' });
    }

    // If checkoutId provided, verify payment status
    if (checkoutId) {
      try {
        const response = await axios.get(
          `${YOCO_API_URL}/api/checkouts/${checkoutId}`,
          {
            headers: {
              'Authorization': `Bearer ${YOCO_SECRET_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const paymentData = response.data;
        if (paymentData.status !== 'succeeded') {
          return res.json({ success: false, error: 'Payment not completed' });
        }
      } catch (error) {
        console.error('Error verifying payment:', error);
        // Continue anyway - might be a webhook that already confirmed
      }
    }

    // Fulfill the order
    await fulfillPOSOrderIfNeeded(orderId);

    res.json({ success: true, message: 'Order fulfilled successfully' });
  } catch (error) {
    console.error('Error verifying POS payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to fulfill POS order
async function fulfillPOSOrderIfNeeded(orderId) {
  try {
    const orders = await readDataFile('orders');
    const order = orders.find(o => o.id === orderId);

    if (!order) {
      console.log(`Order ${orderId} not found`);
      return;
    }

    // Only update if it's still pending checkout
    if (order.status === 'pending checkout') {
      // Check stock before fulfilling POS order
      try {
        const inventory = await readDataFile('inventory');
        const items = order.items || [];
        let hasOutOfStock = false;
        
        for (const item of items) {
          const inventoryItem = inventory.find(inv => {
            const productMatch = inv.productId === item.id || 
                                inv.productId === parseInt(item.id) ||
                                inv.productName === item.name;
            
            if (!productMatch) return false;
            
            if (item.size || item.color) {
              const variantStr = (inv.variant || '').toLowerCase();
              const variantIdStr = (inv.variantId || '').toLowerCase();
              const sizeStr = (item.size || '').toLowerCase();
              const colorStr = (item.color || '').toLowerCase();
              const isOneSize = sizeStr === 'one size fits all';
              
              // For "One Size Fits All" products, inventory only stores color, so match by color only
              if (isOneSize && colorStr) {
                const variantIdMatchesColor = variantIdStr === colorStr || variantIdStr === colorStr.trim();
                const variantMatchesColor = variantStr === colorStr || variantStr === colorStr.trim();
                if (variantIdMatchesColor || variantMatchesColor) {
                  return true;
                }
              }
              
              // For regular products, match using both size and color
              const variantMatch = (!item.size || isOneSize || inv.variant?.toLowerCase().includes(sizeStr)) &&
                                  (!item.color || inv.variant?.toLowerCase().includes(colorStr) || inv.variantId?.toLowerCase() === colorStr);
              return variantMatch;
            }
            
            return true;
          });
          
          const requiredQuantity = item.quantity || 1;
          const availableStock = inventoryItem ? (parseInt(inventoryItem.stock) || 0) : 0;
          
          if (!inventoryItem || availableStock <= 0 || availableStock < requiredQuantity) {
            hasOutOfStock = true;
            console.warn(`⚠️ Cannot fulfill POS order ${orderId}: Item ${item.name} is out of stock. Required: ${requiredQuantity}, Available: ${availableStock}`);
            break;
          }
        }
        
        if (hasOutOfStock) {
          console.error(`❌ Cannot fulfill POS order ${orderId}: Some items are out of stock`);
          // Don't fulfill the order if items are out of stock
          return;
        }
      } catch (stockCheckError) {
        console.error('Error checking stock before fulfilling POS order:', stockCheckError);
        // Don't fulfill if we can't verify stock
        return;
      }
      
      order.status = 'fulfilled';
      order.updatedAt = new Date().toISOString();
      await writeDataFile('orders', orders);

      console.log(`✅ POS order ${orderId} marked as fulfilled`);

      // Reduce stock for fulfilled POS order
      try {
        const inventory = await readDataFile('inventory');
        const items = order.items || [];

        for (const item of items) {
          // Find inventory item matching product and variant (size/color)
          const inventoryItem = inventory.find(inv => {
            const productMatch = inv.productId === item.id || 
                                inv.productId === parseInt(item.id) ||
                                inv.productName === item.name;
            
            if (!productMatch) return false;
            
            // Match by variant if size/color provided
            if (item.size || item.color) {
              const variantMatch = (!item.size || inv.variant?.includes(item.size)) &&
                                  (!item.color || inv.variant?.includes(item.color));
              return variantMatch;
            }
            
            return true; // If no size/color specified, match any variant of the product
          });
          
          if (inventoryItem) {
            const quantityToReduce = item.quantity || 1;
            const currentStock = inventoryItem.stock || 0;
            const newStock = Math.max(0, currentStock - quantityToReduce);
            
            // Reduce stock cost by (cost per unit × quantity) but keep cost per unit consistent
            if (inventoryItem.costPerUnit && inventoryItem.costPerUnit > 0) {
              const costToReduce = inventoryItem.costPerUnit * quantityToReduce;
              inventoryItem.stockCost = Math.max(0, (inventoryItem.stockCost || 0) - costToReduce);
              // Cost per unit stays the same - don't recalculate it
            }
            
            inventoryItem.stock = newStock;
            inventoryItem.updatedAt = new Date().toISOString();
            
            if (currentStock === 0) {
              console.log(`⚠️ Item ${inventoryItem.productName} (${inventoryItem.variant || 'default'}) was out of stock - order still processed and marked as fulfilled`);
            } else {
              console.log(`✅ Reduced stock for ${inventoryItem.productName} (${inventoryItem.variant || 'default'}): ${currentStock} -> ${newStock}`);
            }
          } else {
            console.warn(`⚠️ Inventory item not found for ${item.name} (Size: ${item.size || 'N/A'}, Color: ${item.color || 'N/A'}) - order will still be processed and marked as fulfilled`);
          }
        }
        
        await writeDataFile('inventory', inventory);
      } catch (stockError) {
        console.error('Error reducing stock for POS order:', stockError);
      }
    }
  } catch (error) {
    console.error('Error fulfilling POS order:', error);
    throw error;
  }
}

// ============================================
// ADMIN DASHBOARD CONFIGURATION
// ============================================
const ADMIN_PASSWORD = 'WEAR3+H3$@!N+$*';
const DATA_DIR = path.join(__dirname, 'data');
const ADMIN_DATA_FILES = {
  inventory: path.join(DATA_DIR, 'inventory.json'),
  inbox: path.join(DATA_DIR, 'inbox.json'),
  subscribers: path.join(DATA_DIR, 'subscribers.json'),
  abandonedCarts: path.join(DATA_DIR, 'abandoned-carts.json'),
  fulfillers: path.join(DATA_DIR, 'fulfillers.json'),
  notifications: path.join(DATA_DIR, 'notifications.json'),
  orders: path.join(DATA_DIR, 'orders.json')
};

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log('✅ Data directory created/verified:', DATA_DIR);
    // Initialize empty files if they don't exist
    for (const [key, filePath] of Object.entries(ADMIN_DATA_FILES)) {
      try {
        await fs.access(filePath);
        console.log(`✅ ${key}.json exists`);
      } catch {
        await fs.writeFile(filePath, JSON.stringify([]));
        console.log(`✅ Created ${key}.json`);
      }
    }
  } catch (error) {
    console.error('❌ Error setting up data directory:', error);
    throw error;
  }
}

// Email transporter setup (using nodemailer - kept for backward compatibility, but we'll use Resend)
let emailTransporter = null;
let resendClient = null;
let imapConnection = null;

// Global variables for email configuration
let primaryPort = 587;
let portsToTry = [587, 465, 25, 2525];
let createEmailTransporter = null;

// Helper function to create email transporter with specific port
function createEmailTransporterFunction(portToUse) {
  const isOffice365 = process.env.EMAIL_HOST && process.env.EMAIL_HOST.includes('office365.com');
  const isSecure = portToUse === 465;
  
  // Office 365 specific configuration
  if (isOffice365) {
    // Office 365 requires port 587 with STARTTLS
    const config = {
    host: process.env.EMAIL_HOST,
      port: 587, // Office 365 requires port 587
      secure: false, // Office 365 uses STARTTLS, not SSL
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
      connectionTimeout: 30000, // 30 seconds for Office 365
      greetingTimeout: 30000,
      socketTimeout: 30000,
      pool: false,
      requireTLS: true, // Office 365 requires TLS
      tls: {
        rejectUnauthorized: true, // Office 365 has valid certificates
        minVersion: 'TLSv1.2'
        // Let Node.js choose appropriate ciphers for Office 365
      },
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development'
    };
    console.log(`📧 Using Office 365 SMTP configuration on port 587`);
    return nodemailer.createTransport(config);
  }
  
  // Generic SMTP configuration for other providers
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: portToUse,
    secure: isSecure, // true for 465, false for other ports (uses STARTTLS)
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 20000, // 20 seconds
    greetingTimeout: 20000,
    socketTimeout: 20000,
    pool: false,
    requireTLS: !isSecure, // For port 587, require STARTTLS
    tls: {
      rejectUnauthorized: false, // Allow self-signed certificates
      minVersion: 'TLSv1.2',
      ciphers: 'HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA'
    },
    debug: process.env.NODE_ENV === 'development',
    logger: process.env.NODE_ENV === 'development'
  });
}

// Helper function to send email with automatic port fallback
// Define as both function declaration and assign to global for maximum compatibility
async function sendEmailWithPortFallback(emailOptions) {
  if (!emailTransporter) {
    throw new Error('Email transporter not configured');
  }
  
  let portIndex = 0;
  let lastError = null;
  
  while (portIndex < portsToTry.length) {
    const currentPort = portsToTry[portIndex];
    let transporterToUse = emailTransporter;
    
    // Create new transporter if not using primary port
    if (currentPort !== primaryPort && createEmailTransporter) {
      transporterToUse = createEmailTransporter(currentPort);
    }
    
    try {
      await transporterToUse.sendMail(emailOptions);
      // Success! Update main transporter if this port worked
      if (currentPort !== primaryPort) {
        console.log(`✅ Port ${currentPort} works! Consider updating EMAIL_PORT in .env file.`);
        emailTransporter = transporterToUse;
      }
      return { success: true, port: currentPort };
    } catch (error) {
      lastError = error;
      // If it's a connection timeout, try next port
      if (error.code === 'ETIMEDOUT' && error.command === 'CONN' && portIndex < portsToTry.length - 1) {
        console.log(`⚠️ Connection timeout on port ${currentPort}, trying port ${portsToTry[portIndex + 1]}...`);
        portIndex++;
        continue;
      }
      // For other errors or if it's the last port, throw
      throw error;
    }
  }
  
  // All ports failed
  throw lastError || new Error('Failed to connect to SMTP server on any port');
}

// Also assign to global object to ensure it's accessible everywhere
if (typeof global !== 'undefined') {
  global.sendEmailWithPortFallback = sendEmailWithPortFallback;
}

if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  // SMTP setup for sending emails
  createEmailTransporter = createEmailTransporterFunction;
  
  // Determine primary port and alternative ports to try
  const isOffice365 = process.env.EMAIL_HOST && process.env.EMAIL_HOST.includes('office365.com');
  
  if (isOffice365) {
    // Office 365 only supports port 587 with STARTTLS
    primaryPort = 587;
    portsToTry = [587]; // Only try port 587 for Office 365
    console.log('📧 Detected Office 365 SMTP - using port 587 only');
  } else {
    // For other providers, try multiple ports
    primaryPort = parseInt(process.env.EMAIL_PORT || 587);
    // Common SMTP ports to try: 587 (STARTTLS), 465 (SSL), 25 (unencrypted), 2525 (alternative)
    const alternativePorts = [587, 465, 25, 2525].filter(p => p !== primaryPort);
    portsToTry = [primaryPort, ...alternativePorts];
  }
  
  // Create primary transporter
  emailTransporter = createEmailTransporter(primaryPort);
  console.log('✅ Email transporter configured');
  console.log('   Host:', process.env.EMAIL_HOST);
  console.log('   Primary Port:', primaryPort);
  if (!isOffice365 && portsToTry.length > 1) {
    const altPorts = portsToTry.slice(1);
    console.log('   Alternative ports to try:', altPorts.join(', '));
  }
  console.log('   User:', process.env.EMAIL_USER);
  console.log('   From:', process.env.FROM_EMAIL || process.env.EMAIL_USER);
  console.log('   sendEmailWithPortFallback function available:', typeof sendEmailWithPortFallback === 'function');
  
  // Warning for cloud hosting providers that may block SMTP
  if (process.env.RENDER || process.env.VERCEL || process.env.HEROKU) {
    console.warn('⚠️  WARNING: Cloud hosting providers (like Render) often block outbound SMTP ports (25, 465, 587)');
    console.warn('⚠️  If emails fail to send due to connection timeouts, consider using:');
    console.warn('   - SendGrid (recommended for cloud hosting - uses API, not SMTP)');
    console.warn('   - Resend (modern email API - already in package.json)');
    console.warn('   - Mailgun (reliable SMTP alternative)');
    console.warn('   - Or configure your email provider to use an API instead of SMTP');
  }
  
  // Test email connection (non-blocking, don't fail if verification times out)
  // Note: Verification is optional - emails will still send even if verification fails
  // The transporter has built-in timeouts (60 seconds) so we don't need an additional wrapper
  emailTransporter.verify(function(error, success) {
    if (error) {
      // Don't use console.error - this is not a critical error
      // Only log if it's not a timeout (timeouts are expected and not concerning)
      if (!error.message.includes('timeout') && !error.message.includes('ETIMEDOUT')) {
        console.warn('⚠️  Email transporter verification failed:', error.message);
        console.warn('⚠️  Email sending may still work. Verification is just a connectivity test.');
      }
      // For timeouts, just log a single quiet message
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        console.log('ℹ️  Email transporter verification timed out (this is normal). Emails will still send when needed.');
      }
    } else {
      console.log('✅ Email transporter verified - ready to send emails');
    }
  });
  
  // IMAP setup for receiving emails (if IMAP settings provided)
  if (process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASS) {
    console.log('✅ IMAP configured for receiving emails');
    console.log('   IMAP Host:', process.env.IMAP_HOST);
    console.log('   IMAP Port:', process.env.IMAP_PORT || 993);
  } else {
    console.warn('⚠️  IMAP not configured - email receiving will be limited');
    console.warn('   Optional: IMAP_HOST, IMAP_USER, IMAP_PASS, IMAP_PORT');
  }
  
  // Resend setup for sending emails (recommended for cloud hosting)
  if (process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
    console.log('✅ Resend configured for sending emails (using API instead of SMTP)');
    console.log('   This works on cloud hosting providers like Render');
    console.log('   Note: Make sure your "from" email domain is verified in Resend dashboard');
    console.log('   From email:', process.env.FROM_EMAIL || process.env.EMAIL_USER || 'contact@saintventura.co.za');
  } else {
    console.warn('⚠️  Resend not configured - using SMTP (may fail on cloud hosting)');
    console.warn('   Recommended: Set RESEND_API_KEY in .env file');
    console.warn('   Get API key from: https://resend.com/api-keys');
  }
} else {
  console.warn('⚠️  Email not configured - broadcast and email features will be limited');
  console.warn('   Required: EMAIL_HOST, EMAIL_USER, EMAIL_PASS (for SMTP)');
  console.warn('   OR: RESEND_API_KEY (recommended for cloud hosting)');
  
  // Still try to initialize Resend if API key is provided
  if (process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
    console.log('✅ Resend configured for sending emails (using API instead of SMTP)');
    console.log('   This works on cloud hosting providers like Render');
  }
}

// Handlebars template setup
let emailTemplates = {};
let baseTemplate = null;

// Load and compile email templates
async function loadEmailTemplates() {
  try {
    const templatesDir = path.join(__dirname, 'templates');
    
    // Load base template
    const baseTemplatePath = path.join(templatesDir, 'base.hbs');
    const baseTemplateContent = await fs.readFile(baseTemplatePath, 'utf8');
    baseTemplate = handlebars.compile(baseTemplateContent);
    
    // Register base as a partial
    handlebars.registerPartial('base', baseTemplate);
    
    // Load other templates
    const templateFiles = await fs.readdir(templatesDir);
    for (const file of templateFiles) {
      if (file.endsWith('.hbs') && file !== 'base.hbs') {
        const templateName = file.replace('.hbs', '');
        const templatePath = path.join(templatesDir, file);
        const templateContent = await fs.readFile(templatePath, 'utf8');
        emailTemplates[templateName] = handlebars.compile(templateContent);
        console.log(`✅ Loaded email template: ${templateName}`);
      }
    }
    
    console.log('✅ All email templates loaded successfully');
  } catch (error) {
    console.error('❌ Error loading email templates:', error);
    // Continue without templates - fallback to old method
  }
}

// Initialize templates on startup
loadEmailTemplates();

// Professional Email Template Generator
const BRAND_LOGO = 'https://dl.dropboxusercontent.com/scl/fi/pew6zj6bt0myobu7zl4eu/1-21.png?rlkey=z6jhjxe71rpuk37td9ktwvqmg&st=303hz8tw&dl=1';
const BRAND_COLOR_PRIMARY = '#000000';
const BRAND_COLOR_SECONDARY = '#FFFFFF';
const BRAND_COLOR_ACCENT = '#F5F5F5';
const BRAND_NAME = 'Saint Ventura';
const BRAND_WEBSITE = 'https://saintventura.co.za';

// Slideshow images from homepage
const SLIDESHOW_IMAGES = [
  'https://dl.dropboxusercontent.com/scl/fi/gx1r3qe18sgo80p5jrgm8/2-3.PNG?rlkey=gx2mnfof9kfyc72blsy1ppun5&st=r070m73p&dl=1',
  'https://dl.dropboxusercontent.com/scl/fi/bh2welg72z6iu0dan8041/2-4.PNG?rlkey=5bmykcf56ds34f978mvprn8dl&st=zjpdyd7o&dl=1',
  'https://dl.dropboxusercontent.com/scl/fi/ppya1riwy9g0zoo0l93sz/2-1.PNG?rlkey=zm9fq5matkz014b2v9pwbm8ff&st=wu45teik&dl=1',
  'https://dl.dropboxusercontent.com/scl/fi/ytsic6wxaux4xhdu4mu12/2-2.PNG?rlkey=wx76vqmyimpbybiywputta1qi&st=283np3lw&dl=1'
];

// Social media links
const SOCIAL_MEDIA = {
  instagram: 'https://www.instagram.com/designedbythesaints/',
  tiktok: 'https://www.tiktok.com/@designedbythesaints',
  youtube: 'https://www.youtube.com/@saintventura'
};

// Helper function to render email template using Handlebars
function renderEmailTemplate(templateName, context) {
  try {
    // Try to use Handlebars template if available
    if (emailTemplates[templateName]) {
      return emailTemplates[templateName](context);
    } else if (baseTemplate) {
      // Fallback to base template
      return baseTemplate(context);
    }
  } catch (error) {
    console.error(`Error rendering template ${templateName}:`, error);
  }
  return null;
}

// Helper function to format message content (convert newlines to HTML paragraphs)
function formatMessageContent(content) {
  if (!content) return '';
  return content.split('\n').map(p => {
    const trimmed = p.trim();
    if (!trimmed) return '<br>';
    return `<p style="margin: 0 0 18px 0; word-wrap: break-word; color: #444444; font-weight: 700;">${trimmed}</p>`;
  }).join('');
}

// Helper function to generate product grid HTML
function generateProductGrid(products) {
  if (!products || products.length === 0) return '';
  
  const productsPerRow = Math.min(products.length, 4);
  const productRows = [];
  for (let i = 0; i < products.length; i += productsPerRow) {
    productRows.push(products.slice(i, i + productsPerRow));
  }
  
  return productRows.map(row => `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; width: 100% !important; max-width: 100% !important; table-layout: fixed;">
      <tr>
        ${row.map(product => `
          <td align="center" class="product-cell" style="padding: 10px; width: ${100 / row.length}%; vertical-align: top; word-wrap: break-word;">
            <div style="background: #FFFFFF; border: 1px solid #E5E5E5; border-radius: 8px; padding: 15px; max-width: 250px; margin: 0 auto; width: 100%; box-sizing: border-box;">
              ${product.image && product.image.trim() ? `<img src="${product.image.trim()}" alt="${(product.name || '').replace(/"/g, '&quot;')}" style="width: 100%; max-width: 200px; height: auto; border-radius: 4px; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto; border: 0; outline: none; text-decoration: none;">` : ''}
              <h3 style="color: #000000; font-size: 16px; font-weight: 700; margin: 0 0 8px 0; line-height: 1.3; word-wrap: break-word;">${product.name || ''}</h3>
              ${product.description ? `<p style="color: #666666; font-size: 13px; margin: 0 0 12px 0; line-height: 1.4; word-wrap: break-word;">${product.description.substring(0, 80)}${product.description.length > 80 ? '...' : ''}</p>` : ''}
              <p style="color: #000000; font-size: 18px; font-weight: 900; margin: 0;">R${(product.price || 0).toFixed(2)}</p>
            </div>
          </td>
        `).join('')}
      </tr>
    </table>
  `).join('');
}

function generateEmailTemplate(type, data = {}) {
  let { 
    heading = '', 
    content = '', 
    ctaText = 'Shop Now', 
    ctaLink = BRAND_WEBSITE,
    products = [],
    orderDetails = '',
    subscriberName = '',
    supportResponse = '',
    includeSlideshow = false,
    includeSocialMedia = true, // Always include footer with social media
    isSubscribed = true, // Whether the recipient is subscribed to newsletter
    // New template variables
    title = '',
    subtitle = '',
    message = '',
    bannerImage = '',
    productGrid = '',
    email = ''
  } = data;

  let mainContent = '';
  let headerImage = '';
  let backgroundColor = '#FFFFFF';

  // Template-specific content
  switch(type) {
    case 'new-subscriber':
      heading = heading || 'Welcome to the Saint Ventura Family - Your Journey to Premium Streetwear Begins Now!';
      content = content || `Welcome to Saint Ventura, where premium streetwear meets exceptional style! We're absolutely thrilled and honored to have you join our exclusive community of fashion-forward individuals who appreciate quality, craftsmanship, and authentic street culture.\n\nAt Saint Ventura, we don't just create clothing—we craft experiences. Every piece in our collection is thoughtfully designed, carefully curated, and meticulously produced to meet the highest standards of quality and style. We believe that what you wear is an extension of who you are, and we're here to help you express your unique identity through premium streetwear that speaks to your soul.\n\nAs a valued subscriber, you're now part of an elite community that receives:\n\n✨ Exclusive Early Access: Be the first to discover our latest collections and new product launches before anyone else. Get first dibs on limited edition pieces and special collaborations.\n\n🎁 Special Promotions: Enjoy members-only discounts, flash sales, and exclusive offers reserved just for our community. We regularly reward our subscribers with incredible savings.\n\n📰 Insider Updates: Stay ahead of the trends with behind-the-scenes content, styling tips, and exclusive insights into our design process and upcoming releases.\n\n🌟 Priority Support: Receive personalized customer service and priority assistance whenever you need help or have questions.\n\nWe're constantly working to bring you the freshest designs and most innovative streetwear pieces that reflect your unique style and personality. Our team of designers and craftspeople pour their passion into every detail, ensuring that each piece not only looks incredible but feels amazing when you wear it.\n\nFrom bold statement pieces that command attention to versatile essentials that seamlessly integrate into your wardrobe, our collections are designed to elevate your style and help you stand out from the crowd. We source only the finest materials and work with expert manufacturers to ensure every item meets our exacting standards.\n\nGet ready to elevate your wardrobe, express your individuality, and stay ahead of the trends. We can't wait to share our passion for streetwear with you and help you discover pieces that will become staples in your collection!\n\nThank you for choosing Saint Ventura. Your style journey starts here, and we're excited to be part of it.`;
      ctaText = 'Explore Our Collection';
      backgroundColor = '#FFFFFF';
      headerImage = '<div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 60px 20px; text-align: center; border-bottom: 4px solid #FFFFFF;"><h1 style="color: #FFFFFF; font-size: 42px; margin: 0 0 15px 0; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">WELCOME TO SAINT VENTURA</h1><p style="color: #CCCCCC; font-size: 18px; margin: 0 0 10px 0; font-weight: 500; letter-spacing: 1px;">Premium Streetwear Awaits</p><p style="color: #999999; font-size: 14px; margin: 0; font-weight: 400;">Your Style Journey Begins Here</p></div>';
      break;
    
    case 'promotion':
      heading = heading || '🎉 Exclusive Promotion Alert - Limited Time Only! Don\'t Miss Out on These Incredible Savings!';
      content = content || `This is your moment! We're absolutely thrilled to bring you an exclusive promotion that you simply cannot afford to miss. For a limited time only, we're offering incredible savings on our most popular and sought-after streetwear pieces.\n\nWhether you're looking to refresh your wardrobe with the latest trends, try something completely new and daring, or stock up on your all-time favorite styles, now is the perfect time to shop. Our carefully selected promotion items feature the exact same premium quality, cutting-edge designs, and attention to detail that you've come to expect from Saint Ventura—now available at absolutely unbeatable prices that won't last long.\n\nThis exclusive offer includes everything from our signature statement pieces that make bold fashion statements to versatile essentials that seamlessly integrate into any wardrobe. Each item in this promotion has been handpicked to ensure you're getting the best value while maintaining the premium quality standards that define the Saint Ventura brand.\n\nBut here's the thing—this offer won't last forever! Once these items are gone, they're gone. Popular sizes and styles are already selling out fast, and we don't want you to miss out on the opportunity to elevate your style while saving significantly on premium streetwear that reflects your unique personality and fashion sense.\n\nDon't let this incredible opportunity slip away. Shop now and transform your wardrobe while saving big on pieces that will become the foundation of your streetwear collection. Join thousands of satisfied customers who have already taken advantage of this exclusive offer and are loving their new Saint Ventura pieces.\n\nRemember, great style doesn't have to come with a great price tag—at least not during this limited-time promotion. Elevate your streetwear game today and discover why so many fashion-forward individuals choose Saint Ventura for their premium streetwear needs!\n\n🔥 Why This Promotion is Special:\n\nThis isn't just any sale—this is a carefully curated selection of our most beloved pieces, now available at prices that make premium streetwear accessible to everyone. We've chosen these items specifically because they represent the best of what Saint Ventura has to offer: exceptional quality, timeless style, and unbeatable value.\n\nEvery piece in this promotion has been tested and loved by our community. These are the items that customers rave about, the pieces that become wardrobe staples, and the designs that define what Saint Ventura stands for. We're offering these incredible savings because we want more people to experience the quality and style that sets us apart.\n\n💎 What Makes This Different:\n\nUnlike flash sales that come and go, this promotion features items that have proven their worth. These aren't clearance items or last season's leftovers—these are current favorites, bestsellers, and timeless classics that continue to resonate with our community. We're offering these savings as a thank you to our loyal customers and an invitation to new ones.\n\n⏰ Act Fast - Limited Availability:\n\nInventory is moving quickly, and once these items are gone, they're gone. Popular sizes are already starting to sell out, and we want to make sure you don't miss out on the pieces you've been eyeing. Don't wait—secure your favorites now before they're gone!\n\n🎁 Bonus Benefits:\n\nWhen you shop during this promotion, you're not just getting incredible savings—you're also getting:\n\n• Free shipping on orders over R500\n• 30-day hassle-free returns\n• Premium packaging and presentation\n• Access to our exclusive customer community\n• Priority support for any questions or concerns\n\nThis is more than a sale—it's an opportunity to build your perfect streetwear collection at unbeatable prices. Don't let this moment pass you by!`;
      backgroundColor = '#FFFFFF';
      headerImage = '<div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 60px 20px; text-align: center; border-bottom: 4px solid #FFFFFF;"><h1 style="color: #FFFFFF; font-size: 44px; margin: 0 0 15px 0; font-weight: 900; letter-spacing: 4px; text-transform: uppercase; text-shadow: 3px 3px 6px rgba(0,0,0,0.7);">SPECIAL OFFER</h1><p style="color: #FFFFFF; font-size: 20px; margin: 0 0 10px 0; font-weight: 700; letter-spacing: 1px;">Limited Time - Act Now!</p><p style="color: #CCCCCC; font-size: 16px; margin: 0; font-weight: 400;">Incredible Savings Await</p></div>';
      break;
    
    case 'new-product':
      heading = heading || '✨ Introducing Our Latest Collection - Where Innovation Meets Style and Creativity Knows No Bounds!';
      content = content || `We're absolutely thrilled and beyond excited to unveil our newest collection, where cutting-edge design meets premium craftsmanship in ways you've never seen before. After months of careful development, extensive research, and meticulous attention to every single detail, we're incredibly proud to present pieces that truly push the boundaries of streetwear fashion and redefine what's possible in contemporary urban style.\n\nThis groundbreaking collection represents our unwavering commitment to innovation, uncompromising quality, and forward-thinking style. Each piece has been meticulously designed by our talented team of designers who understand that great fashion is about more than just aesthetics—it's about creating pieces that not only look absolutely incredible but feel amazing when you wear them, move with your body, and become an extension of your personal style.\n\nWe've gone above and beyond to source only the finest materials from trusted suppliers around the world. From premium fabrics that offer exceptional comfort and durability to innovative textiles that provide unique textures and finishes, every material has been carefully selected to ensure it meets our exacting standards. We've worked closely with expert craftspeople and manufacturers who share our passion for quality, ensuring that every stitch, every seam, and every detail is executed to perfection.\n\nFrom bold statement pieces that command attention and make unforgettable first impressions to versatile essentials that seamlessly integrate into any wardrobe and become the foundation of countless outfit combinations, this collection truly has something for every streetwear enthusiast. Whether you're building a complete new wardrobe from scratch, adding standout pieces to your existing collection, or looking for that perfect item to elevate your current style, you'll find exactly what you're looking for—and probably discover a few pieces you didn't even know you needed!\n\nThis collection isn't just about clothing—it's about self-expression, confidence, and the freedom to be authentically you. Each piece tells a story, reflects a mood, and empowers you to showcase your unique personality through your style choices. We believe that fashion should be fun, expressive, and accessible, and this collection embodies all of those values.\n\nBe among the first to experience these groundbreaking designs and discover why fashion enthusiasts and style influencers are already talking about this collection. Explore the collection now, find your new favorite pieces, and join the community of trendsetters who choose Saint Ventura for their premium streetwear needs. Your next style statement is waiting!\n\n🎨 Design Philosophy:\n\nThis collection represents months of creative exploration, where our design team pushed boundaries and challenged conventions. We drew inspiration from street culture, contemporary art, music, and the vibrant energy of urban life. Every piece tells a story, every detail has purpose, and every design choice reflects our commitment to creating streetwear that's both timeless and trendsetting.\n\nOur designers spent countless hours perfecting silhouettes, experimenting with proportions, and refining every element until it met our exacting standards. We believe that great design is in the details—the way a garment drapes, how it moves with your body, the subtle textures and finishes that make each piece unique.\n\n🌟 Quality That Speaks for Itself:\n\nWe've partnered with world-class manufacturers who share our commitment to excellence. Every piece undergoes rigorous quality control, ensuring that what you receive is nothing short of perfect. From the initial fabric selection to the final stitch, we maintain the highest standards throughout the entire production process.\n\nOur materials are sourced from trusted suppliers who provide premium fabrics that not only look incredible but stand the test of time. We use advanced construction techniques and premium hardware to ensure durability, comfort, and longevity. This isn't fast fashion—this is investment-worthy streetwear designed to become staples in your wardrobe.\n\n💫 What's New and Exciting:\n\nThis collection introduces several exciting innovations:\n\n• Advanced fabric technologies for enhanced comfort and performance\n• Bold new color palettes that make a statement\n• Innovative silhouettes that blend classic and contemporary\n• Exclusive prints and patterns you won't find anywhere else\n• Thoughtful details and finishing touches that elevate every piece\n\nEach item has been carefully curated to offer something unique, whether it's a fresh take on a classic silhouette, an innovative use of materials, or a design detail that sets it apart from anything else in your wardrobe.\n\n🚀 Be Among the First:\n\nAs a valued member of our community, you're getting exclusive early access to this collection. Be among the first to experience these groundbreaking designs, secure your favorite pieces before they sell out, and join the conversation as fashion enthusiasts discover what makes this collection special.\n\nWe're incredibly proud of what we've created, and we can't wait to see how you style these pieces and make them your own. This collection is more than clothing—it's a celebration of individuality, creativity, and the power of great design to transform how you feel and express yourself.`;
      headerImage = '<div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 60px 20px; text-align: center; border-bottom: 4px solid #FFFFFF;"><h1 style="color: #FFFFFF; font-size: 42px; margin: 0 0 15px 0; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">NEW COLLECTION</h1><p style="color: #CCCCCC; font-size: 18px; margin: 0 0 10px 0; font-weight: 500; letter-spacing: 1px;">Innovation Meets Style</p><p style="color: #999999; font-size: 14px; margin: 0; font-weight: 400;">Groundbreaking Designs Await</p></div>';
      break;
    
    case 'news':
      heading = heading || '📰 Latest News & Exciting Updates from Saint Ventura - What\'s New and What\'s Coming Next!';
      content = content || `We have some absolutely thrilling updates and exciting news to share with you! At Saint Ventura, we're constantly evolving, innovating, and working tirelessly behind the scenes to bring you the best possible experience, the most cutting-edge designs, and the highest quality products. Here's what's been happening in our world and what you can look forward to in the coming months.\n\nWe've been incredibly busy developing new designs that push creative boundaries, improving our manufacturing processes to ensure even better quality, and most importantly, listening carefully to your valuable feedback. Your input, suggestions, and honest opinions have been absolutely invaluable in helping us create products that truly resonate with our community and reflect what you actually want to see and wear. We're deeply grateful for your continued support, enthusiasm, and the trust you place in us.\n\nOur design team has been working on some truly innovative concepts that blend contemporary streetwear aesthetics with timeless style elements. We're experimenting with new materials, exploring unique color palettes, and developing silhouettes that are both fashion-forward and incredibly wearable. The creative energy in our studio has been electric, and we can't wait to share these exciting developments with you.\n\nIn the coming months, you can expect to see:\n\n🤝 Exciting New Collaborations: We're partnering with talented artists, designers, and influencers to create limited-edition collections that fuse different creative perspectives and bring fresh energy to our brand.\n\n📦 Expanded Product Lines: We're introducing new categories and expanding existing ones to give you even more options for expressing your unique style. From accessories to outerwear, we're building out a complete streetwear ecosystem.\n\n🎨 More Ways to Express Yourself: We're developing new customization options, exclusive colorways, and special edition pieces that allow you to create looks that are truly one-of-a-kind.\n\n🛍️ Enhanced Shopping Experience: We're working on initiatives that will make shopping with us even more convenient, enjoyable, and personalized. From improved website features to better customer service, we're committed to making every interaction with Saint Ventura exceptional.\n\n🌍 Sustainability Initiatives: We're also focusing on more sustainable practices and eco-friendly materials because we believe that great style shouldn't come at the expense of our planet.\n\nStay tuned for more updates, exclusive previews, and behind-the-scenes content. Thank you for being part of the Saint Ventura family—together, we're not just following trends, we're shaping the future of streetwear fashion!\n\n📊 What We've Been Up To:\n\nBehind the scenes, our team has been working tirelessly to bring you the best possible experience. We've been refining our processes, improving quality control, and implementing new systems that allow us to serve you better. Every decision we make is guided by one simple principle: putting you, our community, first.\n\nWe've invested in new technology, expanded our team, and strengthened our partnerships to ensure that we can continue delivering the premium quality and exceptional service you've come to expect from Saint Ventura. These improvements might not always be visible, but they're making a real difference in everything we do.\n\n🎯 Our Vision for the Future:\n\nLooking ahead, we're more excited than ever about what's to come. We're not just following trends—we're setting them. We're not just creating clothing—we're building a community. And we're not just selling products—we're sharing a vision of what streetwear can be when it's done right.\n\nOur commitment to quality, innovation, and community remains unwavering. We're constantly pushing ourselves to do better, create more, and exceed expectations. Every new collection, every new collaboration, and every new initiative is an opportunity to show you what Saint Ventura stands for.\n\n💬 Your Voice Matters:\n\nWe want to hear from you! Your feedback shapes what we create, and your input helps us improve. Whether it's a product suggestion, a design idea, or just your thoughts on what you'd like to see next, we're listening. Reach out to us, share your thoughts, and be part of the conversation that's shaping the future of Saint Ventura.\n\nTogether, we're building something special. Thank you for being part of this journey with us. Your support means everything, and we're committed to continuing to earn it every single day.`;
      headerImage = '<div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 60px 20px; text-align: center; border-bottom: 4px solid #FFFFFF;"><h1 style="color: #FFFFFF; font-size: 42px; margin: 0 0 15px 0; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">LATEST NEWS</h1><p style="color: #CCCCCC; font-size: 18px; margin: 0 0 10px 0; font-weight: 500; letter-spacing: 1px;">Stay in the Loop</p><p style="color: #999999; font-size: 14px; margin: 0; font-weight: 400;">What\'s New & What\'s Next</p></div>';
      break;
    
    case 'fulfiller-order':
      heading = heading || 'New Order Alert - Action Required: Please Fulfill This Order Promptly';
      if (orderDetails) {
        // Format order details nicely
        if (typeof orderDetails === 'object') {
          const order = orderDetails;
          let detailsText = `📦 ORDER DETAILS:\n\n`;
          detailsText += `Order ID: ${order.orderId || 'N/A'}\n`;
          detailsText += `Customer Name: ${order.customerName || 'N/A'}\n`;
          detailsText += `Customer Email: ${order.customerEmail || 'N/A'}\n`;
          detailsText += `Order Total: R${(order.total || 0).toFixed(2)}\n`;
          detailsText += `Shipping Method: ${order.shippingMethod || 'N/A'}\n`;
          if (order.deliveryAddress) {
            detailsText += `Delivery Address: ${order.deliveryAddress}\n`;
          }
          detailsText += `\n🛍️ ORDER ITEMS:\n\n`;
          (order.orderItems || []).forEach((item, index) => {
            detailsText += `${index + 1}. ${item.name}\n`;
            detailsText += `   Quantity: ${item.quantity}\n`;
            detailsText += `   Price per unit: R${(item.price || 0).toFixed(2)}\n`;
            detailsText += `   Subtotal: R${((item.price || 0) * (item.quantity || 1)).toFixed(2)}\n\n`;
          });
          content = `Hi there,\n\nYou have received a new order that requires your immediate attention. A customer has placed an order and is eagerly awaiting their premium Saint Ventura pieces. Please review all the order details carefully below and process this order as soon as possible to ensure timely delivery and customer satisfaction.\n\nCustomer satisfaction is our top priority, and prompt order fulfillment is essential to maintaining our reputation for excellent service. Please ensure all items are carefully checked for quality, properly packaged, and prepared for shipping according to the specified delivery method.\n\n${detailsText}\n\nThank you for your attention to this order. If you have any questions or need clarification on any aspect of this order, please don't hesitate to reach out. Let's make sure this customer has an exceptional experience with Saint Ventura!`;
        } else {
          content = `Hi there,\n\nYou have received a new order that requires your immediate attention. A customer has placed an order and is eagerly awaiting their premium Saint Ventura pieces. Please review all the order details carefully below and process this order as soon as possible to ensure timely delivery and customer satisfaction.\n\nCustomer satisfaction is our top priority, and prompt order fulfillment is essential to maintaining our reputation for excellent service. Please ensure all items are carefully checked for quality, properly packaged, and prepared for shipping according to the specified delivery method.\n\n${orderDetails}\n\nThank you for your attention to this order. If you have any questions or need clarification on any aspect of this order, please don't hesitate to reach out. Let's make sure this customer has an exceptional experience with Saint Ventura!`;
        }
      } else {
        content = 'Hi there,\n\nYou have received a new order that requires your immediate attention. A customer has placed an order and is eagerly awaiting their premium Saint Ventura pieces. Please log into the dashboard to review the order details and process this order as soon as possible to ensure timely delivery and customer satisfaction.\n\nCustomer satisfaction is our top priority, and prompt order fulfillment is essential to maintaining our reputation for excellent service. Thank you for your attention to this order!';
      }
      ctaText = 'View Dashboard & Process Order';
      ctaLink = `${BRAND_WEBSITE}/admin.html`;
      headerImage = '<div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 60px 20px; text-align: center; border-bottom: 4px solid #FFFFFF;"><h1 style="color: #FFFFFF; font-size: 40px; margin: 0 0 15px 0; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; text-shadow: 3px 3px 6px rgba(0,0,0,0.7);">NEW ORDER</h1><p style="color: #FFFFFF; font-size: 18px; margin: 0 0 10px 0; font-weight: 600; letter-spacing: 1px;">Action Required</p><p style="color: #CCCCCC; font-size: 14px; margin: 0; font-weight: 400;">Please Process Promptly</p></div>';
      break;
    
    case 'abandoned-cart':
      heading = heading || 'Don\'t Miss Out - Complete Your Purchase and Secure Your Style!';
      content = content || `We noticed you left some amazing items in your cart, and we didn't want you to miss out on these incredible pieces! We know how busy life can get, but we're here to remind you that those carefully selected items are still waiting for you.\n\nThose pieces you chose weren't just random selections—they caught your eye for a reason. Whether it was the perfect fit, the ideal color, or that unique style that spoke to you, those items are ready to become part of your wardrobe and help you express your personal style.\n\nDon't let these pieces slip away! Complete your purchase now and secure your style. Our inventory moves fast, especially for popular sizes and trending items, so we'd hate for you to miss out on something you really wanted.\n\nPlus, completing your purchase now means you'll have your new pieces sooner, allowing you to start styling them and making them part of your everyday looks. There's nothing quite like the excitement of unboxing new streetwear pieces and incorporating them into your wardrobe!\n\nYour cart is saved and ready whenever you are. Just click the button below to return to checkout and complete your purchase. We're here to help if you need any assistance or have questions about sizing, shipping, or anything else. Your perfect streetwear pieces are just one click away!`;
      ctaText = 'Complete Purchase Now';
      ctaLink = `${BRAND_WEBSITE}/checkout.html`;
      headerImage = '<div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 60px 20px; text-align: center; border-bottom: 4px solid #FFFFFF;"><h1 style="color: #FFFFFF; font-size: 40px; margin: 0 0 15px 0; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; text-shadow: 3px 3px 6px rgba(0,0,0,0.7);">FEW STEPS LEFT!</h1><p style="color: #FFFFFF; font-size: 18px; margin: 0 0 10px 0; font-weight: 600; letter-spacing: 1px;">Complete Your Purchase</p><p style="color: #CCCCCC; font-size: 14px; margin: 0; font-weight: 400;">Don\'t Miss Out on These Pieces</p></div>';
      break;
    
    case 'customer-support':
      heading = heading || 'Thank You for Contacting Us';
      content = supportResponse || 'We have received your message and will get back to you shortly.';
      break;
    
    case 'order-confirmation':
      heading = heading || 'Order Confirmation - Thank You for Your Purchase!';
      content = content || `We're absolutely thrilled to confirm that your order has been successfully processed and your payment has been received! Thank you for choosing Saint Ventura for your premium streetwear needs.\n\nYour order is now being prepared with the utmost care and attention to detail. Our team is working diligently to ensure that every item meets our exacting quality standards before it's carefully packaged and shipped to you.\n\nWe understand how exciting it is to receive your new pieces, and we're committed to getting them to you as quickly as possible. Once your order ships, you'll receive tracking information so you can follow your package every step of the way.\n\nIf you have any questions about your order, shipping, or anything else, please don't hesitate to reach out to us. We're here to help and ensure you have an exceptional experience with Saint Ventura.\n\nThank you again for your purchase. We can't wait for you to experience the quality and style that defines Saint Ventura!`;
      ctaText = 'Continue Shopping';
      ctaLink = BRAND_WEBSITE;
      backgroundColor = '#FFFFFF';
      headerImage = '<div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 60px 20px; text-align: center; border-bottom: 4px solid #FFFFFF;"><h1 style="color: #FFFFFF; font-size: 42px; margin: 0 0 15px 0; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">ORDER CONFIRMED</h1><p style="color: #CCCCCC; font-size: 18px; margin: 0 0 10px 0; font-weight: 500; letter-spacing: 1px;">Payment Successful</p><p style="color: #999999; font-size: 14px; margin: 0; font-weight: 400;">Thank You for Your Purchase</p></div>';
      break;
  }

  // Build products section if products provided
  let productsSection = '';
  if (products && products.length > 0) {
    // Limit to 4 products per row for better email client compatibility
    const productsPerRow = Math.min(products.length, 4);
    const productRows = [];
    for (let i = 0; i < products.length; i += productsPerRow) {
      productRows.push(products.slice(i, i + productsPerRow));
    }
    
      productsSection = productRows.map(row => `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; width: 100% !important; max-width: 100% !important; table-layout: fixed;">
        <tr>
          ${row.map(product => `
            <td align="center" class="product-cell" style="padding: 10px; width: ${100 / row.length}%; vertical-align: top; word-wrap: break-word;">
              <div style="background: #FFFFFF; border: 1px solid #E5E5E5; border-radius: 8px; padding: 15px; max-width: 250px; margin: 0 auto; width: 100%; box-sizing: border-box;">
                ${product.image && product.image.trim() ? `<img src="${product.image.trim()}" alt="${(product.name || '').replace(/"/g, '&quot;')}" style="width: 100%; max-width: 200px; height: auto; border-radius: 4px; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto; border: 0; outline: none; text-decoration: none;">` : ''}
                <h3 style="color: #000000; font-size: 16px; font-weight: 700; margin: 0 0 8px 0; line-height: 1.3; word-wrap: break-word;">${product.name || ''}</h3>
                ${product.description ? `<p style="color: #666666; font-size: 13px; margin: 0 0 12px 0; line-height: 1.4; word-wrap: break-word;">${product.description.substring(0, 80)}${product.description.length > 80 ? '...' : ''}</p>` : ''}
                <p style="color: #000000; font-size: 18px; font-weight: 900; margin: 0;">R${(product.price || 0).toFixed(2)}</p>
              </div>
            </td>
          `).join('')}
        </tr>
      </table>
    `).join('');
  }
  
  // Add slideshow images for promotional emails or when explicitly requested
  let slideshowSection = '';
  if ((type === 'promotion' || type === 'new-product' || type === 'new-subscriber' || includeSlideshow) && SLIDESHOW_IMAGES.length > 0) {
    // Use first 2 slideshow images for email
    const emailSlideshowImages = SLIDESHOW_IMAGES.slice(0, 2);
    slideshowSection = `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0; width: 100% !important; max-width: 100% !important; table-layout: fixed;">
        <tr>
          ${emailSlideshowImages.map(img => `
            <td align="center" class="slideshow-cell" style="padding: 10px; width: ${100 / emailSlideshowImages.length}%; word-wrap: break-word;">
              <img src="${img.trim()}" alt="${BRAND_NAME}" style="width: 100%; max-width: 280px; height: auto; border-radius: 8px; display: block; margin: 0 auto; border: 0; outline: none; text-decoration: none;">
            </td>
          `).join('')}
        </tr>
      </table>
    `;
  }
  
  // Social media links will be added to footer

  // Try to use Handlebars template if available (for broadcast emails and new template system)
  if (type === 'broadcast' || title || subtitle || message) {
    const templateContext = {
      title: title || heading,
      subtitle: subtitle || '',
      message: formatMessageContent(message || content),
      ctaText: ctaText || '',
      ctaLink: ctaLink || BRAND_WEBSITE,
      bannerImage: bannerImage || '',
      productGrid: productGrid || (productsSection || ''),
      brandName: BRAND_NAME,
      brandLogo: BRAND_LOGO,
      brandWebsite: BRAND_WEBSITE,
      socialMedia: SOCIAL_MEDIA,
      isSubscribed: isSubscribed !== false,
      email: email || '',
      currentYear: new Date().getFullYear(),
      headerImage: headerImage || ''
    };
    
    const rendered = renderEmailTemplate('broadcast', templateContext);
    if (rendered) {
      return rendered;
    }
  }
  
  // Fallback to original string-based template generation
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${heading}</title>
    <style type="text/css">
        /* Prevent horizontal scrolling */
        body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow-x: hidden !important;
            -webkit-text-size-adjust: 100% !important;
            -ms-text-size-adjust: 100% !important;
        }
        table {
            border-collapse: collapse !important;
            mso-table-lspace: 0pt !important;
            mso-table-rspace: 0pt !important;
        }
        img {
            border: 0 !important;
            outline: none !important;
            text-decoration: none !important;
            -ms-interpolation-mode: bicubic !important;
            max-width: 100% !important;
            height: auto !important;
            display: block !important;
        }
        /* Responsive email styles */
        @media only screen and (max-width: 600px) {
            body {
                width: 100% !important;
                min-width: 100% !important;
            }
            .email-container {
                width: 100% !important;
                max-width: 100% !important;
            }
            .email-content {
                padding: 20px !important;
            }
            .product-cell {
                width: 100% !important;
                display: block !important;
                padding: 10px 0 !important;
            }
            .social-button {
                display: block !important;
                width: 100% !important;
                margin: 5px 0 !important;
            }
            .slideshow-cell {
                width: 100% !important;
                display: block !important;
                padding: 10px 0 !important;
            }
            img {
                max-width: 100% !important;
                width: 100% !important;
                height: auto !important;
            }
            table[class="email-container"] {
                width: 100% !important;
            }
            .email-logo {
                max-width: 60px !important;
                width: 60px !important;
                height: 60px !important;
            }
        }
    </style>
    <!--[if mso]>
    <style type="text/css">
        body, table, td {font-family: Arial, sans-serif !important;}
    </style>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-image: url('https://dl.dropboxusercontent.com/scl/fi/pb7ot6h7e1u9rshayp8qc/1-22.png?rlkey=u0pia430x0w3uvnfbhkpo6wbi&st=rwbw10lc&dl=1'); background-size: cover; background-position: center; background-repeat: no-repeat; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; width: 100% !important; max-width: 100% !important; overflow-x: hidden !important;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-image: url('https://dl.dropboxusercontent.com/scl/fi/pb7ot6h7e1u9rshayp8qc/1-22.png?rlkey=u0pia430x0w3uvnfbhkpo6wbi&st=rwbw10lc&dl=1'); background-size: cover; background-position: center; background-repeat: no-repeat; width: 100% !important; max-width: 100% !important;">
        <tr>
            <td align="center" style="padding: 20px 10px; width: 100% !important; max-width: 100% !important;">
                <!-- Main Container -->
                <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); max-width: 600px; width: 100% !important; table-layout: fixed; border: 2px solid #000000;">
                    <!-- Enhanced Header with Logo and Branding -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 30px 20px; text-align: center; width: 100%; border-bottom: 3px solid #FFFFFF;">
                            <img src="${BRAND_LOGO}" alt="${BRAND_NAME}" class="email-logo" style="max-width: 90px; width: 90px; height: 90px; display: block; margin: 0 auto 15px auto; border: 3px solid #FFFFFF; outline: none; text-decoration: none; border-radius: 12px; object-fit: cover; box-shadow: 0 4px 12px rgba(255,255,255,0.2);">
                            <p style="color: #FFFFFF; font-size: 14px; margin: 0; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">Premium Streetwear</p>
                        </td>
                    </tr>
                    ${headerImage}
                    <!-- Main Content -->
                    <tr>
                        <td class="email-content" style="padding: 40px 30px; background-color: #FFFFFF; width: 100%; word-wrap: break-word;">
                            <h1 style="color: #000000; font-size: 32px; font-weight: 900; margin: 0 0 25px 0; line-height: 1.3; text-align: center; word-wrap: break-word; letter-spacing: -0.5px;">
                                ${heading}
                            </h1>
                            <div style="color: #333333; font-size: 16px; line-height: 1.8; margin-bottom: 35px; word-wrap: break-word; text-align: left;">
                                ${content.split('\n').map(p => p.trim() ? `<p style="margin: 0 0 18px 0; word-wrap: break-word; color: #444444; font-weight: 700;">${p}</p>` : '<br>').join('')}
                            </div>
                            ${slideshowSection}
                            ${productsSection}
                            ${ctaText && ctaLink ? `
                            <!-- CTA Button -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100% !important; max-width: 100% !important;">
                                <tr>
                                    <td align="center" style="padding: 20px 0; width: 100%;">
                                        <a href="${ctaLink}" style="display: inline-block; background-color: #000000; color: #FFFFFF; text-decoration: none; padding: 16px 40px; border-radius: 4px; font-weight: 700; font-size: 16px; letter-spacing: 0.5px; word-wrap: break-word;">
                                            ${ctaText}
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            ` : ''}
                        </td>
                    </tr>
                    <!-- Enhanced Footer -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); padding: 40px 30px; text-align: center; border-top: 3px solid #FFFFFF; width: 100%; word-wrap: break-word;">
                            <!-- Brand Section -->
                            <div style="margin-bottom: 30px; padding-bottom: 25px; border-bottom: 1px solid rgba(255,255,255,0.2);">
                                <p style="color: #FFFFFF; font-size: 20px; margin: 0 0 8px 0; font-weight: 900; letter-spacing: 2px; word-wrap: break-word;">
                                    ${BRAND_NAME}
                                </p>
                                <p style="color: #CCCCCC; font-size: 14px; margin: 0; font-weight: 400; word-wrap: break-word;">
                                    Premium Streetwear | Quality Craftsmanship | Authentic Style
                                </p>
                            </div>
                            
                            <!-- Social Media Links (Always included) -->
                            <div style="margin-bottom: 25px;">
                                <p style="color: #FFFFFF; font-size: 13px; margin: 0 0 15px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; word-wrap: break-word;">
                                    Connect With Us
                                </p>
                                <p style="color: #CCCCCC; font-size: 14px; margin: 0; word-wrap: break-word; line-height: 2;">
                                    <a href="${SOCIAL_MEDIA.instagram}" style="color: #FFFFFF; text-decoration: none; margin: 0 12px; word-wrap: break-word; font-size: 14px; font-weight: 500; border-bottom: 1px solid transparent; transition: border-color 0.3s;">Instagram</a>
                                    <span style="color: #666666; margin: 0 5px;">•</span>
                                    <a href="${SOCIAL_MEDIA.tiktok}" style="color: #FFFFFF; text-decoration: none; margin: 0 12px; word-wrap: break-word; font-size: 14px; font-weight: 500; border-bottom: 1px solid transparent;">TikTok</a>
                                    <span style="color: #666666; margin: 0 5px;">•</span>
                                    <a href="${SOCIAL_MEDIA.youtube}" style="color: #FFFFFF; text-decoration: none; margin: 0 12px; word-wrap: break-word; font-size: 14px; font-weight: 500; border-bottom: 1px solid transparent;">YouTube</a>
                                </p>
                            </div>
                            
                            <!-- Quick Links -->
                            <div style="margin-bottom: 25px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.2);">
                                <p style="color: #CCCCCC; font-size: 13px; margin: 0; word-wrap: break-word; line-height: 2;">
                                    <a href="${BRAND_WEBSITE}" style="color: #FFFFFF; text-decoration: none; margin: 0 10px; word-wrap: break-word; font-size: 13px; font-weight: 500;">Visit Website</a>
                                    <span style="color: #666666; margin: 0 5px;">•</span>
                                    <a href="mailto:contact@saintventura.co.za" style="color: #FFFFFF; text-decoration: none; margin: 0 10px; word-wrap: break-word; font-size: 13px; font-weight: 500;">Contact Us</a>
                                    <span style="color: #666666; margin: 0 5px;">•</span>
                                    <a href="${BRAND_WEBSITE}/shipping" style="color: #FFFFFF; text-decoration: none; margin: 0 10px; word-wrap: break-word; font-size: 13px; font-weight: 500;">Shipping Info</a>
                                </p>
                            </div>
                            
                            <!-- Unsubscribe -->
                            <p style="color: #999999; font-size: 11px; margin: 0; line-height: 1.6; word-wrap: break-word;">
                                ${type === 'abandoned-cart' && !isSubscribed 
                                  ? `You're receiving this email because you abandoned your cart.` 
                                  : `You're receiving this email because you subscribed to ${BRAND_NAME} newsletter.`}<br>
                                ${isSubscribed ? `<a href="${BRAND_WEBSITE}/unsubscribe.html?email={{EMAIL}}" style="color: #CCCCCC; text-decoration: underline; word-wrap: break-word; font-size: 11px;">Unsubscribe</a> | ` : ''}
                                <a href="${BRAND_WEBSITE}" style="color: #CCCCCC; text-decoration: underline; word-wrap: break-word; font-size: 11px;">${isSubscribed ? 'Update Preferences' : 'Visit Website'}</a>
                            </p>
                            
                            <!-- Copyright -->
                            <p style="color: #666666; font-size: 10px; margin: 20px 0 0 0; word-wrap: break-word;">
                                © ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
  `;
}

// Helper function to send emails via Resend API (preferred) or SMTP (fallback)
async function sendEmailViaResendOrSMTP(emailOptions) {
  const { from, to, subject, text, html, replyTo } = emailOptions;
  
  // Format from email with display name
  const getFromEmail = () => {
    const emailAddress = from || process.env.FROM_EMAIL || process.env.EMAIL_USER || 'contact@saintventura.co.za';
    // Format as "Saint Ventura <email@domain.com>"
    return `Saint Ventura <${emailAddress}>`;
  };
  
  // Prefer Resend if available (works on cloud hosting)
  if (resendClient) {
    try {
      const fromEmail = getFromEmail();
      const result = await resendClient.emails.send({
        from: fromEmail,
        to: to,
        subject: subject,
        text: text || '',
        html: html || text?.replace(/\n/g, '<br>') || '',
        reply_to: replyTo || (from || process.env.FROM_EMAIL || process.env.EMAIL_USER || 'contact@saintventura.co.za')
      });
      console.log(`✅ Email sent via Resend to: ${to}`);
      console.log(`   Resend Email ID: ${result.id || 'N/A'}`);
      console.log(`   From: ${fromEmail}`);
      console.log(`   Subject: ${subject}`);
      // Log full result in development
      if (process.env.NODE_ENV === 'development') {
        console.log('   Full Resend response:', JSON.stringify(result, null, 2));
      }
      return { success: true, method: 'resend', id: result.id };
    } catch (error) {
      console.error(`❌ Resend error sending to ${to}:`);
      console.error(`   Error message: ${error.message}`);
      console.error(`   Error name: ${error.name}`);
      if (error.response) {
        console.error(`   Response status: ${error.response.status}`);
        console.error(`   Response data:`, JSON.stringify(error.response.data || {}, null, 2));
      }
      if (error.stack) {
        console.error(`   Stack trace:`, error.stack);
      }
      // Fall back to SMTP if Resend fails
      if (emailTransporter) {
        console.log('⚠️ Falling back to SMTP...');
        return await sendEmailViaSMTP(emailOptions);
      }
      throw error;
    }
  }
  
  // Fallback to SMTP if Resend not available
  if (emailTransporter) {
    return await sendEmailViaSMTP(emailOptions);
  }
  
  throw new Error('No email service configured. Please set RESEND_API_KEY or EMAIL_HOST, EMAIL_USER, EMAIL_PASS');
}

// Helper function to send emails via SMTP (fallback)
async function sendEmailViaSMTP(emailOptions) {
  if (!emailTransporter) {
    throw new Error('Email transporter not configured');
  }
  
  // Format from email with display name for SMTP
  const emailAddress = emailOptions.from || process.env.FROM_EMAIL || process.env.EMAIL_USER || 'contact@saintventura.co.za';
  const formattedFrom = `Saint Ventura <${emailAddress}>`;
  
  // Create new email options with formatted from field
  const smtpEmailOptions = {
    ...emailOptions,
    from: formattedFrom
  };
  
  // Try port fallback if function exists
  if (typeof sendEmailWithPortFallback === 'function') {
    try {
      return await sendEmailWithPortFallback(smtpEmailOptions);
    } catch (error) {
      // If port fallback fails, try direct send
      console.warn('⚠️ Port fallback failed, trying direct SMTP send...');
    }
  }
  
  // Direct SMTP send
  await emailTransporter.sendMail(smtpEmailOptions);
  return { success: true, method: 'smtp', port: primaryPort };
}

// Function to fetch emails via IMAP
async function fetchEmailsFromIMAP() {
  return new Promise((resolve, reject) => {
    if (!process.env.IMAP_HOST || !process.env.IMAP_USER || !process.env.IMAP_PASS) {
      console.log('IMAP not configured - skipping email fetch');
      return resolve([]);
    }
    
    // Properly handle password with special characters
    const imapUser = String(process.env.IMAP_USER).trim();
    const imapPass = String(process.env.IMAP_PASS).trim().replace(/^["']|["']$/g, ''); // Remove surrounding quotes if present
    const imapHost = String(process.env.IMAP_HOST).trim();
    const imapPort = parseInt(process.env.IMAP_PORT || 993);
    
    console.log('Connecting to IMAP:', {
      host: imapHost,
      port: imapPort,
      user: imapUser,
      passLength: imapPass.length
    });
    
    const imap = new Imap({
      user: imapUser,
      password: imapPass,
      host: imapHost,
      port: imapPort,
      tls: true,
      tlsOptions: { 
        rejectUnauthorized: false,
        servername: imapHost
      },
      connTimeout: 10000,
      authTimeout: 5000
    });
    
    const emails = [];
    let connectionTimeout;
    
    // Set connection timeout
    connectionTimeout = setTimeout(() => {
      if (imap && imap.state !== 'authenticated') {
        imap.end();
        reject(new Error('IMAP connection timeout'));
      }
    }, 15000);
    
    imap.once('ready', () => {
      clearTimeout(connectionTimeout);
      console.log('IMAP connected successfully');
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          console.error('Error opening inbox:', err);
          imap.end();
          return reject(err);
        }
        
        console.log('IMAP inbox opened, fetching emails...');
        
        // Get total messages
        const totalMessages = box.messages.total;
        console.log(`Total messages in inbox: ${totalMessages}`);
        
        // Fetch ALL emails (or up to 1000 for very large inboxes)
        const fetchCount = Math.min(totalMessages, 1000);
        const fetchRange = totalMessages > 0 ? `1:${fetchCount}` : '1:1';
        
        console.log(`Fetching emails: ${fetchRange} (${fetchCount} emails)`);
        
        // Fetch emails
        const fetch = imap.seq.fetch(fetchRange, {
          bodies: '',
          struct: true
        });
        
        let messageCount = 0;
        
        let parsedCount = 0;
        const pendingEmails = [];
        
        fetch.on('message', (msg, seqno) => {
          messageCount++;
          const emailData = {
            seqno: seqno,
            parsed: false
          };
          pendingEmails.push(emailData);
          
          msg.on('body', (stream, info) => {
            simpleParser(stream, (err, parsed) => {
              if (err) {
                console.error(`Error parsing email ${seqno}:`, err);
                emailData.parsed = true;
                parsedCount++;
                // Remove from pending if parsing failed
                const index = pendingEmails.indexOf(emailData);
                if (index > -1) pendingEmails.splice(index, 1);
                checkComplete();
                return;
              }
              
              // Use HTML if available, otherwise use text
              const emailBody = parsed.html || parsed.textAsHtml || parsed.text || '';
              
              // Create a stable ID based on email content, not timestamp
              const emailId = `imap-${seqno}-${parsed.date ? new Date(parsed.date).getTime() : Date.now()}-${parsed.from?.value?.[0]?.address || 'unknown'}-${parsed.subject || 'nosubject'}`.replace(/[^a-zA-Z0-9-]/g, '-');
              
              const emailObj = {
                id: emailId,
                from: parsed.from?.text || parsed.from?.value?.[0]?.address || 'unknown',
                name: parsed.from?.value?.[0]?.name || '',
                subject: parsed.subject || '(No Subject)',
                body: emailBody,
                html: parsed.html || '',
                text: parsed.text || '',
                date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
                read: false,
                source: 'imap',
                attachments: parsed.attachments ? parsed.attachments.map(a => ({
                  filename: a.filename,
                  contentType: a.contentType,
                  size: a.size
                })) : []
              };
              
              emails.push(emailObj);
              emailData.parsed = true;
              parsedCount++;
              checkComplete();
            });
          });
        });
        
        function checkComplete() {
          // Wait for all messages to be parsed before resolving
          if (parsedCount === messageCount) {
            console.log(`Fetched ${messageCount} emails from IMAP, successfully parsed ${emails.length} emails`);
            imap.end();
            resolve(emails);
          }
        }
        
        fetch.once('end', () => {
          console.log(`IMAP fetch ended. Messages: ${messageCount}, Parsed: ${parsedCount}`);
          // If all messages were already parsed, resolve immediately
          if (parsedCount === messageCount) {
            console.log(`Fetched ${messageCount} emails from IMAP, successfully parsed ${emails.length} emails`);
          imap.end();
          resolve(emails);
          } else {
            // Wait a bit more for remaining messages to parse
            setTimeout(() => {
              console.log(`Final check - Messages: ${messageCount}, Parsed: ${parsedCount}, Emails collected: ${emails.length}`);
              imap.end();
              resolve(emails);
            }, 2000);
          }
        });
        
        fetch.once('error', (err) => {
          console.error('Error fetching emails:', err);
          imap.end();
          reject(err);
        });
      });
    });
    
    imap.once('error', (err) => {
      clearTimeout(connectionTimeout);
      console.error('IMAP connection error:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        source: err.source
      });
      reject(new Error(`IMAP connection failed: ${err.message}`));
    });
    
    imap.once('end', () => {
      clearTimeout(connectionTimeout);
      console.log('IMAP connection ended');
    });
    
    try {
      imap.connect();
    } catch (error) {
      clearTimeout(connectionTimeout);
      console.error('Error initiating IMAP connection:', error);
      reject(error);
    }
  });
}

// Admin authentication middleware
function adminAuth(req, res, next) {
  const password = req.headers['x-admin-password'] || req.body.password;
  console.log('Admin auth check - header present:', !!req.headers['x-admin-password']);
  if (password === ADMIN_PASSWORD) {
    next();
  } else {
    console.error('Admin auth failed - password mismatch');
    res.status(401).json({ success: false, error: 'Unauthorized' });
  }
}

// Helper functions for data management
async function readDataFile(fileKey) {
  try {
    const filePath = ADMIN_DATA_FILES[fileKey];
    // Ensure file exists before reading
    try {
      await fs.access(filePath);
    } catch {
      // File doesn't exist, create it with empty array
      await fs.writeFile(filePath, JSON.stringify([]));
      console.log(`✅ Created missing file: ${fileKey}.json`);
      return [];
    }
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${fileKey}:`, error);
    // If read fails, try to create the file
    try {
      const filePath = ADMIN_DATA_FILES[fileKey];
      await fs.writeFile(filePath, JSON.stringify([]));
      console.log(`✅ Created ${fileKey}.json after read error`);
    } catch (writeError) {
      console.error(`Error creating ${fileKey}.json:`, writeError);
    }
    return [];
  }
}

async function writeDataFile(fileKey, data) {
  try {
    const filePath = ADMIN_DATA_FILES[fileKey];
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing ${fileKey}:`, error);
    return false;
  }
}

// Product data (from checkout.html) - Full details with images
const PRODUCTS = [
  { id: 1, name: "The Saints Club Tee", price: 550, category: "tops", sizes: ["XS", "S", "M", "L", "XL", "XXL"], colors: ["White"], images: ["https://dl.dropboxusercontent.com/scl/fi/j0pgw2egryb9f0470f3p3/1-2.png?rlkey=xaw4k5w0yhwswfae3pi1n0g2r&st=vnlwftci&dl=1"], availableColors: [{ name: "White", image: "https://dl.dropboxusercontent.com/scl/fi/j0pgw2egryb9f0470f3p3/1-2.png?rlkey=xaw4k5w0yhwswfae3pi1n0g2r&st=vnlwftci&dl=1" }] },
  { id: 2, name: "SV Till I R.I.P Tee", price: 500, category: "tops", sizes: ["XS", "S", "M", "L", "XL", "XXL"], colors: ["Black"], images: ["https://dl.dropboxusercontent.com/scl/fi/6ribhwbytdqfqva6jgf3s/1-16.png?rlkey=s61uev3dxmsmo4coifrqtozge&st=z3y4nuri&dl=1"], availableColors: [{ name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/6ribhwbytdqfqva6jgf3s/1-16.png?rlkey=s61uev3dxmsmo4coifrqtozge&st=z3y4nuri&dl=1" }] },
  { id: 3, name: "Visionaries by SV", price: 200, category: "accessories", sizes: ["One Size Fits All"], colors: ["Black"], images: ["https://dl.dropboxusercontent.com/scl/fi/qs6id9xzrvfp8dctj2lqf/1-15.png?rlkey=shaa8t54va6ap95kulvvk1jee&st=tpwythhm&dl=1"], availableColors: [{ name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/qs6id9xzrvfp8dctj2lqf/1-15.png?rlkey=shaa8t54va6ap95kulvvk1jee&st=tpwythhm&dl=1" }] },
  { id: 4, name: "SV Creators Hat", price: 200, category: "accessories", sizes: ["One Size Fits All"], colors: ["Red", "Black"], images: ["https://dl.dropboxusercontent.com/scl/fi/16j1629tb9ces8c4vruvh/1-4.png?rlkey=myve0lk7x9zdn6xfen7mah640&st=d0j0b6nb&dl=1"], availableColors: [{ name: "Red", image: "https://dl.dropboxusercontent.com/scl/fi/16j1629tb9ces8c4vruvh/1-4.png?rlkey=myve0lk7x9zdn6xfen7mah640&st=d0j0b6nb&dl=1" }, { name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/5h9lftt1bidmqijpmpxll/1-3.png?rlkey=501zjd9pkgf9w5yhrparmm5rd&st=uhhf8qul&dl=1" }] },
  { id: 5, name: "Hood* of The Saints", price: 400, category: "tops", sizes: ["XS", "S", "M", "L", "XL", "XXL"], colors: ["Baby Blue", "Black"], images: ["https://dl.dropboxusercontent.com/scl/fi/tv6xmtknl5e93s4q2rxvr/1-7.png?rlkey=6y8szp285r72rby6k6jkw8038&st=n6gbin36&dl=1"], availableColors: [{ name: "Baby Blue", image: "https://dl.dropboxusercontent.com/scl/fi/tv6xmtknl5e93s4q2rxvr/1-7.png?rlkey=6y8szp285r72rby6k6jkw8038&st=n6gbin36&dl=1" }, { name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/mtvek2orgliosk1e5w0zg/1-5.png?rlkey=akio0f1ps0tumeghs50q10blr&st=ktcib4de&dl=1" }] },
  { id: 6, name: "SV Utility Shirt", price: 400, category: "tops", sizes: ["XS", "S", "M", "L", "XL", "XXL"], colors: ["Black"], images: ["https://dl.dropboxusercontent.com/scl/fi/tg8jpo7hxksb5fmiyivo7/1-9.png?rlkey=wlaat82bhy29xpcyuyme0b1mi&st=p7wbg6k7&dl=1"], availableColors: [{ name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/tg8jpo7hxksb5fmiyivo7/1-9.png?rlkey=wlaat82bhy29xpcyuyme0b1mi&st=p7wbg6k7&dl=1" }] },
  { id: 7, name: "SV Cargo Pants", price: 300, category: "bottoms", sizes: ["XS", "S", "M", "L", "XL", "XXL"], colors: ["Black"], images: ["https://dl.dropboxusercontent.com/scl/fi/q82xmvf10v3bfth0yb9tb/1-17.png?rlkey=86y3k3tbqdqgs63h2gzs86d81&st=brqjs51u&dl=1"], availableColors: [{ name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/q82xmvf10v3bfth0yb9tb/1-17.png?rlkey=86y3k3tbqdqgs63h2gzs86d81&st=brqjs51u&dl=1" }] },
  { id: 8, name: "Ventura Crop Tank", price: 300, category: "tops", sizes: ["XS", "S", "M", "L", "XL", "XXL"], colors: ["Black", "Army Green", "White"], images: ["https://dl.dropboxusercontent.com/scl/fi/j22zx7qt5efevtqmbki5a/1-10.png?rlkey=w1m9xosbjx5jiihn45l1o7hj7&st=9whfbavz&dl=1"], availableColors: [{ name: "Army Green", image: "https://dl.dropboxusercontent.com/scl/fi/j22zx7qt5efevtqmbki5a/1-10.png?rlkey=w1m9xosbjx5jiihn45l1o7hj7&st=9whfbavz&dl=1" }, { name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/mud785w0gso758kjl8d0y/1-6.PNG?rlkey=wj0x9hpnflobqndsak1drzpxt&st=bvmxst4j&dl=1" }, { name: "White", image: "https://dl.dropboxusercontent.com/scl/fi/0izhvhpqgv7ym8o53dfk6/3-1.PNG?rlkey=34wr7bf7w9qr4aqcx8em9puv7&st=5xbyxbt1&dl=1" }] },
  { id: 9, name: "Essential Beanie", price: 200, category: "accessories", sizes: ["One Size Fits All"], colors: ["Black"], images: ["https://dl.dropboxusercontent.com/scl/fi/sw3imbzsqend0zigd3yww/1-13.png?rlkey=iolsj7x1ryqxxh2t4okvw46zp&st=nryoy8dl&dl=1"], availableColors: [{ name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/sw3imbzsqend0zigd3yww/1-13.png?rlkey=iolsj7x1ryqxxh2t4okvw46zp&st=nryoy8dl&dl=1" }] },
  { id: 10, name: "Onyx Bracelet By SV", price: 60, category: "accessories", sizes: ["13cm", "14cm", "15cm", "16cm", "17cm", "18cm"], colors: ["Black"], images: ["https://dl.dropboxusercontent.com/scl/fi/xevb4s1aeggk0fjcwk85e/1-18.png?rlkey=vs9rk6nu79b5nwtdxme114crx&st=6fn852el&dl=1"], availableColors: [{ name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/xevb4s1aeggk0fjcwk85e/1-18.png?rlkey=vs9rk6nu79b5nwtdxme114crx&st=6fn852el&dl=1" }] }
];

// Initialize inventory from products
async function initializeInventory() {
  const inventory = await readDataFile('inventory');
  if (inventory.length === 0) {
    const newInventory = [];
    PRODUCTS.forEach(product => {
      if (product.sizes.length === 1 && product.sizes[0] === "One Size Fits All") {
        product.colors.forEach(color => {
          const colorInfo = product.availableColors?.find(c => c.name === color);
          newInventory.push({
            id: `${product.id}-${color}`,
            productId: product.id,
            variantId: color,
            name: product.name,
            variant: color,
            stock: 0 // Start with 0 stock
          });
        });
      } else {
        product.sizes.forEach(size => {
          product.colors.forEach(color => {
            newInventory.push({
              id: `${product.id}-${size}-${color}`,
              productId: product.id,
              variantId: `${size}-${color}`,
              name: product.name,
              variant: `${size} / ${color}`,
              stock: 0 // Start with 0 stock
            });
          });
        });
      }
    });
    await writeDataFile('inventory', newInventory);
  }
}

// Initialize data directory and inventory on startup
(async () => {
  try {
    await ensureDataDir();
    await initializeInventory();
    console.log('✅ Inventory initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing data:', error);
  }
})();

// ============================================
// ADMIN API ROUTES
// ============================================

// Badges endpoint
app.get('/api/admin/badges', async (req, res) => {
  try {
    const inbox = await readDataFile('inbox');
    const carts = await readDataFile('abandonedCarts');
    const notifications = await readDataFile('notifications');
    
    const unreadInbox = inbox.filter(e => !e.read).length;
    const recentCarts = carts.filter(c => {
      const cartDate = new Date(c.date);
      const daysAgo = (Date.now() - cartDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo <= 7; // Carts from last 7 days
    }).length;
    const unreadNotifications = notifications.filter(n => !n.read).length;
    
    res.json({ inbox: unreadInbox, carts: recentCarts, notifications: unreadNotifications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Inventory routes - Returns inventory with product details
app.get('/api/admin/inventory', adminAuth, async (req, res) => {
  try {
    const inventory = await readDataFile('inventory');
    // Enrich inventory with product details
    const enrichedInventory = inventory.map(item => {
      const product = PRODUCTS.find(p => p.id == item.productId);
      if (product) {
        // Find the color variant image
        let variantImage = product.images[0];
        if (item.variantId && product.availableColors) {
          const colorMatch = product.availableColors.find(c => 
            item.variantId.includes(c.name) || item.variantId === c.name
          );
          if (colorMatch) variantImage = colorMatch.image;
        }
        return {
          ...item,
          productName: product.name,
          price: product.price,
          category: product.category,
          image: variantImage,
          sizes: product.sizes,
          colors: product.colors
        };
      }
      return item;
    });
    res.json(enrichedInventory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/inventory/update', adminAuth, async (req, res) => {
  try {
    const { productId, variantId, stock, costPerUnit } = req.body;
    const inventory = await readDataFile('inventory');
    const item = inventory.find(i => 
      i.productId == productId && (variantId ? i.variantId === variantId : !i.variantId)
    );
    if (item) {
      const oldStock = item.stock || 0;
      const newStock = parseInt(stock);
      const stockChange = newStock - oldStock;
      
      // Initialize stock cost if not exists
      if (!item.stockCost) item.stockCost = 0;
      if (!item.costPerUnit) item.costPerUnit = 0;
      
      // If stock is being added and cost per unit is provided
      if (stockChange > 0 && costPerUnit !== undefined && costPerUnit !== null && costPerUnit !== '') {
        const costPerUnitNum = parseFloat(costPerUnit);
        if (!isNaN(costPerUnitNum) && costPerUnitNum >= 0) {
          // Add new stock cost
          const newStockCost = stockChange * costPerUnitNum;
          item.stockCost = (item.stockCost || 0) + newStockCost;
          // Recalculate average cost per unit
          if (newStock > 0) {
            item.costPerUnit = item.stockCost / newStock;
          }
        }
      } else if (stockChange < 0) {
        // Stock is being reduced - reduce stock cost proportionally
        if (oldStock > 0 && item.stockCost > 0) {
          const costPerUnit = item.stockCost / oldStock;
          const reducedCost = Math.abs(stockChange) * costPerUnit;
          item.stockCost = Math.max(0, item.stockCost - reducedCost);
          if (newStock > 0) {
            item.costPerUnit = item.stockCost / newStock;
          } else {
            item.costPerUnit = 0;
          }
        }
      }
      
      item.stock = newStock;
      item.updatedAt = new Date().toISOString();
      await writeDataFile('inventory', inventory);
      
      // Check if any "no stock" orders can now be fulfilled
      await checkAndFulfillNoStockOrders(inventory);
      
      res.json({ success: true, item });
    } else {
      res.status(404).json({ success: false, error: 'Item not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Function to check "no stock" orders and update to fulfilled if items are now in stock
async function checkAndFulfillNoStockOrders(inventory) {
  try {
    const orders = await readDataFile('orders');
    const noStockOrders = orders.filter(o => o.status === 'no stock');
    
    for (const order of noStockOrders) {
      const orderItems = order.items || [];
      let allItemsInStock = true;
      
      // Check if all items in the order are now in stock
      for (const item of orderItems) {
        const inventoryItem = inventory.find(inv => {
          const productMatch = inv.productId === item.id || 
                              inv.productId === parseInt(item.id) ||
                              inv.productName === item.name;
          
          if (!productMatch) return false;
          
          // Match by variant if size/color provided
          if (item.size || item.color) {
            const variantMatch = (!item.size || inv.variant?.includes(item.size)) &&
                                (!item.color || inv.variant?.includes(item.color));
            return variantMatch;
          }
          
          return true; // If no size/color specified, match any variant of the product
        });
        
        if (!inventoryItem || (inventoryItem.stock || 0) < (item.quantity || 1)) {
          allItemsInStock = false;
          break;
        }
      }
      
      // If all items are in stock, update order to fulfilled
      if (allItemsInStock) {
        order.status = 'fulfilled';
        order.updatedAt = new Date().toISOString();
        
        // Reduce stock for all items in the order
        for (const item of orderItems) {
          const inventoryItem = inventory.find(inv => {
            const productMatch = inv.productId === item.id || 
                                inv.productId === parseInt(item.id) ||
                                inv.productName === item.name;
            
            if (!productMatch) return false;
            
            // Match by variant if size/color provided
            if (item.size || item.color) {
              const variantMatch = (!item.size || inv.variant?.includes(item.size)) &&
                                  (!item.color || inv.variant?.includes(item.color));
              return variantMatch;
            }
            
            return true;
          });
          
          if (inventoryItem) {
            const quantityToReduce = item.quantity || 1;
            const currentStock = inventoryItem.stock || 0;
            const newStock = Math.max(0, currentStock - quantityToReduce);
            
            // Reduce stock cost by (cost per unit × quantity) but keep cost per unit consistent
            if (inventoryItem.costPerUnit && inventoryItem.costPerUnit > 0) {
              const costToReduce = inventoryItem.costPerUnit * quantityToReduce;
              inventoryItem.stockCost = Math.max(0, (inventoryItem.stockCost || 0) - costToReduce);
            }
            
            inventoryItem.stock = newStock;
            inventoryItem.updatedAt = new Date().toISOString();
            console.log(`✅ Reduced stock for ${inventoryItem.productName} (${inventoryItem.variant || 'default'}): ${currentStock} -> ${newStock}`);
          }
        }
        
        await writeDataFile('inventory', inventory);
        await writeDataFile('orders', orders);
        
        console.log(`✅ Updated order ${order.id} from "no stock" to "fulfilled" - all items are now in stock`);
        
        // Send email to customer
        if (order.customerEmail) {
          try {
            const orderDate = new Date(order.date).toLocaleDateString('en-ZA', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            
            // Format delivery information
            let deliveryInfo = '';
            if (order.shippingMethod === 'door' && order.deliveryDetails) {
              const details = order.deliveryDetails;
              deliveryInfo = `Delivery Address:\n${details.street || ''}\n${details.suburb ? details.suburb + '\n' : ''}${details.city || ''}, ${details.province || ''}\n${details.postalCode || ''}${details.extra ? '\n' + details.extra : ''}`;
            } else if (order.shippingMethod === 'uj' && order.deliveryDetails) {
              deliveryInfo = `Delivery Location: UJ ${order.deliveryDetails.campus || 'Campus'} Campus`;
            }
            
            const orderDetailsText = `Order ${order.id ? `ID: ${order.id}` : 'Details'}: ${orderDate}\n\nOrder Items:\n${orderItems.map(item => {
              const size = item.size ? `, Size: ${item.size}` : '';
              const color = item.color ? `, Color: ${item.color}` : '';
              return `- ${item.name}${size}${color} (Qty: ${item.quantity || 1}) - R${((item.price || 0) * (item.quantity || 1)).toFixed(2)}`;
            }).join('\n')}\n\nOrder Summary:\nSubtotal: R${(order.subtotal || 0).toFixed(2)}\nShipping: R${(order.shipping || 0).toFixed(2)}\nTotal: R${(order.total || 0).toFixed(2)}\n\nDelivery Method: ${order.shippingMethod === 'door' ? 'Door-to-Door Courier' : order.shippingMethod === 'uj' ? 'UJ Campus Delivery' : 'Testing Delivery'}\n${deliveryInfo ? deliveryInfo + '\n' : ''}`;
            
            // Map order items to products for email template
            const orderProducts = orderItems.map(item => {
              const product = PRODUCTS.find(p => 
                p.id === item.id || 
                p.id === parseInt(item.id) ||
                p.name === item.name
              );
              
              let imageUrl = item.image || item.imageUrl || null;
              if (!imageUrl && product) {
                if (item.color && product.availableColors) {
                  const colorMatch = product.availableColors.find(c => 
                    c.name.toLowerCase() === item.color.toLowerCase()
                  );
                  if (colorMatch && colorMatch.image) {
                    imageUrl = colorMatch.image.trim();
                  }
                }
                if (!imageUrl && product.images && product.images.length > 0) {
                  imageUrl = product.images[0].trim();
                }
              }
              
              if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
                imageUrl = null;
              }
              
              const size = item.size ? `Size: ${item.size}` : '';
              const color = item.color ? `${item.size ? ', ' : ''}Color: ${item.color}` : '';
              const description = [size, color].filter(d => d).join(', ').trim();
              
              return {
                name: item.name,
                price: (item.price || 0) * (item.quantity || 1),
                description: description || '',
                image: imageUrl
              };
            });
            
            const emailContent = `Dear ${order.customerName},\n\nGreat news! Your order is now being fulfilled and will come soon! We've restocked the items you ordered and are working diligently to prepare your package with the utmost care and attention to detail.\n\n${orderDetailsText}\n\nYour order is now being prepared with the utmost care and attention to detail. Our team is working diligently to ensure that every item meets our exacting quality standards before it's carefully packaged and shipped to you.\n\nWe understand how exciting it is to receive your new pieces, and we're committed to getting them to you as quickly as possible. We'll keep you updated every step of the way!\n\nIf you have any questions about your order, shipping, or anything else, please don't hesitate to reach out to us. We're here to help and ensure you have an exceptional experience with Saint Ventura.\n\nThank you again for your purchase. We can't wait for you to experience the quality and style that defines Saint Ventura!`;
            
            const customerOrderEmailHtml = generateEmailTemplate('order-confirmation', {
              heading: `Order Update - Your Order is Being Fulfilled!`,
              content: emailContent,
              products: orderProducts,
              includeSocialMedia: true,
              isSubscribed: true
            });
            
            const customerOrderEmailText = `Order Update - Your Order is Being Fulfilled!\n\nDear ${order.customerName},\n\nGreat news! Your order is now being fulfilled and will come soon! We've restocked the items you ordered.\n\n${orderDetailsText}\n\nThank you for choosing Saint Ventura!`;
            
            await sendEmailViaResendOrSMTP({
              from: process.env.EMAIL_USER || process.env.FROM_EMAIL || 'contact@saintventura.co.za',
              to: order.customerEmail,
              subject: 'Order Update - Your Order is Being Fulfilled!',
              text: customerOrderEmailText,
              html: customerOrderEmailHtml
            });
            
            console.log(`✅ Sent fulfillment email to ${order.customerEmail} for order ${order.id}`);
          } catch (emailError) {
            console.error(`⚠️ Failed to send fulfillment email to ${order.customerEmail}:`, emailError.message);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error checking and fulfilling no stock orders:', error);
  }
}

// Inbox routes
app.get('/api/admin/inbox', adminAuth, async (req, res) => {
  try {
    const inbox = await readDataFile('inbox');
    res.json(inbox.sort((a, b) => new Date(b.date) - new Date(a.date)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/inbox/read', adminAuth, async (req, res) => {
  try {
    const { emailId } = req.body;
    const inbox = await readDataFile('inbox');
    const email = inbox.find(e => e.id === emailId);
    if (email) {
      email.read = true;
      await writeDataFile('inbox', inbox);
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Email not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual email entry endpoint (for emails sent TO contact@saintventura.co.za)
app.post('/api/admin/inbox/add', adminAuth, async (req, res) => {
  try {
    const { from, name, subject, body, phone } = req.body;
    
    if (!from || !subject || !body) {
      return res.status(400).json({ 
        success: false,
        error: 'From, subject, and body are required' 
      });
    }
    
    const inbox = await readDataFile('inbox');
    inbox.push({
      id: Date.now().toString(),
      from: from,
      name: name || '',
      phone: phone || '',
      subject: subject,
      body: body,
      date: new Date().toISOString(),
      read: false
    });
    await writeDataFile('inbox', inbox);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fetch emails from IMAP manually
app.post('/api/admin/inbox/fetch', adminAuth, async (req, res) => {
  try {
    if (!process.env.IMAP_HOST || !process.env.IMAP_USER || !process.env.IMAP_PASS) {
      return res.status(400).json({ 
        success: false, 
        error: 'IMAP not configured. Please set IMAP_HOST, IMAP_USER, and IMAP_PASS in .env file' 
      });
    }
    
    const imapEmails = await fetchEmailsFromIMAP();
    const inbox = await readDataFile('inbox');
    let newEmails = 0;
    
    if (imapEmails && imapEmails.length > 0) {
      // Sort by date (newest first) to process latest emails first
      imapEmails.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      for (const imapEmail of imapEmails) {
        // Better duplicate detection - check by unique ID first
        const existsById = inbox.find(e => e.id === imapEmail.id);
        if (existsById) {
          console.log(`Skipping duplicate email by ID: ${imapEmail.id}`);
          continue; // Skip if exact ID match
        }
        
        // Check for duplicates by content (within 1 hour window for same sender/subject)
        const exists = inbox.find(e => {
          const timeDiff = Math.abs(new Date(e.date) - new Date(imapEmail.date));
          const sameFrom = (e.from || '').toLowerCase() === (imapEmail.from || '').toLowerCase();
          const sameSubject = (e.subject || '').toLowerCase() === (imapEmail.subject || '').toLowerCase();
          return sameFrom && sameSubject && timeDiff < 3600000; // 1 hour
        });
        
        if (!exists) {
          console.log(`Adding new email: ${imapEmail.subject} from ${imapEmail.from}`);
          inbox.push(imapEmail);
          newEmails++;
        } else {
          console.log(`Skipping duplicate email by content: ${imapEmail.subject} from ${imapEmail.from}`);
        }
      }
      
      // Sort inbox by date (newest first)
      inbox.sort((a, b) => new Date(b.date) - new Date(a.date));
      await writeDataFile('inbox', inbox);
    }
    
    console.log(`Fetched ${imapEmails ? imapEmails.length : 0} emails from IMAP`);
    console.log(`Current inbox has ${inbox.length} emails`);
    console.log(`Added ${newEmails} new emails. Total inbox: ${inbox.length}`);
    
    res.json({ success: true, fetched: imapEmails ? imapEmails.length : 0, new: newEmails, total: inbox.length });
  } catch (error) {
    console.error('Error fetching emails from IMAP:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch emails. Check IMAP settings and password.' 
    });
  }
});

// Send email (compose)
app.post('/api/admin/inbox/send', adminAuth, async (req, res) => {
  try {
    const { to, subject, body, replyTo } = req.body;
    
    if (!to || !subject || !body) {
      return res.status(400).json({ 
        success: false,
        error: 'To, subject, and body are required' 
      });
    }
    
    if (!resendClient && !emailTransporter) {
      return res.status(500).json({ 
        success: false,
        error: 'Email service not configured. Please set RESEND_API_KEY or EMAIL_HOST, EMAIL_USER, EMAIL_PASS' 
      });
    }
    
    // Check if this is a customer support response (replyTo indicates it's a reply)
    const isCustomerSupport = replyTo && replyTo.includes('@');
    
    // Use HTML if provided, otherwise generate professional template
    let emailHtml = req.body.html;
    if (!emailHtml) {
      if (isCustomerSupport) {
        // Use customer support template
        emailHtml = generateEmailTemplate('customer-support', {
          heading: 'Thank You for Contacting Us',
          content: body,
          supportResponse: body,
          ctaText: 'Visit Our Website',
          ctaLink: BRAND_WEBSITE,
          includeSocialMedia: true // Always include footer
        });
      } else {
        // Regular email - simple HTML conversion
        emailHtml = body.replace(/\n/g, '<br>');
      }
    }
    
    // Strip HTML tags for plain text version
    const emailText = body.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() || body;
    
    // Parse multiple recipients (comma-separated)
    const recipients = to.split(',').map(r => r.trim()).filter(r => r);
    
    let sentCount = 0;
    let errors = [];
    
    // Send to each recipient with retry logic
    for (const recipient of recipients) {
      let retries = 3;
      let lastError = null;
      
      while (retries > 0) {
        try {
          console.log(`📧 Attempting to send email to ${recipient} (attempt ${3 - retries + 1}/3)...`);
          
          // Send email via Resend (preferred) or SMTP (fallback)
          const result = await sendEmailViaResendOrSMTP({
      from: process.env.EMAIL_USER || process.env.FROM_EMAIL || 'contact@saintventura.co.za',
            to: recipient,
      replyTo: replyTo || process.env.EMAIL_USER,
      subject: subject,
      text: emailText,
      html: emailHtml
    });
    
          sentCount++;
          console.log(`✅ Email sent to: ${recipient} via ${result.method}${result.port ? ` (port ${result.port})` : ''}`);
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error;
          retries--;
          const attemptNum = 3 - retries;
          
          // Log more detailed error information
          console.error(`❌ Error sending to ${recipient} (${attemptNum}/3 attempts):`, error.message);
          if (error.code) console.error(`   Error code: ${error.code}`);
          if (error.command) console.error(`   Command: ${error.command}`);
          if (error.responseCode) console.error(`   Response code: ${error.responseCode}`);
          
          if (retries > 0) {
            // Wait before retry (exponential backoff)
            const delay = attemptNum * 2000; // 2s, 4s delays
            console.log(`   Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            // All retries failed
            console.error(`❌ Failed to send to ${recipient} after 3 attempts. Last error: ${lastError.message}`);
            if (lastError.code) console.error(`   Last error code: ${lastError.code}`);
            errors.push(recipient);
          }
        }
      }
    }
    
    if (sentCount === 0) {
      return res.status(500).json({ 
        success: false,
        error: `Failed to send emails. Errors: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}` 
      });
    }
    
    // Store sent email in inbox (one entry for all recipients)
    const inbox = await readDataFile('inbox');
    inbox.push({
      id: Date.now().toString(),
      from: process.env.EMAIL_USER || process.env.FROM_EMAIL || 'contact@saintventura.co.za',
      name: 'You',
      to: to,
      subject: `Sent: ${subject}`,
      body: body,
      date: new Date().toISOString(),
      read: true,
      sent: true
    });
    await writeDataFile('inbox', inbox);
    
    res.json({ success: true, sent: sentCount, total: recipients.length, errors: errors.length });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete email (using POST instead of DELETE for better compatibility)
app.post('/api/admin/inbox/delete', adminAuth, async (req, res) => {
  try {
    const { emailId } = req.body;
    
    if (!emailId) {
      return res.status(400).json({ success: false, error: 'Email ID is required' });
    }
    
    const inbox = await readDataFile('inbox');
    const filtered = inbox.filter(e => e.id !== emailId);
    
    if (filtered.length === inbox.length) {
      return res.status(404).json({ success: false, error: 'Email not found' });
    }
    
    await writeDataFile('inbox', filtered);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Store contact form emails in inbox
app.post('/api/contact-form', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        success: false,
        error: 'Name, email, subject, and message are required' 
      });
    }

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ 
        success: false,
        error: 'Valid email address is required' 
      });
    }

    // Store in inbox
    const inbox = await readDataFile('inbox');
    inbox.push({
      id: Date.now().toString(),
      from: email,
      name: name,
      phone: phone || '',
      subject: subject,
      body: message,
      date: new Date().toISOString(),
      read: false
    });
    await writeDataFile('inbox', inbox);

    // Create notification
    const notifications = await readDataFile('notifications');
    notifications.push({
      id: Date.now().toString(),
      type: 'contact',
      title: 'New Contact Form Submission',
      message: `${name} (${email}): ${subject}`,
      date: new Date().toISOString(),
      read: false
    });
    await writeDataFile('notifications', notifications);

    // Send Telegram message to support
    const telegramMessage = `📧 *New Contact Form Submission*\n\n*Name:* ${name}\n*Email:* ${email}\n*Phone:* ${phone || 'Not provided'}\n*Subject:* ${subject}\n\n*Message:*\n${message}`;
    
    sendWhatsApp({
      message: telegramMessage,
      to: TELEGRAM_CHAT_ID
    }).then(result => {
      if (result.success) {
        console.log(`✅ Contact form Telegram message SENT successfully to chat ID ${TELEGRAM_CHAT_ID}`);
      }
    }).catch(error => {
      console.error(`❌ FAILED to send contact form Telegram message`);
    });
    
    // Return success immediately
    res.json({ 
      success: true, 
      message: 'Contact form submitted successfully' 
    });

  } catch (error) {
    console.error('Error sending contact form email:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Subscribers routes
app.get('/api/admin/subscribers', adminAuth, async (req, res) => {
  try {
    const subscribers = await readDataFile('subscribers');
    res.json(subscribers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Store newsletter subscriptions
app.post('/api/newsletter-subscribe', async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ 
        success: false,
        error: 'Valid email address is required' 
      });
    }

    // Store subscriber
    const subscribers = await readDataFile('subscribers');
    if (!subscribers.find(s => s.email === email)) {
      subscribers.push({
        id: Date.now().toString(),
        email: email,
        date: new Date().toISOString()
      });
      await writeDataFile('subscribers', subscribers);

    }

    // Send Telegram message to support (this will also create a notification via sendWhatsApp)
    const telegramMessage = `📬 *New Newsletter Subscription*\n\nEmail: ${email}\n\nTime: ${new Date().toLocaleString('en-ZA')}`;
    
    sendWhatsApp({
      message: telegramMessage,
      to: TELEGRAM_CHAT_ID
    }).then(result => {
      if (result.success) {
        console.log(`✅ Newsletter subscription Telegram message SENT successfully`);
      }
    }).catch(error => {
      console.error(`❌ FAILED to send newsletter Telegram message`);
    });
    
    // Return success immediately
    res.json({ 
      success: true, 
      message: 'Subscription request sent successfully' 
    });

  } catch (error) {
    console.error('Error sending newsletter subscription email:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Broadcast routes
app.get('/api/admin/products', adminAuth, async (req, res) => {
  try {
    res.json(PRODUCTS);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/broadcast', adminAuth, async (req, res) => {
  try {
    const { template, subject, message, products, html, recipients } = req.body;
    
    // Validate required fields
    if (!subject || (!message && !html)) {
      return res.status(400).json({ success: false, error: 'Subject and message are required' });
    }
    
    let targetSubscribers = await readDataFile('subscribers');
    
    // If recipients are provided, use those instead of all subscribers
    if (recipients && recipients.trim()) {
      const recipientEmails = recipients.split(',').map(r => r.trim()).filter(r => r);
      targetSubscribers = targetSubscribers.filter(s => recipientEmails.includes(s.email));
    }
    
    if (targetSubscribers.length === 0) {
      return res.json({ success: false, error: 'No subscribers found' });
    }

    // Build email content based on template
    let emailSubject = subject || 'Saint Ventura Update';
    let emailBody = message || '';
    let emailHtml = html;
    
    // If HTML not provided, generate professional template
    if (!emailHtml) {
      // Use new-subscriber template style for all broadcast emails
      let templateType = 'new-subscriber';
      let templateProducts = [];
      
      // Set default subject based on template if not provided
      if (template === 'promotion') {
        emailSubject = emailSubject || 'Special Promotion - Limited Time Offer!';
      } else if (template === 'new-product') {
        emailSubject = emailSubject || 'New Product Launch!';
      } else if (template === 'news') {
        emailSubject = emailSubject || 'Latest News & Updates';
      } else {
        emailSubject = emailSubject || 'Saint Ventura Update';
      }
      
      // Get product images if products selected
      if (products && products.length > 0) {
      const selectedProducts = PRODUCTS.filter(p => products.includes(p.id.toString()) || products.includes(String(p.id)));
        templateProducts = selectedProducts.map(p => {
          let imageUrl = null;
          if (p.images && p.images.length > 0 && p.images[0]) {
            imageUrl = p.images[0].trim();
            // Validate URL format
            if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
              imageUrl = null;
            }
          }
          return {
            name: p.name || '',
            price: p.price || 0,
            description: p.description || '',
            image: imageUrl
          };
        });
      }
      
      // Generate product grid HTML if products provided
      let productGridHtml = '';
      if (templateProducts.length > 0) {
        productGridHtml = generateProductGrid(templateProducts);
      }
      
      // Use new template system with Handlebars
      emailHtml = generateEmailTemplate('broadcast', {
        title: emailSubject,
        subtitle: req.body.subtitle || '',
        message: formatMessageContent(message),
        ctaText: req.body.ctaText || 'Shop Now',
        ctaLink: req.body.ctaLink || BRAND_WEBSITE,
        bannerImage: req.body.bannerImage || '',
        productGrid: productGridHtml,
        products: templateProducts, // Keep for backward compatibility
        includeSlideshow: true,
        includeSocialMedia: true,
        isSubscribed: true
      });
      
      // Replace {{EMAIL}} placeholder in unsubscribe link (will be replaced per subscriber)
      
      // Generate plain text version
      emailBody = message;
      if (templateProducts.length > 0) {
        const productList = templateProducts.map(p => `- ${p.name}: R${p.price.toFixed(2)}`).join('\n');
        emailBody = `${message}\n\nCheck out our products:\n${productList}`;
      }
    } else {
      // HTML provided, generate plain text from it
      emailBody = message || emailHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    }

    let sent = 0;
    let errors = [];
    
    if (!resendClient && !emailTransporter) {
      return res.status(500).json({ 
        success: false, 
        error: 'Email service not configured. Please set RESEND_API_KEY or EMAIL_HOST, EMAIL_USER, EMAIL_PASS in .env file' 
      });
    }
    
    for (const subscriber of targetSubscribers) {
      let retries = 3;
      let success = false;
      
      while (retries > 0 && !success) {
        try {
          // Replace {{EMAIL}} placeholder in unsubscribe link with actual subscriber email
          // Also replace any other email placeholders in the template
          let personalizedHtml = emailHtml.replace(/\{\{EMAIL\}\}/g, encodeURIComponent(subscriber.email));
          
          // If using Handlebars template, render with subscriber email
          if (emailTemplates['broadcast'] && !personalizedHtml.includes('{{EMAIL}}')) {
            // Template already rendered, just replace email in unsubscribe link
            personalizedHtml = personalizedHtml.replace(/email=([^"&]+)/g, `email=${encodeURIComponent(subscriber.email)}`);
          }
          
          // Send email via Resend (preferred) or SMTP (fallback)
          const result = await sendEmailViaResendOrSMTP({
            from: process.env.EMAIL_USER || process.env.FROM_EMAIL || 'contact@saintventura.co.za',
            to: subscriber.email,
            subject: emailSubject,
            text: emailBody,
            html: personalizedHtml
          });
          
          sent++;
          success = true;
          console.log(`✅ Email sent to subscriber: ${subscriber.email} via ${result.method}${result.port ? ` (port ${result.port})` : ''}`);
        } catch (error) {
          retries--;
          const attemptNum = 3 - retries;
          console.error(`❌ Error sending to ${subscriber.email} (${attemptNum}/3 attempts):`, error.message);
          
          if (retries > 0) {
            // Wait before retry (exponential backoff)
            const delay = attemptNum * 2000; // 2s, 4s delays
            console.log(`   Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            // All retries failed
            console.error(`❌ Failed to send to ${subscriber.email} after 3 attempts`);
          errors.push(subscriber.email);
        }
      }
      }
    }

    if (sent === 0 && errors.length > 0) {
      return res.status(500).json({ 
        success: false, 
        error: `Failed to send emails. Errors: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}` 
      });
    }

    res.json({ success: true, sent, total: targetSubscribers.length, errors: errors.length });
  } catch (error) {
    console.error('Broadcast error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to send broadcast' });
  }
});

// Abandoned carts routes
app.get('/api/admin/abandoned-carts', adminAuth, async (req, res) => {
  try {
    const carts = await readDataFile('abandonedCarts');
    res.json(carts.sort((a, b) => new Date(b.date) - new Date(a.date)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unsubscribe endpoint
app.get('/api/unsubscribe', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ 
        success: false,
        error: 'Valid email address is required' 
      });
    }
    
    const emailLower = email.toLowerCase().trim();
    const subscribers = await readDataFile('subscribers');
    const subscriberIndex = subscribers.findIndex(s => s.email.toLowerCase().trim() === emailLower);
    
    if (subscriberIndex === -1) {
      // Subscriber not found - still return success to avoid revealing email existence
      return res.json({ 
        success: true, 
        message: 'You have been unsubscribed from our newsletter.',
        alreadyUnsubscribed: true
      });
    }
    
    // Remove subscriber
    subscribers.splice(subscriberIndex, 1);
    await writeDataFile('subscribers', subscribers);
    
    // Create notification for admin dashboard
    await createNotification(
      'Subscriber Unsubscribed',
      `Email: ${emailLower} has unsubscribed from the newsletter.`,
      'info'
    );
    
    console.log(`✅ Subscriber unsubscribed: ${emailLower}`);
    
    res.json({ 
      success: true, 
      message: 'You have been successfully unsubscribed from our newsletter. We\'re sorry to see you go!' 
    });
  } catch (error) {
    console.error('Error processing unsubscribe:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to process unsubscribe request' 
    });
  }
});

app.post('/api/admin/abandoned-carts/remind', adminAuth, async (req, res) => {
  try {
    const { cartId } = req.body;
    const carts = await readDataFile('abandonedCarts');
    const cart = carts.find(c => c.id === cartId);
    
    if (!cart || !cart.email) {
      return res.json({ success: false, error: 'Cart not found or no email' });
    }

    if (!resendClient && !emailTransporter) {
      return res.status(500).json({ 
        success: false, 
        error: 'Email service not configured. Please set RESEND_API_KEY or EMAIL_HOST, EMAIL_USER, EMAIL_PASS in .env file' 
      });
    }
    
    // Format cart items for email
    const itemsList = cart.items.map(i => {
      const sizeText = i.size ? `, Size: ${i.size}` : '';
      const colorText = i.color ? `, Color: ${i.color}` : '';
      return `- ${i.name}${sizeText}${colorText} (Qty: ${i.quantity}) - R${((i.price || 0) * (i.quantity || 1)).toFixed(2)}`;
    }).join('\n');
    
    const cartContent = `Hi,\n\nYou left items in your cart. Complete your purchase now!\n\nItems:\n${itemsList}\n\nTotal: R${cart.total.toFixed(2)}\n\nVisit our website to complete your order.`;
    
    // Map cart items to products with images
    const cartProducts = (cart.items || []).map(cartItem => {
      // Find product in PRODUCTS array by id or name
      const product = PRODUCTS.find(p => 
        p.id === cartItem.id || 
        p.id === parseInt(cartItem.id) || 
        p.name === cartItem.name
      );
      
      let imageUrl = null;
      if (product) {
        // Try to get color-specific image first
        if (cartItem.color && product.availableColors) {
          const colorMatch = product.availableColors.find(c => 
            c.name.toLowerCase() === cartItem.color.toLowerCase()
          );
          if (colorMatch && colorMatch.image) {
            imageUrl = colorMatch.image.trim();
          }
        }
        // Fallback to first product image
        if (!imageUrl && product.images && product.images.length > 0) {
          imageUrl = product.images[0].trim();
        }
        // Validate URL format
        if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
          imageUrl = null;
        }
      }
      
      return {
        name: cartItem.name || 'Product',
        price: cartItem.price || 0,
        description: `${cartItem.size ? `Size: ${cartItem.size}` : ''}${cartItem.color ? `${cartItem.size ? ', ' : ''}Color: ${cartItem.color}` : ''}`.trim() || '',
        image: imageUrl
      };
    });
    
    // Check if email is subscribed to newsletter
    const subscribers = await readDataFile('subscribers');
    const isSubscribed = subscribers.some(s => s.email.toLowerCase().trim() === cart.email.toLowerCase().trim());
    
    // Generate professional abandoned cart email template
    const abandonedCartEmailHtml = generateEmailTemplate('abandoned-cart', {
      heading: 'Complete Your Purchase',
      content: cartContent,
      ctaText: 'Complete Purchase',
      ctaLink: `${BRAND_WEBSITE}/checkout.html`,
      products: cartProducts,
      includeSocialMedia: true,
      isSubscribed: isSubscribed
    });
    
    await sendEmailViaResendOrSMTP({
        from: process.env.EMAIL_USER || process.env.FROM_EMAIL || 'contact@saintventura.co.za',
        to: cart.email,
        subject: 'Complete Your Purchase - Saint Ventura',
      text: cartContent,
      html: abandonedCartEmailHtml
      });
      res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/abandoned-carts/remind-all', adminAuth, async (req, res) => {
  try {
    const carts = await readDataFile('abandonedCarts');
    const cartsWithEmail = carts.filter(c => c.email);
    let sent = 0;

    if (!resendClient && !emailTransporter) {
      return res.status(500).json({ 
        success: false, 
        error: 'Email service not configured. Please set RESEND_API_KEY or EMAIL_HOST, EMAIL_USER, EMAIL_PASS in .env file' 
      });
    }
    
      for (const cart of cartsWithEmail) {
        try {
        // Format cart items for email
        const itemsList = cart.items.map(i => {
          const sizeText = i.size ? `, Size: ${i.size}` : '';
          const colorText = i.color ? `, Color: ${i.color}` : '';
          return `- ${i.name}${sizeText}${colorText} (Qty: ${i.quantity}) - R${((i.price || 0) * (i.quantity || 1)).toFixed(2)}`;
        }).join('\n');
        
        const cartContent = `Hi,\n\nYou left items in your cart. Complete your purchase now!\n\nItems:\n${itemsList}\n\nTotal: R${cart.total.toFixed(2)}\n\nVisit our website to complete your order.`;
        
        // Map cart items to products with images
        const cartProducts = (cart.items || []).map(cartItem => {
          // Find product in PRODUCTS array by id or name
          const product = PRODUCTS.find(p => 
            p.id === cartItem.id || 
            p.id === parseInt(cartItem.id) || 
            p.name === cartItem.name
          );
          
          let imageUrl = null;
          if (product) {
            // Try to get color-specific image first
            if (cartItem.color && product.availableColors) {
              const colorMatch = product.availableColors.find(c => 
                c.name.toLowerCase() === cartItem.color.toLowerCase()
              );
              if (colorMatch && colorMatch.image) {
                imageUrl = colorMatch.image.trim();
              }
            }
            // Fallback to first product image
            if (!imageUrl && product.images && product.images.length > 0) {
              imageUrl = product.images[0].trim();
            }
            // Validate URL format
            if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
              imageUrl = null;
            }
          }
          
          return {
            name: cartItem.name || 'Product',
            price: cartItem.price || 0,
            description: `${cartItem.size ? `Size: ${cartItem.size}` : ''}${cartItem.color ? `${cartItem.size ? ', ' : ''}Color: ${cartItem.color}` : ''}`.trim() || '',
            image: imageUrl
          };
        });
        
        // Check if email is subscribed to newsletter
        const subscribers = await readDataFile('subscribers');
        const isSubscribed = subscribers.some(s => s.email.toLowerCase().trim() === cart.email.toLowerCase().trim());
        
        // Generate professional abandoned cart email template
        const abandonedCartEmailHtml = generateEmailTemplate('abandoned-cart', {
          heading: 'Complete Your Purchase',
          content: cartContent,
          ctaText: 'Complete Purchase',
          ctaLink: `${BRAND_WEBSITE}/checkout.html`,
          products: cartProducts,
          includeSocialMedia: true,
          isSubscribed: isSubscribed
        });
        
        await sendEmailViaResendOrSMTP({
            from: process.env.EMAIL_USER || process.env.FROM_EMAIL || 'contact@saintventura.co.za',
            to: cart.email,
            subject: 'Complete Your Purchase - Saint Ventura',
          text: cartContent,
          html: abandonedCartEmailHtml
          });
          sent++;
        } catch (error) {
          console.error(`Error sending to ${cart.email}:`, error);
          errors.push(cart.email);
        }
      }
      res.json({ success: true, sent, total: cartsWithEmail.length, errors: errors.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Track abandoned carts (called from frontend)
app.post('/api/track-abandoned-cart', async (req, res) => {
  try {
    const { 
      email, 
      items, 
      total, 
      customerName, 
      customerPhone, 
      shippingMethod, 
      deliveryAddress, 
      deliveryDetails,
      subtotal,
      shipping
    } = req.body;
    const carts = await readDataFile('abandonedCarts');
    
    // Remove old cart for this email if exists
    const emailLower = email?.toLowerCase().trim() || '';
    const filteredCarts = carts.filter(c => c.email?.toLowerCase().trim() !== emailLower);
    
    filteredCarts.push({
      id: Date.now().toString(),
      email: emailLower,
      customerName: customerName || '',
      customerPhone: customerPhone || '',
      shippingMethod: shippingMethod || '',
      deliveryAddress: deliveryAddress || '',
      deliveryDetails: deliveryDetails || {},
      items: items || [],
      subtotal: subtotal || (total - (shipping || 0)),
      shipping: shipping || 0,
      total: total || 0,
      date: new Date().toISOString()
    });
    
    await writeDataFile('abandonedCarts', filteredCarts);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fulfillers routes
app.get('/api/admin/fulfillers', adminAuth, async (req, res) => {
  try {
    const fulfillers = await readDataFile('fulfillers');
    res.json(fulfillers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/fulfillers', adminAuth, async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const fulfillers = await readDataFile('fulfillers');
    fulfillers.push({
      id: Date.now().toString(),
      name: name,
      email: email,
      phone: phone,
      date: new Date().toISOString()
    });
    await writeDataFile('fulfillers', fulfillers);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/fulfillers/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const fulfillers = await readDataFile('fulfillers');
    const filtered = fulfillers.filter(f => f.id !== id);
    await writeDataFile('fulfillers', filtered);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/fulfillers/notify', adminAuth, async (req, res) => {
  try {
    const { fulfillerId, orderDetails } = req.body;
    const fulfillers = await readDataFile('fulfillers');
    const fulfiller = fulfillers.find(f => f.id === fulfillerId);
    
    if (!fulfiller) {
      return res.json({ success: false, error: 'Fulfiller not found' });
    }

    if (!resendClient && !emailTransporter) {
      return res.status(500).json({ 
        success: false, 
        error: 'Email service not configured. Please set RESEND_API_KEY or EMAIL_HOST, EMAIL_USER, EMAIL_PASS in .env file' 
      });
    }
    
    let retries = 3;
    let success = false;
    let lastError = null;
    
    while (retries > 0 && !success) {
      try {
        // Generate professional fulfiller email template
        // orderDetails can be a string or an object
        let orderDetailsObj = orderDetails;
        if (typeof orderDetails === 'string') {
          // Try to parse if it's a JSON string, otherwise use as-is
          try {
            orderDetailsObj = JSON.parse(orderDetails);
          } catch (e) {
            // Not JSON, keep as string
            orderDetailsObj = orderDetails;
          }
        }
        
        // Map order items to products with images
        let orderProducts = [];
        if (typeof orderDetailsObj === 'object' && orderDetailsObj) {
          const orderItems = orderDetailsObj.orderItems || orderDetailsObj.items || [];
          orderProducts = orderItems.map(cartItem => {
            // Find product in PRODUCTS array by id or name
            const product = PRODUCTS.find(p => 
              p.id === cartItem.id || 
              p.id === parseInt(cartItem.id) || 
              p.name === cartItem.name
            );
            
            let imageUrl = null;
            if (product) {
              // Try to get color-specific image first
              if (cartItem.color && product.availableColors) {
                const colorMatch = product.availableColors.find(c => 
                  c.name.toLowerCase() === cartItem.color.toLowerCase()
                );
                if (colorMatch && colorMatch.image) {
                  imageUrl = colorMatch.image.trim();
                }
              }
              // Fallback to first product image
              if (!imageUrl && product.images && product.images.length > 0) {
                imageUrl = product.images[0].trim();
              }
              // Validate URL format
              if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
                imageUrl = null;
              }
            }
            
            return {
              name: cartItem.name || 'Product',
              price: cartItem.price || 0,
              description: `${cartItem.size ? `Size: ${cartItem.size}` : ''}${cartItem.color ? `${cartItem.size ? ', ' : ''}Color: ${cartItem.color}` : ''} - Qty: ${cartItem.quantity || 1}`.trim() || '',
              image: imageUrl
            };
          });
        }
        
        const fulfillerEmailHtml = generateEmailTemplate('fulfiller-order', {
          heading: 'New Order to Fulfill',
          content: typeof orderDetailsObj === 'object' ? 
            `Hi ${fulfiller.name},\n\nYou have a new order to fulfill. Please review the order details below and process it as soon as possible.` :
            `Hi ${fulfiller.name},\n\nYou have a new order to fulfill. Please review the order details below and process it as soon as possible.\n\n${orderDetails}`,
          orderDetails: orderDetailsObj,
          products: orderProducts, // Add product images
          ctaText: 'View Dashboard',
          ctaLink: `${BRAND_WEBSITE}/admin.html`
        });
        
        // Send email via Resend (preferred) or SMTP (fallback)
        const result = await sendEmailViaResendOrSMTP({
        from: process.env.EMAIL_USER || process.env.FROM_EMAIL || 'contact@saintventura.co.za',
        to: fulfiller.email,
        subject: 'New Order to Fulfill - Saint Ventura',
        text: `Hi ${fulfiller.name},\n\nYou have a new order to fulfill:\n\n${orderDetails}\n\nPlease process this order as soon as possible.`,
          html: fulfillerEmailHtml
      });
        
        success = true;
        console.log(`✅ Fulfiller email sent via ${result.method}${result.port ? ` (port ${result.port})` : ''}`);
      res.json({ success: true });
      } catch (error) {
        lastError = error;
        retries--;
        const attemptNum = 3 - retries;
        console.error(`❌ Error sending fulfiller email to ${fulfiller.email} (${attemptNum}/3 attempts):`, error.message);
        
        if (retries > 0) {
          // Wait before retry (exponential backoff)
          const delay = attemptNum * 2000; // 2s, 4s delays
          console.log(`   Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
    } else {
          // All retries failed
          console.error(`❌ Failed to send fulfiller email after 3 attempts`);
          return res.status(500).json({ 
        success: false, 
            error: `Failed to send email: ${lastError.message}` 
      });
        }
      }
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Notifications routes
app.get('/api/admin/notifications', adminAuth, async (req, res) => {
  try {
    const notifications = await readDataFile('notifications');
    res.json(notifications.sort((a, b) => new Date(b.date) - new Date(a.date)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/notifications/read', adminAuth, async (req, res) => {
  try {
    const { notificationId } = req.body;
    const notifications = await readDataFile('notifications');
    const notif = notifications.find(n => n.id === notificationId);
    if (notif) {
      notif.read = true;
      await writeDataFile('notifications', notifications);
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Notification not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/notifications/read-all', adminAuth, async (req, res) => {
  try {
    const notifications = await readDataFile('notifications');
    notifications.forEach(n => n.read = true);
    await writeDataFile('notifications', notifications);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Dashboard routes
app.get('/api/admin/dashboard', adminAuth, async (req, res) => {
  try {
    const orders = await readDataFile('orders');
    const subscribers = await readDataFile('subscribers');
    const inventory = await readDataFile('inventory');
    const abandonedCarts = await readDataFile('abandonedCarts');
    const notifications = await readDataFile('notifications');
    const inbox = await readDataFile('inbox');
    
    // Calculate stats
    const totalOrders = orders.length;
    // Only count revenue and profit from orders that are pending fulfillment or fulfilled
    // (not pending checkout)
    const ordersForProfit = orders.filter(o => o.status === 'fulfilled'); // Only count fulfilled orders for profit/revenue
    const totalRevenue = ordersForProfit.reduce((sum, o) => {
      const orderTotal = parseFloat(o.total) || 0;
      return sum + orderTotal;
    }, 0);
    
    // Calculate profit: Total sale price - (cost per unit × quantity) - delivery cost
    let totalProfit = 0;
    let totalStockCost = 0;
    let totalDeliveryCost = 0;
    
    // Calculate profit for each order (pending fulfillment or fulfilled)
    ordersForProfit.forEach(order => {
      const orderTotal = parseFloat(order.total) || 0; // Total sale price
      const deliveryCost = parseFloat(order.deliveryCost) || 0;
      totalDeliveryCost += deliveryCost;
      
      // Calculate stock cost for this order (cost per unit × quantity for each item)
      let orderStockCost = 0;
      const orderItems = order.items || [];
      orderItems.forEach(item => {
        // Find inventory item matching product and variant (size/color)
        // Try multiple matching strategies for better product matching
        let inventoryItem = inventory.find(inv => {
          const productMatch = inv.productId === item.id || 
                              inv.productId === parseInt(item.id) ||
                              inv.productName === item.name ||
                              inv.productName?.toLowerCase() === item.name?.toLowerCase() ||
                              inv.productName?.toLowerCase()?.trim() === item.name?.toLowerCase()?.trim();
          
          if (!productMatch) return false;
          
          // Match by variant if size/color provided
          if (item.size || item.color) {
            const variantMatch = (!item.size || inv.variant?.includes(item.size)) &&
                                (!item.color || inv.variant?.includes(item.color));
            return variantMatch;
          }
          
          return true; // If no size/color specified, match any variant of the product
        });
        
        // If not found with variant matching, try to find any variant of the product
        if (!inventoryItem) {
          inventoryItem = inventory.find(inv => {
            return inv.productId === item.id || 
                   inv.productId === parseInt(item.id) ||
                   inv.productName === item.name ||
                   inv.productName?.toLowerCase() === item.name?.toLowerCase() ||
                   inv.productName?.toLowerCase()?.trim() === item.name?.toLowerCase()?.trim();
          });
        }
        
        if (inventoryItem && inventoryItem.costPerUnit && inventoryItem.costPerUnit > 0) {
          const quantity = item.quantity || 1;
          const itemCost = inventoryItem.costPerUnit * quantity;
          orderStockCost += itemCost;
        } else {
          // If inventory item not found or has no cost, log warning but continue
          // Profit will be calculated with 0 cost for this item
          console.warn(`⚠️ No cost found for item: ${item.name} (ID: ${item.id}) - using 0 cost for profit calculation`);
        }
      });
      
      totalStockCost += orderStockCost;
      
      // Profit for this order = Total sale price - Stock cost - Delivery cost
      const orderProfit = orderTotal - orderStockCost - deliveryCost;
      totalProfit += orderProfit;
    });
    
    const totalCosts = totalStockCost + totalDeliveryCost;
    
    const pendingCheckoutOrders = orders.filter(o => o.status === 'pending checkout').length;
    const pendingFulfillmentOrders = orders.filter(o => o.status === 'pending fulfillment').length;
    const fulfilledOrders = orders.filter(o => o.status === 'fulfilled').length;
    const pendingOrders = pendingCheckoutOrders + pendingFulfillmentOrders; // For backward compatibility
    const completedOrders = fulfilledOrders; // For backward compatibility
    const lowStockItems = inventory.filter(i => (i.stock || 0) < 5).length;
    const unreadNotifications = notifications.filter(n => !n.read).length;
    const unreadEmails = inbox.filter(e => !e.read).length;
    
    // Recent orders (last 10)
    const recentOrders = orders
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);
    
    // Revenue by month (last 6 months)
    const monthlyRevenue = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyRevenue[monthKey] = 0;
    }
    
    // Only count revenue from orders that are pending fulfillment or fulfilled in monthly revenue (total sale price)
    orders.forEach(order => {
      if (order.date && (order.status === 'pending fulfillment' || order.status === 'fulfilled')) {
        const orderDate = new Date(order.date);
        const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyRevenue.hasOwnProperty(monthKey)) {
          const orderTotal = parseFloat(order.total) || 0;
          monthlyRevenue[monthKey] += orderTotal;
        }
      }
    });
    
    res.json({
      success: true,
      stats: {
        totalOrders,
        totalRevenue,
        totalCosts,
        totalProfit,
        totalStockCost,
        totalDeliveryCost,
        pendingOrders,
        completedOrders,
        totalSubscribers: subscribers.length,
        lowStockItems,
        unreadNotifications,
        unreadEmails,
        abandonedCarts: abandonedCarts.length
      },
      recentOrders,
      monthlyRevenue
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all orders
app.get('/api/admin/orders', adminAuth, async (req, res) => {
  try {
    const orders = await readDataFile('orders');
    const abandonedCarts = await readDataFile('abandonedCarts');
    
    // Convert abandoned carts to pending orders
    const pendingOrdersFromCarts = abandonedCarts.map(cart => {
      // Check if this cart already exists as an order (by email and similar items)
      const existingOrder = orders.find(o => 
        o.customerEmail?.toLowerCase().trim() === cart.email?.toLowerCase().trim() &&
        (o.status === 'pending checkout' || o.status === 'pending')
      );
      
      // If order already exists, don't create duplicate
      if (existingOrder) {
        return null;
      }
      
      // Convert cart to order format
      return {
        id: cart.id || `CART-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        customerName: cart.customerName || 'Unknown',
        customerEmail: cart.email || '',
        customerPhone: cart.customerPhone || '',
        shippingMethod: cart.shippingMethod || '',
        deliveryAddress: cart.deliveryAddress || '',
        deliveryDetails: cart.deliveryDetails || {},
        items: cart.items || [],
        subtotal: cart.subtotal || (cart.total - (cart.shipping || 0)),
        shipping: cart.shipping || 0,
        total: cart.total || 0,
        date: cart.date || new Date().toISOString(),
        status: 'pending checkout',
        paymentMethod: '',
        isAbandonedCart: true // Flag to identify abandoned carts
      };
    }).filter(order => order !== null); // Remove null entries
    
    // Merge orders and pending orders from carts
    const allOrders = [...orders, ...pendingOrdersFromCarts];
    
    // Sort by date, newest first
    allOrders.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    
    // Check for abandoned carts (pending orders > 10 minutes)
    await checkAbandonedCarts(orders);
    
    res.json(allOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Function to check and move pending orders to abandoned carts
async function checkAbandonedCarts(orders) {
  try {
    const now = Date.now();
    const tenMinutesAgo = now - (10 * 60 * 1000); // 10 minutes in milliseconds
    const abandonedCarts = await readDataFile('abandonedCarts');
    const ordersData = await readDataFile('orders');
    
    // Find pending orders older than 10 minutes
    const pendingOrders = ordersData.filter(order => {
      if (order.status !== 'pending') return false;
      if (!order.date) return false;
      const orderDate = new Date(order.date).getTime();
      return orderDate < tenMinutesAgo;
    });
    
    // Move to abandoned carts if they have email
    for (const order of pendingOrders) {
      if (order.customerEmail) {
        // Check if already in abandoned carts
        const existingCart = abandonedCarts.find(c => c.email === order.customerEmail && c.orderId === order.id);
        if (!existingCart) {
          abandonedCarts.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            email: order.customerEmail,
            orderId: order.id,
            items: order.items || [],
            total: order.total || 0,
            date: order.date,
            customerName: order.customerName
          });
        }
      }
    }
    
    if (pendingOrders.length > 0) {
      await writeDataFile('abandonedCarts', abandonedCarts);
      console.log(`✅ Moved ${pendingOrders.length} pending order(s) to abandoned carts`);
    }
  } catch (error) {
    console.error('Error checking abandoned carts:', error);
  }
}

// Periodic check for abandoned carts (every 5 minutes)
setInterval(async () => {
  try {
    const orders = await readDataFile('orders');
    await checkAbandonedCarts(orders);
  } catch (error) {
    console.error('Error in periodic abandoned cart check:', error);
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// Update order status (public endpoint for checkout success)
app.post('/api/update-order-status', async (req, res) => {
  try {
    const { orderId, status } = req.body;
    
    if (!orderId || !status) {
      return res.status(400).json({ 
        success: false, 
        error: 'Order ID and status are required' 
      });
    }
    
    const orders = await readDataFile('orders');
    const orderIndex = orders.findIndex(o => o.id === orderId);
    
    if (orderIndex === -1) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    const oldStatus = orders[orderIndex].status;
    
    // Only allow updating from "pending checkout" to "pending fulfilment"
    if (oldStatus === 'pending checkout' && status === 'pending fulfilment') {
      orders[orderIndex].status = status;
      orders[orderIndex].updatedAt = new Date().toISOString();
      await writeDataFile('orders', orders);
      console.log(`✅ Updated order ${orderId} from "pending checkout" to "pending fulfilment"`);
      return res.json({ success: true, order: orders[orderIndex] });
    } else {
      // If status is already correct or different transition, return success anyway
      return res.json({ 
        success: true, 
        message: `Order status is already "${oldStatus}" or invalid transition`,
        order: orders[orderIndex]
      });
    }
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update order status
app.put('/api/admin/orders/:orderId/status', adminAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, deliveryCost } = req.body;
    
    const orders = await readDataFile('orders');
    const orderIndex = orders.findIndex(o => o.id === orderId);
    
    if (orderIndex === -1) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    const oldStatus = orders[orderIndex].status;
    orders[orderIndex].status = status;
    orders[orderIndex].updatedAt = new Date().toISOString();
    
    // If changing from pending fulfillment to fulfilled, require delivery cost
    if (oldStatus === 'pending fulfillment' && status === 'fulfilled') {
      if (deliveryCost === undefined || deliveryCost === null || deliveryCost === '') {
        return res.status(400).json({ 
          success: false, 
          error: 'Delivery cost is required when marking order as fulfilled',
          requiresDeliveryCost: true
        });
      }
      const deliveryCostNum = parseFloat(deliveryCost) || 0;
      orders[orderIndex].deliveryCost = deliveryCostNum;
      
      // Reduce stock when order is fulfilled
      try {
        const inventory = await readDataFile('inventory');
        const orderItems = orders[orderIndex].items || [];
        
        for (const item of orderItems) {
          // Find inventory item matching product and variant (size/color)
          const inventoryItem = inventory.find(inv => {
            const productMatch = inv.productId === item.id || 
                                inv.productId === parseInt(item.id) ||
                                inv.productName === item.name;
            
            if (!productMatch) return false;
            
            // Match by variant if size/color provided
            if (item.size || item.color) {
              const variantMatch = (!item.size || inv.variant?.includes(item.size)) &&
                                  (!item.color || inv.variant?.includes(item.color));
              return variantMatch;
            }
            
            return true; // If no size/color specified, match any variant of the product
          });
          
          if (inventoryItem) {
            const quantityToReduce = item.quantity || 1;
            const currentStock = inventoryItem.stock || 0;
            const newStock = Math.max(0, currentStock - quantityToReduce);
            
            // Reduce stock cost by (cost per unit × quantity) but keep cost per unit consistent
            if (inventoryItem.costPerUnit && inventoryItem.costPerUnit > 0) {
              const costToReduce = inventoryItem.costPerUnit * quantityToReduce;
              inventoryItem.stockCost = Math.max(0, (inventoryItem.stockCost || 0) - costToReduce);
              // Cost per unit stays the same - don't recalculate it
            }
            
            inventoryItem.stock = newStock;
            inventoryItem.updatedAt = new Date().toISOString();
            
            if (currentStock === 0) {
              console.log(`⚠️ Item ${inventoryItem.productName} (${inventoryItem.variant || 'default'}) was out of stock - order still processed and marked as fulfilled`);
            } else {
              console.log(`✅ Reduced stock for ${inventoryItem.productName} (${inventoryItem.variant || 'default'}): ${currentStock} -> ${newStock}`);
            }
          } else {
            console.warn(`⚠️ Inventory item not found for ${item.name} (Size: ${item.size || 'N/A'}, Color: ${item.color || 'N/A'}) - order will still be processed and marked as fulfilled`);
          }
        }
        
        await writeDataFile('inventory', inventory);
      } catch (stockError) {
        console.error('Error reducing stock:', stockError);
        // Don't fail the order update if stock reduction fails
      }
    }
    
    await writeDataFile('orders', orders);
    
    res.json({ success: true, order: orders[orderIndex] });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POS/Sales Dashboard routes
app.post('/api/admin/pos/order', adminAuth, async (req, res) => {
  try {
    const { customerName, customerEmail, customerPhone, paymentMethod, items, total, newsletterSubscribe } = req.body;
    
    // Enhance order items with product images and details
    const enhancedItems = items.map(item => {
      const product = PRODUCTS.find(p => 
        p.id === item.id || 
        p.id === parseInt(item.id) ||
        p.name === item.name
      );
      
      let imageUrl = null;
      if (product) {
        // Try to get color-specific image first (case-insensitive matching)
        if (item.color && product.availableColors) {
          const colorMatch = product.availableColors.find(c => 
            c.name.toLowerCase().trim() === item.color.toLowerCase().trim()
          );
          if (colorMatch && colorMatch.image) {
            imageUrl = colorMatch.image.trim();
            console.log(`✅ Found color-specific image for ${item.name} (${item.color}): ${imageUrl}`);
          }
        }
        // Fallback to first product image
        if (!imageUrl && product.images && product.images.length > 0) {
          imageUrl = product.images[0].trim();
          console.log(`📷 Using default product image for ${item.name}: ${imageUrl}`);
        }
      }
      
      // Use existing image if available (from cart/order)
      if (!imageUrl && (item.image || item.imageUrl)) {
        imageUrl = (item.image || item.imageUrl).trim();
        console.log(`🖼️ Using existing image from item for ${item.name}: ${imageUrl}`);
      }
      
      // Validate URL format
      if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        console.warn(`⚠️ Invalid image URL format for ${item.name}: ${imageUrl}`);
        imageUrl = null;
      }
      
      return {
        ...item,
        image: imageUrl || item.image || null,
        imageUrl: imageUrl || item.imageUrl || null
      };
    });
    
    // Check stock availability for all items - POS orders should NOT be processed if out of stock
    let hasOutOfStockItems = false;
    let outOfStockItems = [];
    try {
      const inventory = await readDataFile('inventory');
      console.log(`📦 Total inventory items: ${inventory.length}`);
      console.log(`📦 Inventory sample:`, inventory.slice(0, 3).map(inv => ({
        productId: inv.productId,
        productName: inv.productName || inv.name,
        variant: inv.variant,
        variantId: inv.variantId,
        stock: inv.stock
      })));
      
      for (const item of enhancedItems) {
        // First, find all matching products to debug
        const matchingProducts = inventory.filter(inv => {
          const productIdMatch = inv.productId === item.id || 
                                inv.productId === parseInt(item.id) ||
                                String(inv.productId) === String(item.id);
          const productNameMatch = inv.productName && item.name && 
                                  (inv.productName.toLowerCase().trim() === item.name.toLowerCase().trim());
          const nameMatch = inv.name && item.name && 
                           (inv.name.toLowerCase().trim() === item.name.toLowerCase().trim());
          return productIdMatch || productNameMatch || nameMatch;
        });
        
        console.log(`🔍 Looking for: ${item.name} (ID: ${item.id}, Size: ${item.size || 'N/A'}, Color: ${item.color || 'N/A'})`);
        console.log(`   Found ${matchingProducts.length} inventory items for this product:`, matchingProducts.map(inv => ({
          productId: inv.productId,
          productName: inv.productName || inv.name,
          variant: inv.variant,
          variantId: inv.variantId,
          stock: inv.stock
        })));
        
        const inventoryItem = inventory.find(inv => {
          // Try multiple ways to match the product
          const productIdMatch = inv.productId === item.id || 
                                inv.productId === parseInt(item.id) ||
                                String(inv.productId) === String(item.id);
          
          const productNameMatch = inv.productName && item.name && 
                                  (inv.productName.toLowerCase().trim() === item.name.toLowerCase().trim());
          
          const nameMatch = inv.name && item.name && 
                           (inv.name.toLowerCase().trim() === item.name.toLowerCase().trim());
          
          const productMatch = productIdMatch || productNameMatch || nameMatch;
          
          if (!productMatch) return false;
          
          console.log(`   ✅ Product matched:`, {
            invProductId: inv.productId,
            invProductName: inv.productName || inv.name,
            itemId: item.id,
            itemName: item.name
          });
          
          // Match by variant if size/color provided
          if (item.size || item.color) {
            // Check both variant and variantId fields (case-insensitive)
            const variantStr = (inv.variant || '').toLowerCase().trim();
            const variantIdStr = (inv.variantId || '').toLowerCase().trim();
            
            // Build expected variant strings for matching
            const sizeStr = (item.size || '').toLowerCase().trim();
            const colorStr = (item.color || '').toLowerCase().trim();
            const isOneSize = sizeStr === 'one size fits all';
            
            console.log(`   Checking variant match for inventory item:`, {
              variant: inv.variant,
              variantId: inv.variantId,
              itemSize: item.size,
              itemColor: item.color,
              isOneSize: isOneSize,
              variantStr: variantStr,
              variantIdStr: variantIdStr,
              sizeStr: sizeStr,
              colorStr: colorStr
            });
            
            // For "One Size Fits All" products, inventory only stores color, so match by color only
            if (isOneSize && colorStr) {
              // Check if variantId or variant is just the color (no size)
              const variantIdMatchesColor = variantIdStr === colorStr;
              const variantMatchesColor = variantStr === colorStr;
              
              console.log(`   One Size check: variantIdMatches=${variantIdMatchesColor}, variantMatches=${variantMatchesColor}`);
              
              if (variantIdMatchesColor || variantMatchesColor) {
                console.log(`   ✅ MATCHED by color for One Size product`);
                return true;
              }
            }
            
            // For regular products with sizes, match using both size and color
            const expectedVariantId = sizeStr && colorStr && !isOneSize ? `${sizeStr}-${colorStr}` : (sizeStr || colorStr);
            const expectedVariantWithSlash = sizeStr && colorStr && !isOneSize ? `${sizeStr} / ${colorStr}` : (sizeStr || colorStr);
            
            // Match using variantId (e.g., "M-Black" or "Black")
            const variantIdMatch = variantIdStr === expectedVariantId || 
                                  (sizeStr && !isOneSize && variantIdStr.includes(sizeStr) && (!colorStr || variantIdStr.includes(colorStr))) ||
                                  (colorStr && variantIdStr.includes(colorStr) && (!sizeStr || isOneSize || variantIdStr.includes(sizeStr)));
            
            // Match using variant (e.g., "M / Black" or "Black")
            const variantMatch = variantStr === expectedVariantWithSlash ||
                                (sizeStr && !isOneSize && variantStr.includes(sizeStr) && (!colorStr || variantStr.includes(colorStr))) ||
                                (colorStr && variantStr.includes(colorStr) && (!sizeStr || isOneSize || variantStr.includes(sizeStr)));
            
            const matched = variantIdMatch || variantMatch;
            console.log(`   Regular match check: variantIdMatch=${variantIdMatch}, variantMatch=${variantMatch}, final=${matched}`);
            
            return matched;
          }
          
          return true; // If no size/color specified, match any variant of the product
        });
        
        const requiredQuantity = item.quantity || 1;
        const availableStock = inventoryItem ? (parseInt(inventoryItem.stock) || 0) : 0;
        
        // Debug logging
        console.log(`🔍 Checking stock for ${item.name} (Size: ${item.size || 'N/A'}, Color: ${item.color || 'N/A'}):`, {
          found: !!inventoryItem,
          inventoryVariant: inventoryItem?.variant,
          inventoryVariantId: inventoryItem?.variantId,
          inventoryStock: inventoryItem?.stock,
          stockType: typeof inventoryItem?.stock,
          parsedStock: availableStock,
          required: requiredQuantity
        });
        
        // For POS orders: Only allow if stock > 0
        if (!inventoryItem || availableStock <= 0 || availableStock < requiredQuantity) {
          hasOutOfStockItems = true;
          outOfStockItems.push({
            name: item.name,
            size: item.size || 'N/A',
            color: item.color || 'N/A',
            required: requiredQuantity,
            available: availableStock
          });
          console.warn(`⚠️ Item ${item.name} (Size: ${item.size || 'N/A'}, Color: ${item.color || 'N/A'}) is out of stock. Required: ${requiredQuantity}, Available: ${availableStock}`);
          if (inventoryItem) {
            console.warn(`   Inventory item found but stock insufficient: variant="${inventoryItem.variant}", variantId="${inventoryItem.variantId}", stock=${inventoryItem.stock}`);
          } else {
            console.warn(`   Inventory item NOT found for this variant`);
          }
        }
      }
    } catch (stockCheckError) {
      console.error('Error checking stock:', stockCheckError);
      // If stock check fails, return error for POS orders (don't assume items are available)
      return res.status(500).json({ 
        success: false, 
        error: 'Unable to verify stock availability. Please try again.' 
      });
    }
    
    // For POS orders: DO NOT process if items are out of stock
    if (hasOutOfStockItems) {
      const outOfStockMessage = outOfStockItems.map(item => 
        `${item.name} (${item.size}, ${item.color}): Required ${item.required}, Available ${item.available}`
      ).join('\n');
      
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot process order: Some items are out of stock',
        outOfStockItems: outOfStockItems,
        details: `The following items are not available in sufficient quantity:\n${outOfStockMessage}`
      });
    }
    
    // Determine order status based on stock and payment method
    // For POS orders with stock available (stock > 0):
    // - Cash/EFT = fulfilled (immediate fulfillment for dashboard orders)
    // - Yoco = pending checkout (will be fulfilled after payment)
    let orderStatus;
    if (paymentMethod === 'yoco') {
      orderStatus = 'pending checkout';
    } else {
      // Dashboard orders with stock > 0 should be fulfilled immediately
      orderStatus = 'fulfilled';
    }
    
    // Store order
    const orders = await readDataFile('orders');
    const orderId = `POS-${Date.now()}`;
    orders.push({
      id: orderId,
      customerName,
      customerEmail,
      customerPhone,
      paymentMethod,
      items: enhancedItems, // Store with images and details
      total,
      date: new Date().toISOString(),
      status: orderStatus, // pending checkout or pending fulfillment
      orderType: 'pos' // Mark as POS order
    });
    await writeDataFile('orders', orders);
    
    // Reduce stock immediately for POS orders with fulfilled status (cash/EFT with stock available)
    if (orderStatus === 'fulfilled') {
      try {
        const inventory = await readDataFile('inventory');
        for (const item of enhancedItems) {
          const inventoryItem = inventory.find(inv => {
            const productMatch = inv.productId === item.id || 
                                inv.productId === parseInt(item.id) ||
                                inv.productName === item.name;
            
            if (!productMatch) return false;
            
            if (item.size || item.color) {
              const variantMatch = (!item.size || inv.variant?.includes(item.size)) &&
                                  (!item.color || inv.variant?.includes(item.color));
              return variantMatch;
            }
            
            return true;
          });
          
          if (inventoryItem) {
            const quantityToReduce = item.quantity || 1;
            const currentStock = parseInt(inventoryItem.stock) || 0;
            const newStock = Math.max(0, currentStock - quantityToReduce);
            
            // Reduce stock cost by (cost per unit × quantity) but keep cost per unit consistent
            if (inventoryItem.costPerUnit && inventoryItem.costPerUnit > 0) {
              const costToReduce = inventoryItem.costPerUnit * quantityToReduce;
              inventoryItem.stockCost = Math.max(0, (inventoryItem.stockCost || 0) - costToReduce);
            }
            
            inventoryItem.stock = newStock;
            inventoryItem.updatedAt = new Date().toISOString();
            
            console.log(`✅ Reduced stock for ${inventoryItem.productName} (${inventoryItem.variant || 'default'}): ${currentStock} -> ${newStock}`);
          } else {
            console.warn(`⚠️ Inventory item not found for ${item.name} (Size: ${item.size || 'N/A'}, Color: ${item.color || 'N/A'})`);
          }
        }
        await writeDataFile('inventory', inventory);
      } catch (stockError) {
        console.error('Error reducing stock for POS order:', stockError);
        // Don't fail the order if stock reduction fails
      }
    }
    
    // Add to subscribers if newsletter subscription is checked
    if (newsletterSubscribe && customerEmail) {
      try {
        const subscribers = await readDataFile('subscribers');
        const emailLower = customerEmail.toLowerCase().trim();
        
        // Check if already subscribed
        const existingSubscriber = subscribers.find(s => s.email?.toLowerCase().trim() === emailLower);
        
        if (!existingSubscriber) {
          subscribers.push({
            id: Date.now().toString(),
            email: customerEmail,
            name: customerName || '',
            date: new Date().toISOString(),
            source: 'POS'
          });
          await writeDataFile('subscribers', subscribers);
          console.log(`✅ Added ${customerEmail} to subscribers from POS order`);
        } else {
          console.log(`ℹ️ ${customerEmail} is already subscribed`);
        }
      } catch (subError) {
        console.error('Error adding subscriber from POS order:', subError);
        // Don't fail the order if subscription fails
      }
    }
    
    // Reduce stock when order is fulfilled (POS with cash/EFT and items are in stock)
    // Note: Stock is only reduced when admin marks order as fulfilled, not here
    // This section is kept for backward compatibility but stock reduction happens when status changes to fulfilled
    if (false) { // Disabled - stock reduction happens when order status changes to fulfilled
      try {
        const inventory = await readDataFile('inventory');
        for (const item of items) {
          // Find inventory item matching product and variant (size/color)
          const inventoryItem = inventory.find(inv => {
            const productMatch = inv.productId === item.id || 
                                inv.productId === parseInt(item.id) ||
                                inv.productName === item.name;
            
            if (!productMatch) return false;
            
            // Match by variant if size/color provided
            if (item.size || item.color) {
              const variantMatch = (!item.size || inv.variant?.includes(item.size)) &&
                                  (!item.color || inv.variant?.includes(item.color));
              return variantMatch;
            }
            
            return true; // If no size/color specified, match any variant of the product
          });
          
          if (inventoryItem) {
            const quantityToReduce = item.quantity || 1;
            const currentStock = inventoryItem.stock || 0;
            const newStock = Math.max(0, currentStock - quantityToReduce);
            
            // Reduce stock cost by (cost per unit × quantity) but keep cost per unit consistent
            if (inventoryItem.costPerUnit && inventoryItem.costPerUnit > 0) {
              const costToReduce = inventoryItem.costPerUnit * quantityToReduce;
              inventoryItem.stockCost = Math.max(0, (inventoryItem.stockCost || 0) - costToReduce);
              // Cost per unit stays the same - don't recalculate it
            }
            
            inventoryItem.stock = newStock;
            inventoryItem.updatedAt = new Date().toISOString();
            
            if (currentStock === 0) {
              console.log(`⚠️ Item ${inventoryItem.productName} (${inventoryItem.variant || 'default'}) was out of stock - order still processed and marked as fulfilled`);
            } else {
              console.log(`✅ Reduced stock for ${inventoryItem.productName} (${inventoryItem.variant || 'default'}): ${currentStock} -> ${newStock}`);
            }
          } else {
            console.warn(`⚠️ Inventory item not found for ${item.name} (Size: ${item.size || 'N/A'}, Color: ${item.color || 'N/A'}) - order will still be processed and marked as fulfilled`);
          }
        }
        await writeDataFile('inventory', inventory);
      } catch (stockError) {
        console.error('Error reducing stock:', stockError);
      }
    }

    // Create notification
    const notifications = await readDataFile('notifications');
    notifications.push({
      id: Date.now().toString(),
      type: 'order',
      title: 'New POS Order',
      message: `${customerName} - R${total.toFixed(2)} (${paymentMethod})`,
      date: new Date().toISOString(),
      read: false
    });
    await writeDataFile('notifications', notifications);

    // Send confirmation email for cash/EFT payments (immediately fulfilled)
    if (paymentMethod !== 'yoco' && customerEmail) {
      try {
        // Format order items
        const orderDate = new Date().toLocaleDateString('en-ZA', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const orderDetailsText = `Order ID: ${orderId}\nDate: ${orderDate}\n\nOrder Items:\n${items.map(item => {
          const size = item.size ? `, Size: ${item.size}` : '';
          const color = item.color ? `, Color: ${item.color}` : '';
          return `- ${item.name}${size}${color} (Qty: ${item.quantity || 1}) - R${((item.price || 0) * (item.quantity || 1)).toFixed(2)}`;
        }).join('\n')}\n\nOrder Summary:\nTotal: R${total.toFixed(2)}\nPayment Method: ${paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'eft' ? 'EFT' : paymentMethod}\n\nEnjoy your package!`;

        // Map items to products for email template
        const orderProducts = items.map(item => {
          const product = PRODUCTS.find(p => 
            p.id === item.id || 
            p.id === parseInt(item.id) ||
            p.name === item.name
          );
          
          let imageUrl = null;
          if (product) {
            if (item.color && product.availableColors) {
              const colorMatch = product.availableColors.find(c => 
                c.name.toLowerCase() === item.color.toLowerCase()
              );
              if (colorMatch && colorMatch.image) {
                imageUrl = colorMatch.image.trim();
              }
            }
            if (!imageUrl && product.images && product.images.length > 0) {
              imageUrl = product.images[0].trim();
            }
            if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
              imageUrl = null;
            }
          }
          
          const size = item.size ? `Size: ${item.size}` : '';
          const color = item.color ? `${item.size ? ', ' : ''}Color: ${item.color}` : '';
          const description = [size, color].filter(d => d).join(', ').trim();
          
          return {
            name: item.name,
            price: (item.price || 0) * (item.quantity || 1),
            description: description || '',
            image: imageUrl
          };
        });

        const customerOrderEmailHtml = generateEmailTemplate('order-confirmation', {
          heading: `Order Confirmation - Thank You, ${customerName}!`,
          content: `Dear ${customerName},\n\nWe're absolutely thrilled to confirm that your order has been successfully processed and your payment has been received! Thank you for choosing Saint Ventura for your premium streetwear needs.\n\n${orderDetailsText}\n\nAt Saint Ventura, we're passionate about delivering exceptional quality and style that reflects your unique personality. We're honored that you've chosen us for your streetwear journey.\n\nEnjoy your package! We hope you love your new pieces and that they bring you confidence and style every time you wear them.\n\nIf you have any questions about your order or anything else, please don't hesitate to reach out to us. We're here to help and ensure you have an exceptional experience with Saint Ventura.\n\nThank you again for your purchase. We truly appreciate your support and can't wait to see you rock your new Saint Ventura pieces!`,
          products: orderProducts,
          includeSocialMedia: true,
          isSubscribed: true
        });

        const customerOrderEmailText = `Order Confirmation - Thank You!\n\nDear ${customerName},\n\nThank you for your order! Your payment has been successfully processed.\n\n${orderDetailsText}\n\nEnjoy your package! We hope you love your new Saint Ventura pieces.\n\nThank you for choosing Saint Ventura!`;

        await sendEmailViaResendOrSMTP({
          from: process.env.EMAIL_USER || process.env.FROM_EMAIL || 'contact@saintventura.co.za',
          to: customerEmail,
          subject: 'Order Confirmation - Saint Ventura',
          text: customerOrderEmailText,
          html: customerOrderEmailHtml
        });
        console.log(`✅ Order confirmation email sent to ${customerEmail} for POS order ${orderId}`);
      } catch (emailError) {
        console.error(`⚠️ Failed to send order confirmation email to ${customerEmail}:`, emailError.message);
        // Don't fail the order if email fails
      }
    }

    // If Yoco payment, create checkout
    if (paymentMethod === 'yoco') {
      // Ensure total is a number and convert to cents
      const totalAmount = parseFloat(total) || 0;
      if (totalAmount <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid order total' });
      }
      
      const amountInCents = Math.round(totalAmount * 100);
      const baseUrl = req.headers.origin || req.headers.referer || 'https://saintventura.co.za';
      const baseUrlClean = baseUrl.replace(/\/$/, ''); // Remove trailing slash
      
      const checkoutData = {
        amount: amountInCents,
        currency: 'ZAR',
        successUrl: `${baseUrlClean}/checkout-success.html?orderId=${orderId}`,
        cancelUrl: `${baseUrlClean}/admin.html`,
        metadata: {
          orderId: orderId,
          customerName: customerName,
          customerEmail: customerEmail,
          items: JSON.stringify(items)
        }
      };

      console.log('Creating Yoco checkout for POS order:', {
        orderId,
        amountInCents,
        totalAmount,
        baseUrl: baseUrlClean
      });

      try {
        const response = await axios.post(
          `${YOCO_API_URL}/api/checkouts`,
          checkoutData,
          {
            headers: {
              'Authorization': `Bearer ${YOCO_SECRET_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        const checkoutId = response.data?.id || response.data?.checkoutId;
        let redirectUrl = response.data?.redirectUrl || 
                         response.data?.url || 
                         response.data?.checkoutUrl ||
                         response.data?.link;
        
        // If no redirect URL, construct it
        if (!redirectUrl) {
          redirectUrl = `https://payments.yoco.com/checkout/${checkoutId}`;
        }
        
        // Ensure URL is absolute
        if (redirectUrl && !redirectUrl.startsWith('http')) {
          redirectUrl = `https://${redirectUrl}`;
        }
        
        console.log('Yoco checkout created:', { checkoutId, redirectUrl });
        
        res.json({ success: true, orderId, paymentUrl: redirectUrl });
      } catch (error) {
        console.error('Yoco checkout error:', error.response?.data || error.message);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to create Yoco checkout: ' + (error.response?.data?.message || error.message) 
        });
      }
    } else {
      res.json({ success: true, orderId, order: orders.find(o => o.id === orderId) });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verify Telegram configuration on startup
if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
  console.log(`✅ Telegram Bot configured`);
  console.log(`✅ Chat ID: ${TELEGRAM_CHAT_ID}`);
  console.log(`✅ All notifications will be sent to your Telegram chat`);
  console.log(`✅ This is completely FREE - no costs!`);
} else {
  console.warn(`⚠️  Telegram not fully configured in .env file`);
  console.warn(`   Required (both FREE):`);
  console.warn(`   TELEGRAM_BOT_TOKEN=your_bot_token`);
  console.warn(`   TELEGRAM_CHAT_ID=your_chat_id`);
  console.warn(`   Get FREE bot token from: https://t.me/BotFather`);
  console.warn(`   Get chat ID from: https://t.me/userinfobot`);
  console.warn(`   Or message @userinfobot on Telegram to get your chat ID`);
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Yoco Payment API Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`💳 Checkout endpoint (local): http://localhost:${PORT}/api/create-yoco-checkout`);
  
  // Show production URL if available
  const productionUrl = process.env.BACKEND_URL || 'https://saint-ventura-backend.onrender.com';
  console.log(`🌐 Production URL: ${productionUrl}`);
  console.log(`💳 Checkout endpoint (production): ${productionUrl}/api/create-yoco-checkout`);
  console.log(`✅ This endpoint is accessible from any device via the production URL`);
});



