# Outlook/Office365 OAuth2 Setup Guide

This guide will help you set up OAuth2 authentication for Outlook/Office365 to enable automated 2FA code extraction.

## Why OAuth2?

- **More Secure**: No need to store your Outlook password
- **Modern Standard**: Microsoft is phasing out basic authentication
- **Revocable**: Tokens can be revoked without changing your password
- **Granular**: Only grants POP3 access, not full email access

---

## Prerequisites

- An Outlook.com or Office365 account
- Python 3.7+ installed
- Access to Azure Portal

---

## Step 1: Register Application in Azure

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **"Azure Active Directory"**
3. Click **"App registrations"** in the left menu
4. Click **"New registration"**

### Application Registration:
- **Name**: `REHAU Bridge`
- **Supported account types**: Select **"Accounts in any organizational directory and personal Microsoft accounts"**
- **Redirect URI**: 
  - Platform: **"Public client/native (mobile & desktop)"**
  - URI: `http://localhost`
5. Click **"Register"**

### Save Application ID:
6. Copy the **Application (client) ID** (you'll need this later)
   - Example: `12345678-1234-1234-1234-123456789abc`

---

## Step 2: Create Client Secret

1. In your app registration, click **"Certificates & secrets"** in the left menu
2. Click **"New client secret"**
3. Description: `REHAU Bridge Secret`
4. Expires: **24 months** (recommended)
5. Click **"Add"**

### Save Client Secret:
6. **IMPORTANT**: Copy the **Value** immediately (you won't see it again!)
   - Example: `abc123~xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## Step 3: Configure API Permissions

1. Click **"API permissions"** in the left menu
2. Click **"Add a permission"**
3. Select **"Microsoft Graph"**
4. Select **"Delegated permissions"**
5. Search and add these permissions:
   - `POP.AccessAsUser.All` (Access mailboxes via POP)
   - `offline_access` (Maintain access to data)
6. Click **"Add permissions"**

### Grant Admin Consent (if you're an admin):
7. Click **"Grant admin consent for [Your Organization]"**
8. Click **"Yes"** to confirm

**Note**: If you're not an admin, you'll need to request admin consent or the permissions will be granted when you first authorize.

---

## Step 4: Get Refresh Token

### Install Required Python Package:

```bash
pip install msal
```

### Run Token Generator Script:

```bash
cd rehau-nea-smart-mqtt-bridge
python scripts/get-outlook-oauth2-token.py
```

### Follow the Prompts:

1. Enter your **Client ID** (Application ID from Step 1)
2. Enter your **Client Secret** (from Step 2)
3. Enter your **Tenant ID** (or press Enter for 'common')
4. A browser window will open automatically
5. **Sign in** with your Outlook/Office365 account
6. Click **"Accept"** to grant permissions
7. The script will display your credentials

### Example Output:

```
=== Outlook/Office365 OAuth2 Token Generator ===

Enter your Client ID (Application ID): 12345678-1234-1234-1234-123456789abc
Enter your Client Secret: abc123~xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Enter your Tenant ID (or 'common' for personal accounts) [common]: 

Starting OAuth2 flow...
A browser window will open. Please authorize the application.

============================================================
SUCCESS! OAuth2 credentials obtained
============================================================

Access Token: eyJ0eXAiOiJKV1QiLCJub25jZSI6...
Refresh Token: 0.AXoA...

============================================================
Add these lines to your .env file:
============================================================
POP3_PROVIDER=outlook
POP3_EMAIL=your.email@outlook.com
POP3_OAUTH2_CLIENT_ID=12345678-1234-1234-1234-123456789abc
POP3_OAUTH2_CLIENT_SECRET=abc123~xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
POP3_OAUTH2_REFRESH_TOKEN=0.AXoA...
POP3_OAUTH2_TENANT_ID=common
============================================================
```

---

## Step 5: Configure REHAU Bridge

### Update .env File:

```env
# POP3 Provider
POP3_PROVIDER=outlook

# Your Outlook/Office365 address
POP3_EMAIL=your.email@outlook.com

# OAuth2 Credentials (from Step 4)
POP3_OAUTH2_CLIENT_ID=12345678-1234-1234-1234-123456789abc
POP3_OAUTH2_CLIENT_SECRET=abc123~xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
POP3_OAUTH2_REFRESH_TOKEN=0.AXoA...
POP3_OAUTH2_TENANT_ID=common
```

### For Home Assistant Addon:

```yaml
pop3_provider: outlook
pop3_email: your.email@outlook.com
pop3_oauth2_client_id: "12345678-1234-1234-1234-123456789abc"
pop3_oauth2_client_secret: "abc123~xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
pop3_oauth2_refresh_token: "0.AXoA..."
pop3_oauth2_tenant_id: "common"
```

---

## Step 6: Test Configuration

1. **Restart** the REHAU Bridge
2. Check logs for:
   ```
   Initializing Outlook OAuth2 provider
   Using OAuth2 XOAUTH2 authentication
   POP3 authentication successful
   ```

3. Trigger 2FA on REHAU login
4. Bridge should automatically extract the code from Outlook

---

## Troubleshooting

### Error: "AADSTS700016: Application not found"

**Solution**:
- Verify Client ID is correct
- Ensure app registration is complete
- Check that you're using the correct Azure tenant

### Error: "No refresh token received"

**Solution**:
- Ensure `offline_access` permission is added
- Try revoking access and re-authorizing:
  1. Go to [Microsoft Account Permissions](https://account.microsoft.com/privacy/app-access)
  2. Find "REHAU Bridge"
  3. Click "Remove"
  4. Run the token generator script again

### Error: "AADSTS65001: The user or administrator has not consented"

**Solution**:
- Ensure API permissions are configured
- Grant admin consent (if you're an admin)
- Or authorize as a user when prompted

### Error: "Authentication failed"

**Solution**:
- Verify Client Secret is correct and hasn't expired
- Check that POP3 is enabled for your mailbox
- Ensure `POP.AccessAsUser.All` permission is granted

### Error: "Token has been revoked"

**Solution**:
- Client secrets expire after the configured period
- Create a new client secret in Azure Portal
- Run the token generator script again

---

## Enable POP3 for Outlook

Outlook POP3 must be enabled:

1. Go to [Outlook Settings](https://outlook.live.com/mail/options/mail/accounts)
2. Click **"Sync email"**
3. Under **"POP and IMAP"**, ensure POP is enabled
4. Click **"Save"**

---

## Tenant ID Information

### For Personal Accounts (outlook.com, hotmail.com):
- Use `common` as tenant ID

### For Organization Accounts (Office365):
- Find your tenant ID in Azure Portal:
  1. Go to **"Azure Active Directory"**
  2. Click **"Properties"**
  3. Copy **"Tenant ID"**

---

## Security Notes

1. **Keep Secrets Safe**: Never commit `.env` file to version control
2. **Rotate Secrets**: Client secrets expire - set reminders to rotate
3. **Revoke Access**: If compromised, revoke in Microsoft Account settings
4. **Minimal Permissions**: Only grants POP3 access

---

## Alternative: App Password (Less Secure)

If OAuth2 setup is too complex, you can use Outlook App Passwords:

1. Go to [Microsoft Account Security](https://account.microsoft.com/security)
2. Click **"Advanced security options"**
3. Under **"App passwords"**, click **"Create a new app password"**
4. Copy the generated password

Then use basic authentication:

```env
POP3_PROVIDER=basic
POP3_EMAIL=your.email@outlook.com
POP3_PASSWORD=xxxx-xxxx-xxxx-xxxx
POP3_HOST=outlook.office365.com
POP3_PORT=995
POP3_SECURE=true
```

**Note**: App Passwords are being phased out. OAuth2 is the recommended approach.

---

## Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review logs for error messages
3. Consult the [main OAuth2 setup guide](oauth2-setup.md)
4. Open an issue on GitHub with logs (use shareable mode)
