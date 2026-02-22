# OAuth2 Setup Guide for POP3 Authentication

This guide explains how to set up OAuth2 authentication for Gmail and Outlook/Office365 to enable automated 2FA code extraction without storing your email password.

## Why OAuth2?

OAuth2 provides several advantages over basic authentication:
- **More Secure**: No need to store your email password
- **Modern Standard**: Gmail and Outlook are phasing out "less secure app" access
- **Token-Based**: Uses refresh tokens that can be revoked
- **Granular Permissions**: Only grants POP3 access, not full email access

## Gmail OAuth2 Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

### Step 2: Create OAuth2 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: External
   - App name: "REHAU Bridge"
   - User support email: Your email
   - Developer contact: Your email
   - Scopes: Add `https://mail.google.com/`
   - Test users: Add your Gmail address
4. Application type: "Desktop app"
5. Name: "REHAU Bridge"
6. Click "Create"
7. Save the **Client ID** and **Client Secret**

### Step 3: Get Refresh Token

Use this Python script to get your refresh token:

```python
#!/usr/bin/env python3
import json
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

# Your credentials from Step 2
CLIENT_ID = 'your-client-id.apps.googleusercontent.com'
CLIENT_SECRET = 'your-client-secret'

# Gmail POP3 scope
SCOPES = ['https://mail.google.com/']

# Create flow
flow = InstalledAppFlow.from_client_config(
    {
        "installed": {
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost"]
        }
    },
    SCOPES
)

# Run local server for OAuth flow
creds = flow.run_local_server(port=0)

print("\n=== OAuth2 Credentials ===")
print(f"Access Token: {creds.token}")
print(f"Refresh Token: {creds.refresh_token}")
print(f"Token Expiry: {creds.expiry}")
print("\nAdd these to your .env file:")
print(f"POP3_PROVIDER=gmail")
print(f"POP3_OAUTH2_CLIENT_ID={CLIENT_ID}")
print(f"POP3_OAUTH2_CLIENT_SECRET={CLIENT_SECRET}")
print(f"POP3_OAUTH2_REFRESH_TOKEN={creds.refresh_token}")
```

Install dependencies:
```bash
pip install google-auth-oauthlib google-auth
```

Run the script:
```bash
python3 get_gmail_token.py
```

### Step 4: Configure .env

Add to your `.env` file:

```env
POP3_PROVIDER=gmail
POP3_EMAIL=your.email@gmail.com
POP3_OAUTH2_CLIENT_ID=your-client-id.apps.googleusercontent.com
POP3_OAUTH2_CLIENT_SECRET=your-client-secret
POP3_OAUTH2_REFRESH_TOKEN=your-refresh-token
```

---

## Outlook/Office365 OAuth2 Setup

### Step 1: Register Application in Azure

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" > "App registrations"
3. Click "New registration"
4. Name: "REHAU Bridge"
5. Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
6. Redirect URI: "Public client/native" with `http://localhost`
7. Click "Register"
8. Save the **Application (client) ID**

### Step 2: Create Client Secret

