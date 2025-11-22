const express = require('express');
const cors = require('cors');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// CORS configuration - allow all origins including GitHub Pages
app.use(cors({
  origin: '*', // Allow all origins (GitHub Pages, localhost, etc.)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

// Telegram messaging function (FREE - no costs!)
// Sends Telegram messages to the configured chat ID
async function sendWhatsApp({ message, to }) {
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

    // Send Telegram message to support
    const telegramMessage = `📬 *New Newsletter Subscription*\n\nEmail: ${email}\n\nTime: ${new Date().toLocaleString('en-ZA')}`;
    
    sendWhatsApp({
      message: telegramMessage,
      to: TELEGRAM_CHAT_ID
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
    const itemsHtml = orderItems.map(item => {
      const size = item.size ? `Size: ${item.size}` : '';
      const color = item.color ? `Color: ${item.color}` : '';
      const details = [size, color].filter(d => d).join(', ');
      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">
            <strong>${item.name}</strong><br>
            ${details ? `<small style="color: #666;">${details}</small>` : ''}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">R${(item.price * item.quantity).toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    // Format delivery information
    let deliveryHtml = '';
    if (shippingMethod === 'door' && deliveryDetails) {
      deliveryHtml = `
        <p><strong>Delivery Address:</strong></p>
        <p style="margin-left: 20px;">
          ${deliveryDetails.street || ''}<br>
          ${deliveryDetails.suburb ? deliveryDetails.suburb + '<br>' : ''}
          ${deliveryDetails.city || ''}, ${deliveryDetails.province || ''}<br>
          ${deliveryDetails.postalCode || ''}
          ${deliveryDetails.extra ? '<br>' + deliveryDetails.extra : ''}
        </p>
      `;
    } else if (shippingMethod === 'uj' && deliveryDetails) {
      deliveryHtml = `
        <p><strong>Delivery Location:</strong> UJ ${deliveryDetails.campus || 'Campus'} Campus</p>
      `;
    }

    // Email content
    const orderDate = new Date().toLocaleDateString('en-ZA', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Prepare customer email content
    const customerOrderEmailText = `
Order Confirmation - Thank You!

Dear ${customerName},

Thank you for your order! Your payment has been successfully processed.

Order ${orderId ? `ID: ${orderId}` : 'Details'}:
Date: ${orderDate}

Order Items:
${orderItems.map(item => `- ${item.name} (Qty: ${item.quantity}) - R${(item.price * item.quantity).toFixed(2)}`).join('\n')}

Order Summary:
Subtotal: R${subtotal.toFixed(2)}
Shipping: R${shipping.toFixed(2)}
Total: R${total.toFixed(2)}

Delivery Method: ${shippingMethod === 'door' ? 'Door-to-Door Courier' : shippingMethod === 'uj' ? 'UJ Campus Delivery' : 'Testing Delivery'}
${deliveryAddress ? `Delivery Address: ${deliveryAddress}` : ''}

We will process your order and send you tracking information once it ships.

Thank you for choosing Saint Ventura!
    `;

    const customerOrderEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #000; border-bottom: 2px solid #000; padding-bottom: 10px;">Order Confirmation</h2>
        
        <p>Dear <strong>${customerName}</strong>,</p>
        
        <p>Thank you for your order! Your payment has been successfully processed.</p>
        
        <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 5px 0;"><strong>Order ${orderId ? `ID: ${orderId}` : 'Date'}:</strong> ${orderDate}</p>
        </div>

        <h3 style="color: #333; margin-top: 30px;">Order Items</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #f9f9f9;">
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
              <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
              <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <h3 style="color: #333; margin-top: 30px;">Order Summary</h3>
        <table style="width: 100%; margin: 20px 0;">
          <tr>
            <td style="padding: 5px;"><strong>Subtotal:</strong></td>
            <td style="padding: 5px; text-align: right;">R${subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 5px;"><strong>Shipping:</strong></td>
            <td style="padding: 5px; text-align: right;">R${shipping.toFixed(2)}</td>
          </tr>
          <tr style="font-size: 1.2em; font-weight: bold; border-top: 2px solid #000;">
            <td style="padding: 10px 5px;"><strong>Total:</strong></td>
            <td style="padding: 10px 5px; text-align: right;">R${total.toFixed(2)}</td>
          </tr>
        </table>

        <h3 style="color: #333; margin-top: 30px;">Delivery Information</h3>
        <p><strong>Delivery Method:</strong> ${shippingMethod === 'door' ? 'Door-to-Door Courier' : shippingMethod === 'uj' ? 'UJ Campus Delivery' : 'Testing Delivery'}</p>
        ${deliveryHtml}

        <p style="margin-top: 30px; color: #666; font-size: 0.9em;">
          We will process your order and send you tracking information once it ships.
        </p>

        <p style="margin-top: 20px; color: #000; font-weight: bold;">
          Thank you for choosing Saint Ventura!
        </p>
      </div>
    `;

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

    // Return success if WhatsApp was sent
    if (supportResult.success) {
      res.json({ 
        success: true, 
        message: 'Order confirmation notification sent successfully',
        whatsappSent: supportResult.success
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: 'Failed to send order confirmation notification' 
      });
    }

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
    const webhookData = req.body;
    
    console.log('Yoco webhook received:', webhookData);

    // Verify webhook signature if Yoco provides one
    // TODO: Add webhook signature verification for production
    
    // Process the webhook data
    // This is where you would:
    // 1. Verify the payment status
    // 2. Update your database
    // 3. Send confirmation emails
    // 4. Update inventory
    
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

    res.json({
      success: true,
      payment: response.data
    });
  } catch (error) {
    console.error('Error fetching payment status:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || 'Failed to fetch payment status'
    });
  }
});

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
    // Initialize empty files if they don't exist
    for (const [key, filePath] of Object.entries(ADMIN_DATA_FILES)) {
      try {
        await fs.access(filePath);
      } catch {
        await fs.writeFile(filePath, JSON.stringify(key === 'inventory' ? [] : key === 'subscribers' ? [] : key === 'fulfillers' ? [] : key === 'notifications' ? [] : key === 'abandonedCarts' ? [] : key === 'inbox' ? [] : []));
      }
    }
  } catch (error) {
    console.error('Error setting up data directory:', error);
  }
}
ensureDataDir();

// Email transporter setup (using nodemailer)
let emailTransporter = null;
if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  emailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_PORT == 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  console.log('✅ Email transporter configured');
} else {
  console.warn('⚠️  Email not configured - broadcast and email features will be limited');
}

// Admin authentication middleware
function adminAuth(req, res, next) {
  const password = req.headers['x-admin-password'] || req.body.password;
  if (password === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ success: false, error: 'Unauthorized' });
  }
}

// Helper functions for data management
async function readDataFile(fileKey) {
  try {
    const filePath = ADMIN_DATA_FILES[fileKey];
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${fileKey}:`, error);
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

// Product data (from checkout.html)
const PRODUCTS = [
  { id: 1, name: "The Saints Club Tee", price: 550, sizes: ["XS", "S", "M", "L", "XL", "XXL"], colors: ["White"] },
  { id: 2, name: "SV Till I R.I.P Tee", price: 500, sizes: ["XS", "S", "M", "L", "XL", "XXL"], colors: ["Black"] },
  { id: 3, name: "Visionaries by SV", price: 200, sizes: ["One Size Fits All"], colors: ["Black"] },
  { id: 4, name: "SV Creators Hat", price: 200, sizes: ["One Size Fits All"], colors: ["Red", "Black"] },
  { id: 5, name: "Hood* of The Saints", price: 400, sizes: ["XS", "S", "M", "L", "XL", "XXL"], colors: ["Baby Blue", "Black"] },
  { id: 6, name: "SV Utility Shirt", price: 400, sizes: ["XS", "S", "M", "L", "XL", "XXL"], colors: ["Black"] },
  { id: 7, name: "SV Cargo Pants", price: 300, sizes: ["XS", "S", "M", "L", "XL", "XXL"], colors: ["Black"] },
  { id: 8, name: "Ventura Crop Tank", price: 300, sizes: ["XS", "S", "M", "L", "XL", "XXL"], colors: ["Black", "Army Green", "White", "Red"] },
  { id: 9, name: "Essential Beanie", price: 200, sizes: ["One Size Fits All"], colors: ["Black"] },
  { id: 10, name: "Onyx Bracelet By SV", price: 60, sizes: ["13cm", "14cm", "15cm", "16cm", "17cm", "18cm"], colors: ["Black"] }
];

// Initialize inventory from products
async function initializeInventory() {
  const inventory = await readDataFile('inventory');
  if (inventory.length === 0) {
    const newInventory = [];
    PRODUCTS.forEach(product => {
      if (product.sizes.length === 1 && product.sizes[0] === "One Size Fits All") {
        product.colors.forEach(color => {
          newInventory.push({
            id: `${product.id}-${color}`,
            productId: product.id,
            variantId: color,
            name: product.name,
            variant: color,
            stock: 10 // Default stock
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
              stock: 10 // Default stock
            });
          });
        });
      }
    });
    await writeDataFile('inventory', newInventory);
  }
}

initializeInventory();

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

// Inventory routes
app.get('/api/admin/inventory', adminAuth, async (req, res) => {
  try {
    const inventory = await readDataFile('inventory');
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/inventory/update', adminAuth, async (req, res) => {
  try {
    const { productId, variantId, stock } = req.body;
    const inventory = await readDataFile('inventory');
    const item = inventory.find(i => 
      i.productId == productId && (variantId ? i.variantId === variantId : !i.variantId)
    );
    if (item) {
      item.stock = parseInt(stock);
      await writeDataFile('inventory', inventory);
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Item not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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

      // Create notification
      const notifications = await readDataFile('notifications');
      notifications.push({
        id: Date.now().toString(),
        type: 'subscriber',
        title: 'New Newsletter Subscription',
        message: email,
        date: new Date().toISOString(),
        read: false
      });
      await writeDataFile('notifications', notifications);
    }

    // Send Telegram message to support
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
    const { template, subject, message, products } = req.body;
    const subscribers = await readDataFile('subscribers');
    
    if (subscribers.length === 0) {
      return res.json({ success: false, error: 'No subscribers found' });
    }

    // Build email content based on template
    let emailSubject = subject || 'Saint Ventura Update';
    let emailBody = message || '';

    if (template === 'promotion' && products && products.length > 0) {
      const selectedProducts = PRODUCTS.filter(p => products.includes(p.id.toString()));
      emailBody = `Check out our latest products:\n\n${selectedProducts.map(p => `- ${p.name}: R${p.price.toFixed(2)}`).join('\n')}\n\n${message}`;
    }

    let sent = 0;
    if (emailTransporter) {
      for (const subscriber of subscribers) {
        try {
          await emailTransporter.sendMail({
            from: process.env.EMAIL_USER,
            to: subscriber.email,
            subject: emailSubject,
            text: emailBody,
            html: emailBody.replace(/\n/g, '<br>')
          });
          sent++;
        } catch (error) {
          console.error(`Error sending to ${subscriber.email}:`, error);
        }
      }
    } else {
      // If email not configured, just log
      console.log(`Would send broadcast to ${subscribers.length} subscribers`);
      sent = subscribers.length;
    }

    res.json({ success: true, sent });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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

app.post('/api/admin/abandoned-carts/remind', adminAuth, async (req, res) => {
  try {
    const { cartId } = req.body;
    const carts = await readDataFile('abandonedCarts');
    const cart = carts.find(c => c.id === cartId);
    
    if (!cart || !cart.email) {
      return res.json({ success: false, error: 'Cart not found or no email' });
    }

    if (emailTransporter) {
      await emailTransporter.sendMail({
        from: process.env.EMAIL_USER,
        to: cart.email,
        subject: 'Complete Your Purchase - Saint Ventura',
        text: `Hi,\n\nYou left items in your cart. Complete your purchase now!\n\nItems: ${cart.items.map(i => i.name).join(', ')}\nTotal: R${cart.total.toFixed(2)}\n\nVisit our website to complete your order.`,
        html: `<p>Hi,</p><p>You left items in your cart. Complete your purchase now!</p><p><strong>Items:</strong> ${cart.items.map(i => i.name).join(', ')}<br><strong>Total:</strong> R${cart.total.toFixed(2)}</p><p>Visit our website to complete your order.</p>`
      });
    }

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

    if (emailTransporter) {
      for (const cart of cartsWithEmail) {
        try {
          await emailTransporter.sendMail({
            from: process.env.EMAIL_USER,
            to: cart.email,
            subject: 'Complete Your Purchase - Saint Ventura',
            text: `Hi,\n\nYou left items in your cart. Complete your purchase now!\n\nItems: ${cart.items.map(i => i.name).join(', ')}\nTotal: R${cart.total.toFixed(2)}\n\nVisit our website to complete your order.`,
            html: `<p>Hi,</p><p>You left items in your cart. Complete your purchase now!</p><p><strong>Items:</strong> ${cart.items.map(i => i.name).join(', ')}<br><strong>Total:</strong> R${cart.total.toFixed(2)}</p><p>Visit our website to complete your order.</p>`
          });
          sent++;
        } catch (error) {
          console.error(`Error sending to ${cart.email}:`, error);
        }
      }
    } else {
      sent = cartsWithEmail.length;
    }

    res.json({ success: true, sent });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Track abandoned carts (called from frontend)
app.post('/api/track-abandoned-cart', async (req, res) => {
  try {
    const { email, items, total } = req.body;
    const carts = await readDataFile('abandonedCarts');
    
    // Remove old cart for this email if exists
    const filteredCarts = carts.filter(c => c.email !== email);
    
    filteredCarts.push({
      id: Date.now().toString(),
      email: email,
      items: items,
      total: total,
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

    if (emailTransporter) {
      await emailTransporter.sendMail({
        from: process.env.EMAIL_USER,
        to: fulfiller.email,
        subject: 'New Order to Fulfill - Saint Ventura',
        text: `Hi ${fulfiller.name},\n\nYou have a new order to fulfill:\n\n${orderDetails}\n\nPlease process this order as soon as possible.`,
        html: `<p>Hi ${fulfiller.name},</p><p>You have a new order to fulfill:</p><p>${orderDetails.replace(/\n/g, '<br>')}</p><p>Please process this order as soon as possible.</p>`
      });
    }

    res.json({ success: true });
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

// POS/Sales Dashboard routes
app.post('/api/admin/pos/order', adminAuth, async (req, res) => {
  try {
    const { customerName, customerEmail, customerPhone, paymentMethod, items, total } = req.body;
    
    // Store order
    const orders = await readDataFile('orders');
    const orderId = `POS-${Date.now()}`;
    orders.push({
      id: orderId,
      customerName,
      customerEmail,
      customerPhone,
      paymentMethod,
      items,
      total,
      date: new Date().toISOString(),
      status: paymentMethod === 'yoco' ? 'pending' : 'completed'
    });
    await writeDataFile('orders', orders);

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

    // If Yoco payment, create checkout
    if (paymentMethod === 'yoco') {
      const amountInCents = Math.round(total * 100);
      const baseUrl = req.headers.origin || 'https://saintventura.co.za';
      
      const checkoutData = {
        amount: amountInCents,
        currency: 'ZAR',
        successUrl: `${baseUrl}/checkout-success.html?orderId=${orderId}`,
        cancelUrl: `${baseUrl}/admin.html`,
        metadata: {
          orderId: orderId,
          customerName: customerName,
          customerEmail: customerEmail
        }
      };

      try {
        const response = await axios.post(
          `${YOCO_API_URL}/api/checkouts`,
          checkoutData,
          {
            headers: {
              'Authorization': `Bearer ${YOCO_SECRET_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const checkoutId = response.data?.id;
        const redirectUrl = response.data?.redirectUrl || `https://payments.yoco.com/checkout/${checkoutId}`;
        
        res.json({ success: true, orderId, paymentUrl: redirectUrl });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to create Yoco checkout' });
      }
    } else {
      res.json({ success: true, orderId });
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



