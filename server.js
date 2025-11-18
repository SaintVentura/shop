const express = require('express');
const cors = require('cors');
const axios = require('axios');
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

// Simple email function - sends email directly to customer support
async function sendEmail({ to, subject, text, html }) {
  const email = process.env.EMAIL || 'customersupport@saintventura.co.za';
  const password = process.env.EMAIL_PASSWORD || '';
  
  if (!password) {
    console.error('❌ EMAIL_PASSWORD not set in .env file');
    return { success: false, error: 'Email not configured' };
  }
  
  const transporter = nodemailer.createTransport({
    host: 'smtp.zoho.com',
    port: 587,
    secure: false,
    auth: {
      user: email,
      pass: password
    }
  });
  
  try {
    await transporter.sendMail({
      from: email,
      to: to || 'customersupport@saintventura.co.za',
      subject: subject,
      text: text,
      html: html || text
    });
    console.log('✅ Email sent to', to || 'customersupport@saintventura.co.za');
    return { success: true };
  } catch (error) {
    console.error('❌ Email failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Email test endpoint - test email configuration
app.post('/api/test-email', async (req, res) => {
  try {
    const result = await sendEmail({
      to: 'customersupport@saintventura.co.za',
      subject: 'Test Email - Saint Ventura Backend',
      text: `This is a test email from your Saint Ventura backend server.\n\nSent at: ${new Date().toISOString()}\nServer: ${process.env.NODE_ENV || 'development'}`,
      html: `
        <h2>Test Email</h2>
        <p>This is a test email from your Saint Ventura backend server.</p>
        <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
        <p><strong>Server:</strong> ${process.env.NODE_ENV || 'development'}</p>
      `
    });
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Test email sent successfully to customersupport@saintventura.co.za',
        messageId: result.id || result.info?.messageId,
        method: result.method
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: 'Failed to send test email',
        details: result.error?.message || 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Email test failed',
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

// Contact form email endpoint
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

    // Send email to customer support
    sendEmail({
      to: 'customersupport@saintventura.co.za',
      subject: `Contact Form: ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\nSubject: ${subject}\n\nMessage:\n${message}`,
      html: `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Phone:</strong> ${phone || 'Not provided'}</p><p><strong>Subject:</strong> ${subject}</p><p><strong>Message:</strong> ${message.replace(/\n/g, '<br>')}</p>`
    }).then(result => {
      if (result.success) {
        console.log('✅ Contact form email SENT successfully to customersupport@saintventura.co.za');
        console.log('Email details:', { 
          messageId: result.id || result.info?.messageId,
          method: result.method,
          to: 'customersupport@saintventura.co.za',
          subject: `Contact Form: ${subject}`,
          name: name,
          email: email
        });
      }
    }).catch(error => {
      console.error('❌ FAILED to send contact form email to customersupport@saintventura.co.za');
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
    
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Please check your Zoho email and password in .env file.';
      console.error('Authentication error - Check ZOHO_EMAIL and ZOHO_PASSWORD in .env');
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Could not connect to Zoho email server. Please check your internet connection.';
      console.error('Connection error - Check network and Zoho SMTP settings');
    } else if (error.message) {
      errorMessage = `Email error: ${error.message}`;
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

    // Send email to customer support
    sendEmail({
      to: 'customersupport@saintventura.co.za',
      subject: 'Newsletter Subscription',
      text: `New newsletter subscription: ${email}`,
      html: `<p><strong>New Newsletter Subscription:</strong> ${email}</p>`
    }).then(result => {
      if (result.success) {
        console.log('✅ Newsletter subscription email SENT successfully to customersupport@saintventura.co.za');
        console.log('Email details:', { 
          messageId: result.id || result.info?.messageId,
          method: result.method,
          to: 'customersupport@saintventura.co.za',
          subject: 'Newsletter Subscription Request',
          subscriberEmail: email
        });
      }
    }).catch(error => {
      console.error('❌ FAILED to send newsletter email to customersupport@saintventura.co.za');
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
    
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Please check your Zoho email and password in .env file. You may need to use an App Password instead of your regular password.';
      console.error('Authentication error - Check ZOHO_EMAIL and ZOHO_PASSWORD in .env');
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Could not connect to Zoho email server. Please check your internet connection.';
      console.error('Connection error - Check network and Zoho SMTP settings');
    } else if (error.code === 'ESOCKET') {
      errorMessage = 'Email server connection error. Please verify Zoho SMTP settings.';
      console.error('Socket error - Check Zoho SMTP configuration');
    } else if (error.response) {
      errorMessage = `Email server error: ${error.response}`;
    } else if (error.message) {
      errorMessage = `Email error: ${error.message}`;
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

    // Send email to customer support
    sendEmail({
      to: 'customersupport@saintventura.co.za',
      subject: `New Order Checkout - ${customerName}`,
      text: `
New Order Checkout Initiated

Customer Details:
- Name: ${customerName}
- Email: ${customerEmail}
- Phone: ${customerPhone || 'Not provided'}

Shipping Method: ${shippingMethod}

Delivery Address:
${deliveryAddress || 'Not provided'}

Order Items:
${itemsText}

Order Summary:
- Subtotal: R${subtotal.toFixed(2)}
- Shipping: R${shipping.toFixed(2)}
- Total: R${total.toFixed(2)}

Timestamp: ${timestamp || new Date().toISOString()}

---
This is a checkout notification. The customer has clicked "Proceed to Payment" and is being redirected to the payment gateway.
      `,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #000; border-bottom: 2px solid #000; padding-bottom: 10px;">New Order Checkout</h2>
          
          <h3 style="color: #333; margin-top: 20px;">Customer Details</h3>
          <p><strong>Name:</strong> ${customerName}</p>
          <p><strong>Email:</strong> ${customerEmail}</p>
          <p><strong>Phone:</strong> ${customerPhone || 'Not provided'}</p>

          <h3 style="color: #333; margin-top: 20px;">Shipping Information</h3>
          <p><strong>Shipping Method:</strong> ${shippingMethod}</p>
          ${deliveryHtml}

          <h3 style="color: #333; margin-top: 20px;">Order Items</h3>
          <ul>
            ${itemsHtml}
          </ul>

          <h3 style="color: #333; margin-top: 20px;">Order Summary</h3>
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

          <p style="margin-top: 30px; color: #666; font-size: 0.9em;">
            <strong>Timestamp:</strong> ${timestamp || new Date().toISOString()}
          </p>

          <p style="margin-top: 20px; color: #666; font-size: 0.9em; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #000;">
            <strong>Note:</strong> This is a checkout notification. The customer has clicked "Proceed to Payment" and is being redirected to the payment gateway.
          </p>
        </div>
      `
    }).then(result => {
      if (result.success) {
        console.log('✅ Checkout email notification SENT successfully to customersupport@saintventura.co.za');
        console.log('Email details:', { 
          messageId: result.id || result.info?.messageId,
          method: result.method,
          to: 'customersupport@saintventura.co.za',
          subject: `New Order Checkout - ${customerName}`,
          customerName: customerName,
          customerEmail: customerEmail,
          total: total
        });
      }
    }).catch(error => {
      console.error('❌ FAILED to send checkout email notification to customersupport@saintventura.co.za');
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        customerName: customerName,
        customerEmail: customerEmail
      });
    });

    // Return success immediately (don't wait for email)
    res.json({ 
      success: true,
      message: 'Checkout email notification sent successfully' 
    });

  } catch (error) {
    console.error('Error sending checkout email notification:', error);
    console.error('Error details:', {
      code: error.code,
      command: error.command,
      response: error.response,
      message: error.message
    });
    
    // Provide more specific error messages
    let errorMessage = 'Failed to send checkout email notification';
    
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Please check your Zoho email and password in .env file.';
      console.error('Authentication error - Check ZOHO_EMAIL and ZOHO_PASSWORD in .env');
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Could not connect to Zoho email server. Please check your internet connection.';
      console.error('Connection error - Check network and Zoho SMTP settings');
    } else if (error.message) {
      errorMessage = `Email error: ${error.message}`;
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

    // Send email to customer support
    sendEmail({
      to: 'customersupport@saintventura.co.za',
      subject: `New Order - ${customerName} - R${total.toFixed(2)}`,
      text: `
New Order Received

Order ${orderId ? `ID: ${orderId}` : 'Details'}:
Date: ${orderDate}

Customer Information:
Name: ${customerName}
Email: ${customerEmail}

Order Items:
${orderItems.map(item => `- ${item.name} (Qty: ${item.quantity}) - R${(item.price * item.quantity).toFixed(2)}`).join('\n')}

Order Summary:
Subtotal: R${subtotal.toFixed(2)}
Shipping: R${shipping.toFixed(2)}
Total: R${total.toFixed(2)}

Delivery Method: ${shippingMethod === 'door' ? 'Door-to-Door Courier' : 'UJ Campus Delivery'}
${deliveryAddress ? `Delivery Address: ${deliveryAddress}` : ''}
      `,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #000; padding-bottom: 10px;">New Order Received</h2>
          
          <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 5px 0;"><strong>Order ${orderId ? `ID: ${orderId}` : 'Date'}:</strong> ${orderDate}</p>
          </div>

          <h3 style="color: #333; margin-top: 30px;">Customer Information</h3>
          <p><strong>Name:</strong> ${customerName}</p>
          <p><strong>Email:</strong> ${customerEmail}</p>

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
          <p><strong>Delivery Method:</strong> ${shippingMethod === 'door' ? 'Door-to-Door Courier' : 'UJ Campus Delivery'}</p>
          ${deliveryHtml}

          <p style="margin-top: 30px; color: #666; font-size: 0.9em;">
            This is an automated order confirmation email. Please process this order accordingly.
          </p>
        </div>
      `
    }).then(result => {
      if (result.success) {
        console.log('✅ Order confirmation email SENT successfully to customersupport@saintventura.co.za');
        console.log('Email details:', { 
          messageId: result.id || result.info?.messageId,
          method: result.method,
          to: 'customersupport@saintventura.co.za',
          subject: `New Order Received - ${customerName} - R${total.toFixed(2)}`,
          customerName: customerName,
          customerEmail: customerEmail,
          total: total,
          orderId: orderId
        });
      }
    }).catch(error => {
      console.error('❌ FAILED to send order confirmation email to customersupport@saintventura.co.za');
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        customerName: customerName,
        customerEmail: customerEmail,
        total: total,
        orderId: orderId
      });
    });
    
    // Return success immediately (email sends in background)
    res.json({ 
      success: true, 
      message: 'Order confirmation email sent successfully' 
    });

  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to send order confirmation email';
    
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Please check your Zoho email and password in .env file.';
      console.error('Authentication error - Check ZOHO_EMAIL and ZOHO_PASSWORD in .env');
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Could not connect to Zoho email server. Please check your internet connection.';
      console.error('Connection error - Check network and Zoho SMTP settings');
    } else if (error.message) {
      errorMessage = `Email error: ${error.message}`;
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

// Verify email configuration on startup
const email = process.env.EMAIL || 'customersupport@saintventura.co.za';
const password = process.env.EMAIL_PASSWORD || '';

if (password) {
  console.log(`✅ Email configured: ${email}`);
} else {
  console.warn(`⚠️  EMAIL_PASSWORD not set in .env file`);
  console.warn(`   Add: EMAIL=customersupport@saintventura.co.za`);
  console.warn(`   Add: EMAIL_PASSWORD=your_email_password`);
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



