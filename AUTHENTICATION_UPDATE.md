# Yoto MQTT Controller - Updated Authentication

This version implements the official Yoto authentication system using **PKCE (Proof Key for Code Exchange)** for secure OAuth login, based on the official Yoto examples.

## 🔧 Setup Instructions

### 1. Get Your Yoto Client ID

1. Go to [https://yoto.dev/](https://yoto.dev/)
2. Sign up/login with your Yoto account
3. Create a new application
4. Copy your **Client ID** (you won't need a client secret)

### 2. Configure the App

1. Open `src/services/newAuthService.js`
2. Replace `'your_client_id_here'` with your actual Client ID:
   ```javascript
   let CLIENT_ID = 'your_actual_client_id_here';
   ```

3. Or alternatively, update `App.tsx` line 23:
   ```typescript
   const CLIENT_ID = 'your_actual_client_id_here';
   ```

### 3. Configure OAuth Redirect URI

In your Yoto developer settings, add this redirect URI:
```
com.gvalliappan.yotoscheduler://oauth
```

## 🚀 New Features

### Secure Authentication
- **PKCE OAuth Flow** - More secure than client secret
- **Automatic Token Refresh** - Seamless user experience
- **Secure Token Storage** - Uses Expo SecureStore
- **Session Management** - Automatic logout on token expiration

### Improved API Integration
- **Automatic Token Management** - APIs handle token refresh automatically
- **Better Error Handling** - Clear feedback for expired sessions
- **No Manual Token Passing** - APIs get tokens automatically

### User Experience
- **One-Click Login** - Opens Yoto's official login page
- **Persistent Sessions** - Stay logged in between app restarts
- **Clean Logout** - Properly clears all tokens and connections

## 🔄 How It Works

### Login Flow
1. User taps "Login with Yoto"
2. App generates PKCE challenge and redirects to Yoto login
3. User authenticates with Yoto
4. Yoto redirects back to app with authorization code
5. App exchanges code for access + refresh tokens
6. Tokens stored securely, user is logged in

### API Calls
1. App automatically gets valid access token
2. If token is expired, app refreshes it automatically
3. If refresh fails, user is prompted to log in again
4. All API calls handle authentication seamlessly

### Token Management
- **Access tokens** expire after ~24 hours
- **Refresh tokens** allow automatic renewal
- **Secure storage** using Expo SecureStore
- **Automatic cleanup** on logout

## 📱 Testing

1. Make sure you've set your Client ID
2. Run the app: `npx expo start`
3. Tap "Login with Yoto"
4. Complete login in the browser
5. App should automatically return and load your players

## 🔒 Security Features

- **PKCE** prevents authorization code interception
- **No client secret** needed in the app
- **Secure token storage** using device keychain/keystore
- **Automatic token refresh** prevents expired sessions
- **Proper logout** clears all tokens

## 🛠 Troubleshooting

### "No authorization code found"
- Check your redirect URI in Yoto developer settings
- Make sure it matches: `com.gvalliappan.yotoscheduler://oauth`

### "No valid token" errors
- Your Client ID might be wrong
- Check the console logs for authentication errors
- Try logging out and logging in again

### MQTT commands still getting 403 errors
- The API endpoint format might be incorrect
- Check the curl commands in console for manual testing
- Verify your player permissions in Yoto app

## 📚 Code Structure

### New Files
- `src/utils/tokenUtils.js` - Token management utilities
- `src/services/newAuthService.js` - PKCE OAuth implementation

### Updated Files
- `App.tsx` - New authentication flow
- `src/services/apiService.js` - Automatic token management

### Key Changes
- Removed manual token passing to API methods
- Added automatic token refresh
- Improved error handling for expired sessions
- Cleaner login/logout flow

This implementation follows the official Yoto examples and provides a more secure, user-friendly authentication experience!
