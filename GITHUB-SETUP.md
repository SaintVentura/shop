# GitHub Repository Setup Guide

## Steps to Push to GitHub

### 1. Create Repository on GitHub

1. Go to https://github.com/new
2. Repository name: `saint-ventura` (or `saintventura` or your preferred name)
3. Description: "Saint Ventura - Premium Streetwear E-commerce Website"
4. Choose: **Private** (recommended) or Public
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

### 2. Connect and Push

After creating the repository, GitHub will show you commands. Use these:

```bash
# Add the remote repository (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/saint-ventura.git

# Or if you prefer SSH:
# git remote add origin git@github.com:YOUR_USERNAME/saint-ventura.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 3. Alternative: Using GitHub CLI (if installed)

```bash
# Create and push in one command
gh repo create saint-ventura --private --source=. --remote=origin --push
```

## Important Notes

### Files NOT Included (Protected by .gitignore):
- ✅ `.env` - Contains sensitive API keys (Yoco, Zoho)
- ✅ `node_modules/` - Dependencies (can be reinstalled)
- ✅ `logs/` - Log files
- ✅ `*.log` - Log files

### Files Included:
- ✅ All HTML files (index.html, checkout.html, etc.)
- ✅ Backend server code (server.js)
- ✅ Configuration files (package.json, ecosystem.config.js)
- ✅ Documentation (README files)
- ✅ Startup scripts

## After Pushing

1. **Add Environment Variables to GitHub Secrets** (if using GitHub Actions):
   - Go to repository Settings → Secrets
   - Add: `YOCO_SECRET_KEY`, `ZOHO_EMAIL`, `ZOHO_PASSWORD`

2. **Update .env file on your server** with the actual values

3. **Share repository access** with team members if needed

## Repository Structure

```
saint-ventura/
├── index.html              # Main website
├── checkout.html           # Checkout page
├── checkout-success.html   # Success page
├── server.js               # Backend API server
├── package.json            # Dependencies
├── ecosystem.config.js     # PM2 configuration
├── .gitignore             # Git ignore rules
├── .env                    # Environment variables (NOT in git)
├── README-BACKEND.md       # Backend documentation
├── README-PM2-SETUP.md     # PM2 setup guide
└── ... (other files)
```