1. In your app registration, go to "Certificates & secrets"
2. Click "New client secret"
3. Description: "REHAU Bridge Secret"
4. Expires: Choose duration (recommend 24 months)
5. Click "Add"
6. **Important**: Copy the secret value immediately (you won't see it again)

### Step 3: Configure API Permissions

1. Go to "API permissions"
2. Click "Add a permission"
3. Select "Microsoft Graph"
4. Select "Delegated permissions"
5. Add these permissions:
   - `POP.AccessAsUser.All`
   - `offline_access`
6. Click "Add permissions"
7. Click "Grant admin consent" (if you're an admin)

### Step 4: Get Refresh Token

Use this Python script:

```python
#!/usr/bin/env python3
import msal
import json

# Your credentials from Steps 1-2
CLIENT_ID = 'your-client-id'
CLIENT_SECRET = 'your-client-secret'
TENANT_ID = 'common'  # or your specific tenant ID

# Outlook POP3 scope
SCOPES = ['https://outlook.office365.com/POP.AccessAsUser.All', 'offline_access']

# Create MSAL app
app = msal.PublicClientApplication(
    CLIENT_ID,
    authority=f"https://login.microsoftonline.com/{TENANT_ID}"
)

# Get token interactively
result = app.acquire_token_interactive(scopes=SCOPES)

if "access_token" in result:
    print("\n=== OAuth2 Credentials ===")
    print(f"Access Token: {result['access_token'][:50]}...")
    print(f"Refresh Token: {result.get('refresh_token', 'N/A')}")
    print(f"Token Expiry: {result.get('expires_in')} seconds")
    print("\nAdd these to your .env file:")
    print(f"POP3_PROVIDER=outlook")
    print(f"POP3_OAUTH2_CLIENT_ID={CLIENT_ID}")
    print(f"POP3_OAUTH2_CLIENT_SECRET={CLIENT_SECRET}")
    print(f"POP3_OAUTH2_REFRESH_TOKEN={result.get('refresh_token')}")
    print(f"POP3_OAUTH2_TENANT_ID={TENANT_ID}")
else:
    print("Error:", result.get("error"))
    print("Description:", result.get("error_description"))
```

Install dependencies:
```bash
pip install msal
```

Run the script:
```bash
python3 get_outlook_token.py
```

### Step 5: Configure .env

Add to your `.env` file:

```env
POP3_PROVIDER=outlook
POP3_EMAIL=your.email@outlook.com
POP3_OAUTH2_CLIENT_ID=your-client-id
POP3_OAUTH2_CLIENT_SECRET=your-client-secret
POP3_OAUTH2_REFRESH_TOKEN=your-refresh-token
POP3_OAUTH2_TENANT_ID=common
```

---

## Testing OAuth2 Configuration

After configuration, restart the bridge and check the logs:

```bash
npm run dev
```

Look for these log messages:
```
Initializing Gmail OAuth2 provider
# or
Initializing Outlook OAuth2 provider
```

When 2FA is triggered, you should see:
```
Using OAuth2 XOAUTH2 authentication
POP3 authentication successful
```

---

## Troubleshooting

### Gmail: "Invalid credentials"
- Verify your Client ID and Client Secret
- Ensure Gmail API is enabled in Google Cloud Console
- Check that your refresh token hasn't expired
- Make sure you added your email to test users in OAuth consent screen

### Outlook: "Authentication failed"
- Verify your Client ID and Client Secret
- Ensure API permissions are granted
- Check that `offline_access` scope is included
- Verify your tenant ID is correct

### "No refresh token received"
- For Gmail: Ensure you're using "Desktop app" type
- For Outlook: Ensure `offline_access` scope is included
- Try revoking and re-authorizing the application

### Fallback to Basic Auth
If OAuth2 fails, the bridge will automatically fall back to basic authentication if `POP3_PASSWORD` is configured.

---

## Security Notes

1. **Keep Secrets Safe**: Never commit `.env` file to version control
2. **Rotate Tokens**: Periodically rotate your client secrets
3. **Revoke Access**: If compromised, revoke tokens in Google/Azure console
4. **Minimal Permissions**: Only grant POP3 access, not full email access

---

## Alternative: Continue Using Basic Auth

If OAuth2 setup is too complex, you can continue using basic authentication:

```env
POP3_PROVIDER=basic
POP3_EMAIL=your.email@gmx.com
POP3_PASSWORD=your_password
POP3_HOST=pop.gmx.com
POP3_PORT=995
POP3_SECURE=true
```

**Note**: Gmail and Outlook require "App Passwords" for basic auth:
- Gmail: [Create App Password](https://myaccount.google.com/apppasswords)
- Outlook: [Create App Password](https://account.microsoft.com/security)
