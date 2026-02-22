#!/usr/bin/env python3
"""
Outlook/Office365 OAuth2 Token Generator
Generates refresh token for Outlook POP3 access
"""

import msal

def main():
    print("=== Outlook/Office365 OAuth2 Token Generator ===\n")
    
    # Get credentials from user
    client_id = input("Enter your Client ID (Application ID): ").strip()
    client_secret = input("Enter your Client Secret: ").strip()
    tenant_id = input("Enter your Tenant ID (or 'common' for personal accounts) [common]: ").strip() or "common"
    
    # Outlook POP3 scopes
    SCOPES = ['https://outlook.office365.com/POP.AccessAsUser.All', 'offline_access']
    
    # Create MSAL app
    app = msal.PublicClientApplication(
        client_id,
        authority=f"https://login.microsoftonline.com/{tenant_id}"
    )
    
    print("\nStarting OAuth2 flow...")
    print("A browser window will open. Please authorize the application.\n")
    
    # Get token interactively
    result = app.acquire_token_interactive(scopes=SCOPES)
    
    if "access_token" in result:
        print("\n" + "="*60)
        print("SUCCESS! OAuth2 credentials obtained")
        print("="*60)
        print(f"\nAccess Token: {result['access_token'][:50]}...")
        
        if 'refresh_token' in result:
            print(f"Refresh Token: {result['refresh_token']}")
        else:
            print("Refresh Token: NOT RECEIVED")
            print("WARNING: Make sure 'offline_access' scope is included!")
        
        print(f"Token Expiry: {result.get('expires_in')} seconds")
        
        print("\n" + "="*60)
        print("Add these lines to your .env file:")
        print("="*60)
        print(f"POP3_PROVIDER=outlook")
        print(f"POP3_EMAIL=your.email@outlook.com")
        print(f"POP3_OAUTH2_CLIENT_ID={client_id}")
        print(f"POP3_OAUTH2_CLIENT_SECRET={client_secret}")
        
        if 'refresh_token' in result:
            print(f"POP3_OAUTH2_REFRESH_TOKEN={result['refresh_token']}")
        else:
            print(f"POP3_OAUTH2_REFRESH_TOKEN=<NOT_RECEIVED>")
        
        print(f"POP3_OAUTH2_TENANT_ID={tenant_id}")
        print("="*60)
    else:
        print("\n" + "="*60)
        print("ERROR: Failed to obtain OAuth2 credentials")
        print("="*60)
        print(f"Error: {result.get('error')}")
        print(f"Description: {result.get('error_description')}")
        print("\nPlease check:")
        print("1. Client ID and Client Secret are correct")
        print("2. API permissions are granted in Azure Portal")
        print("3. 'offline_access' scope is included")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nCancelled by user")
    except Exception as e:
        print(f"\nError: {e}")
        print("\nMake sure you have installed the required package:")
        print("  pip install msal")
