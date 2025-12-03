# Saint Ventura - Premium Streetwear E-commerce

A modern, full-featured e-commerce website for Saint Ventura streetwear brand with integrated payment processing.

## Features

- 🛍️ **Product Catalog** - Browse and filter products by category
- 🛒 **Shopping Cart** - Add items with size and color selection
- 💳 **Yoco Payment Integration** - Secure payment processing
- 📧 **Newsletter Subscription** - Email subscription via Zoho
- 📬 **Contact Form** - Direct email contact via Zoho
- 🚚 **Delivery Options** - Door-to-door courier and campus delivery
- 📱 **Responsive Design** - Mobile-friendly interface

## Tech Stack

- **Frontend:** HTML, CSS (Tailwind), JavaScript
- **Backend:** Node.js, Express
- **Payment:** Yoco Payment Gateway
- **Email:** Zoho Mail (SMTP)
- **Process Manager:** PM2

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
YOCO_SECRET_KEY=your_yoco_secret_key_here
ZOHO_EMAIL=customersupport@saintventura.co.za
ZOHO_PASSWORD=your_zoho_app_password
PORT=3000
```

### 3. Start the Server

**Development:**
```bash
npm run dev
```

**Production (with PM2):**
```bash
npm run pm2:start
```

### 4. Open the Website

Open `index.html` in your browser or serve it via a web server.

## Documentation

- [Backend Setup Guide](README-BACKEND.md)
- [PM2 Setup Guide](README-PM2-SETUP.md)
- [GitHub Setup Guide](GITHUB-SETUP.md)
- [Yoco Authentication Troubleshooting](YOCO-AUTH-TROUBLESHOOTING.md)

## Project Structure

```
├── index.html              # Main website
├── checkout.html           # Checkout page
├── checkout-success.html   # Payment success page
├── server.js               # Backend API server
├── package.json            # Dependencies
├── ecosystem.config.js     # PM2 configuration
└── .env                    # Environment variables (not in git)
```

## API Endpoints

- `POST /api/create-yoco-checkout` - Create Yoco payment checkout
- `POST /api/newsletter-subscribe` - Newsletter subscription
- `POST /api/contact-form` - Contact form submission
- `GET /health` - Health check

## Security

- ✅ API keys stored in environment variables
- ✅ `.env` file excluded from git
- ✅ Secure backend payment processing
- ✅ HTTPS required for live payments

## License

ISC

## Support

For issues or questions, contact: customersupport@saintventura.co.za

