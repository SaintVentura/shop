const express = require('express');
const cors = require('cors');
const axios = require('axios');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const sgMail = require('@sendgrid/mail');
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

// Yoco API configuration
// Yoco API base URL for live transactions
const YOCO_API_URL = 'https://payments.yoco.com';
const YOCO_SECRET_KEY = process.env.YOCO_SECRET_KEY;

// Validate Yoco configuration
if (!YOCO_SECRET_KEY) {
  console.error('ERROR: YOCO_SECRET_KEY is not set in environment variables!');
  process.exit(1);
}

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

// Helper function to send email using multiple services (SendGrid > Resend > SMTP)
async function sendEmail({ to, subject, text, html, replyTo }) {
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const zohoEmail = (process.env.ZOHO_EMAIL || 'customersupport@saintventura.co.za').replace(/^"|"$/g, '');
  
  // Try SendGrid first (most reliable, works on all platforms)
  if (SENDGRID_API_KEY) {
    try {
      sgMail.setApiKey(SENDGRID_API_KEY);
      const msg = {
        to: to,
        from: 'customersupport@saintventura.co.za', // Must be verified in SendGrid
        replyTo: replyTo || zohoEmail,
        subject: subject,
        text: text,
        html: html || text.replace(/\n/g, '<br>')
      };
      
      await sgMail.send(msg);
      console.log('✅ Email sent via SendGrid API');
      return { success: true, method: 'sendgrid' };
    } catch (error) {
      console.log('⚠️ SendGrid failed, trying next...', error.message);
      // Fall through to Resend
    }
  }
  
  // Try Resend second (API-based, works on all platforms including Render)
  if (RESEND_API_KEY) {
    try {
      const resend = new Resend(RESEND_API_KEY);
      const { data, error } = await resend.emails.send({
        from: 'Saint Ventura <onboarding@resend.dev>', // Change to your verified domain later
        to: to,
        replyTo: replyTo || zohoEmail,
        subject: subject,
        html: html || text.replace(/\n/g, '<br>'),
        text: text
      });
      
      if (error) {
        console.error('❌ Resend API error:', error);
        throw error;
      }
      
      console.log('✅ Email sent via Resend API:', data?.id);
      return { success: true, method: 'resend', id: data?.id };
    } catch (error) {
      console.log('⚠️ Resend failed, trying SMTP fallback...', error.message);
      // Fall through to SMTP
    }
  }
  
  // Fallback to SMTP (Zoho) - may not work on Render free tier
  const zohoPassword = (process.env.ZOHO_PASSWORD || process.env.ZOHO_APP_PASSWORD || '').replace(/^"|"$/g, '');
  
  if (!zohoPassword) {
    const errorMsg = 'No email service configured. Please set one of: SENDGRID_API_KEY, RESEND_API_KEY, or ZOHO_PASSWORD in environment variables.';
    console.error('❌', errorMsg);
    throw new Error(errorMsg);
  }
  
  // Try multiple SMTP configurations
  const smtpConfigs = [
    {
      host: 'smtp.zoho.com',
      port: 465,
      secure: true,
      auth: { user: zohoEmail, pass: zohoPassword },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 20000,
      tls: { rejectUnauthorized: false }
    },
    {
      host: 'smtp.zoho.com',
      port: 587,
      secure: false,
      auth: { user: zohoEmail, pass: zohoPassword },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 20000,
      requireTLS: true,
      tls: { rejectUnauthorized: false }
    }
  ];
  
  let transporter;
  let lastError;
  
  for (const config of smtpConfigs) {
    try {
      transporter = nodemailer.createTransport(config);
      await transporter.verify();
      console.log(`✅ SMTP connection verified using port ${config.port}`);
      break;
    } catch (error) {
      lastError = error;
      console.log(`⚠️ Port ${config.port} failed, trying next...`);
      continue;
    }
  }
  
  if (!transporter) {
    throw new Error(`SMTP connection failed: ${lastError?.message || 'All ports failed'}`);
  }
  
  const mailOptions = {
    from: zohoEmail,
    to: to,
    replyTo: replyTo || zohoEmail,
    subject: subject,
    text: text,
    html: html || text.replace(/\n/g, '<br>')
  };
  
  // Send with timeout
  const emailPromise = transporter.sendMail(mailOptions);
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Email timeout after 20 seconds')), 20000)
  );
  
  const info = await Promise.race([emailPromise, timeoutPromise]);
  console.log('✅ Email sent via SMTP:', info.messageId);
  return { success: true, method: 'smtp', info };
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

    console.log('Creating Yoco checkout session:', {
      amount: amountInCents,
      currency: currency,
      metadata: metadata
    });

    // Create checkout with Yoco API
    // For live transactions, use: https://payments.yoco.com/api/checkouts
    console.log('Creating checkout with Yoco API:', {
      keyLength: YOCO_SECRET_KEY?.length,
      keyPrefix: YOCO_SECRET_KEY?.substring(0, 7),
      apiUrl: `${YOCO_API_URL}/api/checkouts`
    });
    
    // Retry logic for Yoco API calls
    let response;
    let lastError;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Yoco API attempt ${attempt}/${maxRetries}`);
        response = await axios.post(
          `${YOCO_API_URL}/api/checkouts`,
          checkoutData,
          {
            headers: {
              'Authorization': `Bearer ${YOCO_SECRET_KEY}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            timeout: 30000
          }
        );
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error;
        console.error(`Yoco API attempt ${attempt} failed:`, error.response?.status || error.message);
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * attempt, 5000); // Linear backoff, max 5s
          console.log(`Retrying Yoco API call in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    if (!response) {
      throw lastError || new Error('Yoco API call failed after retries');
    }

    if (response.data && response.data.id) {
      console.log('Checkout session created:', response.data.id);
      console.log('Yoco API response:', JSON.stringify(response.data, null, 2));
      
      // Yoco checkout URL format
      // For live API (payments.yoco.com), the checkout URL format is typically:
      // https://payments.yoco.com/checkout/{checkoutId}
      const checkoutId = response.data.id;
      
      // Check all possible URL fields in Yoco response
      let redirectUrl = response.data.redirectUrl || 
                       response.data.url || 
                       response.data.checkoutUrl ||
                       response.data.link;
      
      // If no redirect URL provided, construct it using payments.yoco.com format
      if (!redirectUrl) {
        redirectUrl = `https://payments.yoco.com/checkout/${checkoutId}`;
      }
      
      console.log('Redirect URL:', redirectUrl);
      
      res.json({
        success: true,
        checkoutId: checkoutId,
        redirectUrl: redirectUrl
      });
    } else {
      console.error('Invalid Yoco API response:', response.data);
      throw new Error('Invalid response from Yoco API');
    }

  } catch (error) {
    console.error('Error creating Yoco checkout:', error.response?.data || error.message);
    console.error('Full error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method
    });
    
    // Return user-friendly error message
    let errorMessage = 'Failed to create checkout session';
    
    if (error.response?.status === 404) {
      errorMessage = 'Yoco API endpoint not found. Please check the API URL configuration.';
    } else if (error.response?.status === 401) {
      errorMessage = 'Yoco API authentication failed. Please check your API key.';
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: errorMessage
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

    // Send email - SENT TO: customersupport@saintventura.co.za
    const result = await sendEmail({
      to: 'customersupport@saintventura.co.za', // All contact form emails go here
      replyTo: email, // Allow replying directly to the customer
      subject: `Contact Form: ${subject}`,
      text: `New contact form submission from Saint Ventura website:

Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}
Subject: ${subject}

Message:
${message}

Submitted on: ${new Date().toLocaleString()}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
        <hr>
        <h3>Message:</h3>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `
    });
    
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
      
      res.json({ 
        success: true, 
        message: 'Contact form submitted successfully' 
      });
    } else {
      console.error('❌ FAILED to send contact form email to customersupport@saintventura.co.za after retries');
      console.error('Error details:', {
        code: result.error?.code,
        command: result.error?.command,
        response: result.error?.response,
        responseCode: result.error?.responseCode,
        message: result.error?.message,
        stack: result.error?.stack
      });
      
      // Still return success to user, but log the error
      res.json({ 
        success: true, 
        message: 'Contact form submitted successfully (email may be delayed)' 
      });
    }

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

    // Send email - SENT TO: customersupport@saintventura.co.za
    const result = await sendEmail({
      to: 'customersupport@saintventura.co.za', // All newsletter subscriptions go here
      subject: 'Newsletter Subscription Request',
      text: `New newsletter subscription:\n\nEmail: ${email}\nSubscription Date: ${new Date().toLocaleDateString()}\nTime: ${new Date().toLocaleTimeString()}`,
      html: `
        <h2>New Newsletter Subscription</h2>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subscription Date:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
        <p>Please add this email to your newsletter subscription list.</p>
      `
    });
    
    if (result.success) {
      console.log('✅ Newsletter subscription email SENT successfully to customersupport@saintventura.co.za');
      console.log('Email details:', { 
        messageId: result.id || result.info?.messageId,
        method: result.method,
        to: 'customersupport@saintventura.co.za',
        subject: 'Newsletter Subscription Request',
        subscriberEmail: email
      });
      
      res.json({ 
        success: true, 
        message: 'Subscription request sent successfully' 
      });
    } else {
      console.error('❌ FAILED to send newsletter email to customersupport@saintventura.co.za after retries');
      console.error('Error details:', {
        code: result.error?.code,
        command: result.error?.command,
        response: result.error?.response,
        responseCode: result.error?.responseCode,
        message: result.error?.message,
        stack: result.error?.stack
      });
      
      // Still return success to user, but log the error
      res.json({ 
        success: true, 
        message: 'Subscription request sent successfully (email may be delayed)' 
      });
    }

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

    // Send email - SENT TO: customersupport@saintventura.co.za
    const result = await sendEmail({
      to: 'customersupport@saintventura.co.za', // All order confirmations go here
      replyTo: customerEmail, // Allow replying directly to the customer
      subject: `New Order Received - ${customerName} - R${total.toFixed(2)}`,
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
    });
    
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
      
      res.json({ 
        success: true, 
        message: 'Order confirmation email sent successfully' 
      });
    } else {
      console.error('❌ FAILED to send order confirmation email to customersupport@saintventura.co.za after retries');
      console.error('Error details:', {
        code: result.error?.code,
        command: result.error?.command,
        response: result.error?.response,
        responseCode: result.error?.responseCode,
        message: result.error?.message,
        stack: result.error?.stack,
        customerName: customerName,
        orderId: orderId
      });
      
      // Still return success to user, but log the error
      res.json({ 
        success: true, 
        message: 'Order confirmation email sent successfully (email may be delayed)' 
      });
    }

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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Yoco Payment API Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`💳 Checkout endpoint: http://localhost:${PORT}/api/create-yoco-checkout`);
});



