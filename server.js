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
  res.json({ status: 'ok', message: 'Yoco Payment API is running' });
});

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
    
    const response = await axios.post(
      `${YOCO_API_URL}/api/checkouts`,
      checkoutData,
      {
        headers: {
          // Yoco API uses secret key directly in Authorization header
          // Format: Authorization: Bearer <secret_key>
          'Authorization': `Bearer ${YOCO_SECRET_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        // Add timeout
        timeout: 30000
      }
    );

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

    // Configure Zoho email transporter
    const zohoEmail = (process.env.ZOHO_EMAIL || 'customersupport@saintventura.co.za').replace(/^"|"$/g, '');
    const zohoPassword = (process.env.ZOHO_PASSWORD || process.env.ZOHO_APP_PASSWORD || '').replace(/^"|"$/g, '');
    
    if (!zohoPassword) {
      console.error('ZOHO_PASSWORD is not set in .env file');
      return res.status(500).json({ 
        success: false,
        error: 'Email service not configured. Please set ZOHO_PASSWORD in .env file.' 
      });
    }
    
    const transporter = nodemailer.createTransport({
      host: 'smtp.zoho.com',
      port: 587,
      secure: false,
      auth: {
        user: zohoEmail,
        pass: zohoPassword
      }
    });

    // Email content
    const mailOptions = {
      from: zohoEmail,
      to: 'customersupport@saintventura.co.za',
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
    };

    // Send email
    await transporter.sendMail(mailOptions);
    
    console.log('Contact form email sent:', { name, email, subject });
    
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

    // Configure Zoho email transporter
    // Note: You'll need to set these in your .env file:
    // ZOHO_EMAIL=customersupport@saintventura.co.za
    // ZOHO_PASSWORD=your-zoho-app-password
    const zohoEmail = (process.env.ZOHO_EMAIL || 'customersupport@saintventura.co.za').replace(/^"|"$/g, '');
    const zohoPassword = (process.env.ZOHO_PASSWORD || process.env.ZOHO_APP_PASSWORD || '').replace(/^"|"$/g, '');
    
    if (!zohoPassword) {
      console.error('ZOHO_PASSWORD is not set in .env file');
      return res.status(500).json({ 
        success: false,
        error: 'Email service not configured. Please set ZOHO_PASSWORD in .env file.' 
      });
    }
    
    const transporter = nodemailer.createTransport({
      host: 'smtp.zoho.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: zohoEmail,
        pass: zohoPassword
      }
    });

    // Email content
    const mailOptions = {
      from: zohoEmail,
      to: 'customersupport@saintventura.co.za',
      subject: 'Newsletter Subscription Request',
      text: `New newsletter subscription:\n\nEmail: ${email}\nSubscription Date: ${new Date().toLocaleDateString()}\nTime: ${new Date().toLocaleTimeString()}`,
      html: `
        <h2>New Newsletter Subscription</h2>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subscription Date:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
        <p>Please add this email to your newsletter subscription list.</p>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);
    
    console.log('Newsletter subscription email sent:', email);
    
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

    // Configure Zoho email transporter
    const zohoEmail = (process.env.ZOHO_EMAIL || 'customersupport@saintventura.co.za').replace(/^"|"$/g, '');
    const zohoPassword = (process.env.ZOHO_PASSWORD || process.env.ZOHO_APP_PASSWORD || '').replace(/^"|"$/g, '');
    
    if (!zohoPassword) {
      console.error('ZOHO_PASSWORD is not set in .env file');
      return res.status(500).json({ 
        success: false,
        error: 'Email service not configured. Please set ZOHO_PASSWORD in .env file.' 
      });
    }
    
    const transporter = nodemailer.createTransport({
      host: 'smtp.zoho.com',
      port: 587,
      secure: false,
      auth: {
        user: zohoEmail,
        pass: zohoPassword
      }
    });

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

    const mailOptions = {
      from: zohoEmail,
      to: 'customersupport@saintventura.co.za',
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
    };

    // Send email
    await transporter.sendMail(mailOptions);
    
    console.log('Order confirmation email sent:', { customerName, customerEmail, total });
    
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Yoco Payment API Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`💳 Checkout endpoint: http://localhost:${PORT}/api/create-yoco-checkout`);
});



