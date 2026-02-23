#!/usr/bin/env python3
"""
Gmail OAuth2 Token Generator
Generates refresh token for Gmail POP3 access
"""

import json
from google_auth_oauthlib.flow import InstalledAppFlow

def main():
    print("=== Gmail OAuth2 Token Generator ===\n")
    
    # Get credentials from user
    client_id = input("Enter your Client ID: ").strip()
    client_secret = input("Enter your Client Secret: ").strip()
    
    # Gmail POP3 scope
    SCOPES = ['https://mail.google.com/']
    
    # Create flow
    flow = InstalledAppFlow.from_client_config(
        {
            "installed": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": ["http://localhost"]
            }
        },
        SCOPES
    )
    
    print("\nStarting OAuth2 flow...")
    print("A browser window will open. Please authorize the application.\n")
    
    # Run local server for OAuth flow
    creds = flow.run_local_server(port=0)
    
    print("\n" + "="*60)
    print("SUCCESS! OAuth2 credentials obtained")
    print("="*60)
    print(f"\nAccess Token: {creds.token[:50]}...")
    print(f"Refresh Token: {creds.refresh_token}")
    print(f"Token Expiry: {creds.expiry}")
    
    print("\n" + "="*60)
    print("Add these lines to your .env file:")
    print("="*60)
    print(f"POP3_PROVIDER=gmail")
    print(f"POP3_EMAIL=your.email@gmail.com")
    print(f"POP3_OAUTH2_CLIENT_ID={client_id}")
    print(f"POP3_OAUTH2_CLIENT_SECRET={client_secret}")
    print(f"POP3_OAUTH2_REFRESH_TOKEN={creds.refresh_token}")
    print("="*60)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nCancelled by user")
    except Exception as e:
        print(f"\nError: {e}")
        print("\nMake sure you have installed the required packages:")
        print("  pip install google-auth-oauthlib google-auth")
