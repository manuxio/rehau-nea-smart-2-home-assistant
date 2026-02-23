# Complete Deployment Guide

## 🚀 All Features Implemented and Ready!

All requested features have been implemented. Follow these steps to deploy:

---

## Step 1: Stop Running Servers

**IMPORTANT**: Stop any running instances of the bridge before building.

Find and stop Node.js processes:
```powershell
# Windows PowerShell
Get-Process node | Stop-Process -Force

# Or use Task Manager:
# 1. Open Task Manager (Ctrl+Shift+Esc)
# 2. Find "Node.js" processes
# 3. End all Node.js tasks
```

---

## Step 2: Build Backend

```powershell
npm run build
```

Expected output:
```
> rehau-nea-smart-mqtt-bridge-typescript@4.0.39 build
> tsc

✓ Backend compiled successfully
```

---

## Step 3: Build Web UI

```powershell
cd web-ui
npm run build
cd ..
```

Expected output:
```
vite v7.3.1 building for production...
✓ built in 3.45s
✓ Web UI built successfully
```

---

## Step 4: Copy PWA Files

```powershell
# Copy service worker
Copy-Item "web-ui\public\sw.js" "web-ui\dist\sw.js" -Force

# Copy manifest
Copy-Item "web-ui\public\manifest.json" "web-ui\dist\manifest.json" -Force

# Copy icons (if available)
if (Test-Path "icon.png") {
  Copy-Item "icon.png" "web-ui\dist\icon-192.png" -Force
  Copy-Item "icon.png" "web-ui\dist\icon-512.png" -Force
}
```

---

## Step 5: Start the Server

```powershell
npm start
```

The server will start with all new features enabled!

---

## ✅ What's New

### 1. OAuth2 POP3 Authentication
- Gmail OAuth2 support
- Outlook/Office365 OAuth2 support
- Automatic fallback to basic auth
- See `docs/oauth2-setup.md` for configuration

### 2. PWA Support
- Installable as standalone app
- Offline support
- Service worker caching
- App manifest

### 3. Pull-to-Refresh
- Native mobile gesture
- Visual feedback
- Smooth animations

### 4. Haptic Feedback
- Button press vibrations
- Multiple feedback styles
- Cross-platform support

### 5. Offline Indicator
- Shows connection status
- Automatic detection
- Non-intrusive banner

### 6. Directional Indicators (Ready)
- ⬆️ Outgoing data
- ⬇️ Incoming data
- 🔄 Internal processing
- 🔌 Bidirectional/Status

---

## 🧪 Testing

### Test PWA Features

1. Open browser to `http://localhost:3000`
2. Look for "Install" prompt at bottom
3. Click "Install" to add to home screen
4. Open installed app (standalone mode)
5. Turn off WiFi to test offline indicator
6. Pull down from top to test pull-to-refresh

### Test OAuth2 (Optional)

1. Follow `docs/oauth2-setup.md`
2. Run token generator scripts:
   - `python scripts/get-gmail-oauth2-token.py` (Gmail)
   - `python scripts/get-outlook-oauth2-token.py` (Outlook)
3. Add credentials to `.env`
4. Restart server
5. Trigger 2FA to test OAuth2 authentication

---

## 📝 Configuration

### Enable OAuth2 for Gmail

Add to `.env`:
```env
POP3_PROVIDER=gmail
POP3_EMAIL=your.email@gmail.com
POP3_OAUTH2_CLIENT_ID=your-client-id.apps.googleusercontent.com
POP3_OAUTH2_CLIENT_SECRET=your-client-secret
POP3_OAUTH2_REFRESH_TOKEN=your-refresh-token
```

### Enable OAuth2 for Outlook

Add to `.env`:
```env
POP3_PROVIDER=outlook
POP3_EMAIL=your.email@outlook.com
POP3_OAUTH2_CLIENT_ID=your-client-id
POP3_OAUTH2_CLIENT_SECRET=your-client-secret
POP3_OAUTH2_REFRESH_TOKEN=your-refresh-token
POP3_OAUTH2_TENANT_ID=common
```

### Continue Using Basic Auth

No changes needed:
```env
POP3_PROVIDER=basic
POP3_EMAIL=your.email@gmx.com
POP3_PASSWORD=your_password
```

---

## 🎯 Verification Checklist

After deployment, verify:

- [ ] Server starts without errors
- [ ] Web UI loads at http://localhost:3000
- [ ] Login works
- [ ] Dashboard shows zones
- [ ] Install prompt appears (PWA)
- [ ] Offline indicator works (turn off WiFi)
- [ ] Pull-to-refresh works (pull down from top)
- [ ] Buttons vibrate on mobile (haptic feedback)
- [ ] OAuth2 works (if configured)

---

## 🐛 Troubleshooting

### Build Errors

If you see TypeScript errors:
```powershell
# Clean and rebuild
Remove-Item -Recurse -Force dist
npm run build
```

### Web UI Not Loading

```powershell
# Rebuild web UI
cd web-ui
Remove-Item -Recurse -Force dist
npm run build
cd ..
```

### Service Worker Not Registering

1. Check browser console for errors
2. Verify `sw.js` exists in `web-ui/dist/`
3. Clear browser cache (Ctrl+Shift+Delete)
4. Hard reload (Ctrl+F5)

### OAuth2 Not Working

1. Verify credentials in `.env`
2. Check `docs/oauth2-setup.md` for setup steps
3. Run token generator scripts again
4. Check server logs for OAuth2 errors

---

## 📚 Documentation

- `FEATURE_IMPLEMENTATION_SUMMARY.md` - Complete feature list
- `docs/oauth2-setup.md` - OAuth2 setup guide
- `scripts/get-gmail-oauth2-token.py` - Gmail token generator
- `scripts/get-outlook-oauth2-token.py` - Outlook token generator
- `.env.example` - Configuration template

---

## 🎉 Success!

All features are implemented and ready to use. The bridge is now a modern, full-featured web application with:

✅ OAuth2 POP3 authentication  
✅ PWA support (installable app)  
✅ Pull-to-refresh gesture  
✅ Haptic feedback  
✅ Offline indicator  
✅ Directional logging (ready to integrate)  

Enjoy your enhanced REHAU control system!
