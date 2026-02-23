# Gmail OAuth2 Setup Guide

This guide will help you set up OAuth2 authentication for Gmail to enable automated 2FA code extraction without storing your Gmail password.

## Why OAuth2?

- **More Secure**: No need to store your Gmail password
- **Modern Standard**: Gmail is phasing out "less secure app" access
- **Revocable**: Tokens can be revoked without changing your password
- **Granular**: Only grants POP3 access, not full email access

---

## Prerequisites

- A Gmail account
- Python 3.7+ installed
- Access to Google Cloud Console

---

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: **"REHAU Bridge"**
4. Click **"Create"**
5. Wait for project creation (takes a few seconds)

---

## Step 2: Enable Gmail API

1. In Google Cloud Console, ensure your new project is selected
2. Go to **"APIs & Services"** → **"Library"**
3. Search for **"Gmail API"**
4. Click on **"Gmail API"**
5. Click **"Enable"**
6. Wait for API to be enabled

---

## Step 3: Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Select **"External"** user type
3. Click **"Create"**

### App Information:
- **App name**: `REHAU Bridge`
- **User support email**: Your Gmail address
- **App logo**: (optional)
- **Application home page**: (optional)
- **Application privacy policy link**: (optional)
- **Application terms of service link**: (optional)
- **Authorized domains**: (leave empty)
- **Developer contact information**: Your Gmail address

4. Click **"Save and Continue"**

### Scopes:
5. Click **"Add or Remove Scopes"**
6. Search for **"Gmail API"**
7. Select: `https://mail.google.com/` (Full Gmail access)
8. Click **"Update"**
9. Click **"Save and Continue"**

### Test Users:
10. Click **"Add Users"**
11. Enter your Gmail address
12. Click **"Add"**
13. Click **"Save and Continue"**

14. Review summary and click **"Back to Dashboard"**

---

## Step 4: Create OAuth2 Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. Application type: **"Desktop app"**
4. Name: **"REHAU Bridge Desktop"**
5. Click **"Create"**

### Save Your Credentials:
6. A dialog will appear with your credentials
7. **Copy and save**:
   - **Client ID**: `xxxxx.apps.googleusercontent.com`
   - **Client Secret**: `xxxxx`
8. Click **"OK"**

---

## Step 5: Get Refresh Token

### Install Required Python Package:

```bash
pip install google-auth-oauthlib google-auth
```

### Run Token Generator Script:

```bash
cd rehau-nea-smart-mqtt-bridge
python scripts/get-gmail-oauth2-token.py
```

### Follow the Prompts:

1. Enter your **Client ID** when prompted
2. Enter your **Client Secret** when prompted
3. A browser window will open automatically
4. **Sign in** with your Gmail account
5. Click **"Continue"** when warned about unverified app
6. Click **"Continue"** again to grant permissions
7. The script will display your credentials

### Example Output:

```
=== Gmail OAuth2 Token Generator ===

Enter your Client ID: 123456789.apps.googleusercontent.com
Enter your Client Secret: GOCSPX-xxxxxxxxxxxxx

Starting OAuth2 flow...
A browser window will open. Please authorize the application.

============================================================
SUCCESS! OAuth2 credentials obtained
============================================================

Access Token: ya29.a0AfB_xxxxx...
Refresh Token: 1//0gxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

============================================================
Add these lines to your .env file:
============================================================
POP3_PROVIDER=gmail
POP3_EMAIL=your.email@gmail.com
POP3_OAUTH2_CLIENT_ID=123456789.apps.googleusercontent.com
POP3_OAUTH2_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
POP3_OAUTH2_REFRESH_TOKEN=1//0gxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
============================================================
```

---

## Step 6: Configure REHAU Bridge

### Update .env File:

```env
# POP3 Provider
POP3_PROVIDER=gmail

# Your Gmail address
POP3_EMAIL=your.email@gmail.com

# OAuth2 Credentials (from Step 5)
POP3_OAUTH2_CLIENT_ID=123456789.apps.googleusercontent.com
POP3_OAUTH2_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
POP3_OAUTH2_REFRESH_TOKEN=1//0gxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### For Home Assistant Addon:

In the addon configuration:

```yaml
pop3_provider: gmail
pop3_email: your.email@gmail.com
pop3_oauth2_client_id: "123456789.apps.googleusercontent.com"
pop3_oauth2_client_secret: "GOCSPX-xxxxxxxxxxxxx"
pop3_oauth2_refresh_token: "1//0gxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

---

## Step 7: Test Configuration

1. **Restart** the REHAU Bridge
2. Check logs for:
   ```
   Initializing Gmail OAuth2 provider
   Using OAuth2 XOAUTH2 authentication
   POP3 authentication successful
   ```

3. Trigger 2FA on REHAU login
4. Bridge should automatically extract the code from Gmail

---

## Troubleshooting

### Error: "Invalid credentials"

**Solution**:
- Verify Client ID and Client Secret are correct
- Ensure Gmail API is enabled
- Check that your email is added as a test user

### Error: "No refresh token received"

**Solution**:
- Make sure you selected **"Desktop app"** type (not "Web application")
- Try revoking access and re-authorizing:
  1. Go to [Google Account Permissions](https://myaccount.google.com/permissions)
  2. Find "REHAU Bridge"
  3. Click "Remove Access"
  4. Run the token generator script again

### Error: "Access blocked: This app's request is invalid"

**Solution**:
- Ensure OAuth consent screen is configured
- Add your email as a test user
- Make sure `https://mail.google.com/` scope is added

### Error: "Token has been expired or revoked"

**Solution**:
- Refresh tokens can expire if not used for 6 months
- Run the token generator script again to get a new refresh token

---

## Security Notes

1. **Keep Secrets Safe**: Never commit `.env` file to version control
2. **Rotate Tokens**: Periodically rotate your client secrets
3. **Revoke Access**: If compromised, revoke tokens in Google Account settings
4. **Minimal Permissions**: Only grants POP3 access, not full Gmail access

---

## Alternative: App Password (Less Secure)

If OAuth2 setup is too complex, you can use Gmail App Passwords:

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification (if not already enabled)
3. Go to [App Passwords](https://myaccount.google.com/apppasswords)
4. Select "Mail" and "Other (Custom name)"
5. Enter "REHAU Bridge"
6. Click "Generate"
7. Copy the 16-character password

Then use basic authentication:

```env
POP3_PROVIDER=basic
POP3_EMAIL=your.email@gmail.com
POP3_PASSWORD=xxxx xxxx xxxx xxxx
POP3_HOST=pop.gmail.com
POP3_PORT=995
POP3_SECURE=true
```

**Note**: App Passwords are being phased out by Google. OAuth2 is the recommended approach.

---

## Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review logs for error messages
3. Consult the [main OAuth2 setup guide](oauth2-setup.md)
4. Open an issue on GitHub with logs (use shareable mode to hide personal info)
