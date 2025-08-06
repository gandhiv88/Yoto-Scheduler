# Ambient Light 403 Error Troubleshooting Guide

## Problem
The app is receiving 403 (Forbidden) errors when trying to control ambient lighting through the Yoto API and MQTT.

## Root Cause Analysis
Based on the logs, the issue appears to be **insufficient OAuth scopes** in the authentication token. The app was only requesting `offline_access` scope, but controlling Yoto devices requires additional permissions.

## Solution Applied

### 1. **Updated OAuth Scopes**
Changed the OAuth scope from:
```javascript
scope: 'offline_access'
```

To:
```javascript
scope: 'offline_access read:devices write:devices'
```

### 2. **Enhanced Error Handling**
- Added specific 403 error detection in ambient light controls
- Implemented automatic reconnection with fresh tokens
- Added connection test functionality

### 3. **Improved MQTT Client**
- Enhanced token validation and error reporting
- Better color conversion (hex to RGB with brightness scaling)
- Connection health monitoring

## Required Actions

### **IMPORTANT: Re-authenticate Required**
Since the OAuth scopes have changed, you **MUST** log out and log back in to get a new token with the correct permissions.

**Steps to resolve:**
1. **Log out** from the app completely
2. **Log back in** - this will request a new token with `read:devices write:devices` permissions
3. **Connect to your Yoto player**
4. **Try the ambient light controls**

### Test Sequence
1. **Authentication Test**
   - Log out completely
   - Log back in with new scopes
   - Verify no 403 errors in console

2. **Connection Test**
   - Connect to Yoto player
   - Use the "Test Connection" button in Ambient Light Control
   - Check for successful MQTT connection

3. **Ambient Light Test**
   - Try setting different colors and brightness levels
   - Test quick action buttons (Warm Reading Light, Sleep Time, Play Time)
   - Verify night light toggle functionality

## Diagnostic Information

### OAuth Scopes Explained
- `offline_access`: Allows refresh tokens for persistent sessions
- `read:devices`: Allows reading device information and status
- `write:devices`: **REQUIRED** for sending commands to devices (including ambient light)

### Common 403 Error Causes
1. **Missing scopes** (Fixed in this update)
2. **Expired tokens** (Handled by automatic refresh)
3. **Account permissions** (User must have device control rights)
4. **Device association** (Device must be properly linked to user account)

### Verification Steps
Check the browser console/app logs for:
- ✅ `🔐 [PKCE] Using PKCE-enabled OAuth flow` with new scopes
- ✅ `✅ [TOKEN] Access token is valid`
- ✅ `✅ [MQTT] Connected successfully`
- ❌ No more `API request failed: 403` errors

## Code Changes Made

### 1. Enhanced AmbientLightControl.tsx
- Better error messages for 403 errors
- Automatic reconnection prompts
- Connection test functionality
- Improved retry mechanisms

### 2. Updated authService.js
- Added device control scopes to all OAuth flows
- Enhanced PKCE implementation with proper permissions

### 3. Enhanced mqttService.js
- Better ambient light color conversion
- Improved error handling and logging
- Connection health monitoring

### 4. Updated tokenUtils.js
- Added device scopes to token refresh requests
- Better token validation

## Expected Results After Fix
- No more 403 errors when controlling ambient lights
- Successful MQTT command publishing
- Proper color and brightness control
- Working quick action buttons
- Functional night light controls

## Troubleshooting if Issues Persist

### If 403 errors continue:
1. **Clear app storage completely**
   ```bash
   # Clear Expo secure storage
   # Log out and restart the app
   ```

2. **Check Yoto account permissions**
   - Ensure your Yoto account has device control rights
   - Verify the device is properly associated with your account

3. **Verify client ID registration**
   - The client ID `NJ4lW4Y3FrBcpR4R6YlkKs30gTxPjvC4` must be registered with correct scopes in Yoto's OAuth system

### Additional Debugging
Enable detailed logging by checking browser console for:
- Token scope validation
- MQTT connection details
- API request headers and responses

---

**Remember: The key fix is logging out and logging back in to get a new token with the correct `read:devices write:devices` scopes!**
