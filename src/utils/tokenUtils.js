import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';

const ACCESS_TOKEN_KEY = 'yoto_access_token';
const REFRESH_TOKEN_KEY = 'yoto_refresh_token';

/**
 * Check if a token is expired
 */
export function isTokenExpired(token) {
  if (!token) {
    return true;
  }

  try {
    const decodedToken = jwtDecode(token);
    return Date.now() >= (decodedToken.exp ?? 0) * 1000;
  } catch (error) {
    console.error('Error decoding token:', error);
    return true;
  }
}

/**
 * Store tokens securely
 */
export async function storeTokens(accessToken, refreshToken) {
  try {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    }
    console.log('✅ [TOKEN] Tokens stored successfully');
  } catch (error) {
    console.error('❌ [TOKEN] Failed to store tokens:', error);
    throw error;
  }
}

/**
 * Get stored tokens
 */
export async function getStoredTokens() {
  try {
    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    return { accessToken, refreshToken };
  } catch (error) {
    console.error('❌ [TOKEN] Failed to get stored tokens:', error);
    return { accessToken: null, refreshToken: null };
  }
}

/**
 * Clear all stored tokens
 */
export async function clearTokens() {
  try {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    console.log('✅ [TOKEN] Tokens cleared successfully');
  } catch (error) {
    console.error('❌ [TOKEN] Failed to clear tokens:', error);
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken, clientId) {
  console.log('🔄 [TOKEN] Refreshing access token...');

  try {
    const response = await fetch('https://login.yotoplay.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        refresh_token: refreshToken,
        audience: 'https://api.yotoplay.com',
        scope: 'offline_access read:devices write:devices',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [TOKEN] Failed to refresh token:', response.status, errorText);
      throw new Error(`Failed to refresh token: ${response.status} ${errorText}`);
    }

    const { access_token, refresh_token } = await response.json();
    console.log('✅ [TOKEN] Token refresh successful');

    // Use new refresh token if provided, otherwise keep the old one
    const newRefreshToken = refresh_token || refreshToken;
    await storeTokens(access_token, newRefreshToken);
    
    return { accessToken: access_token, refreshToken: newRefreshToken };
  } catch (error) {
    console.error('❌ [TOKEN] Token refresh failed:', error);
    throw error;
  }
}

/**
 * Get a valid access token (refresh if necessary)
 */
export async function getValidAccessToken(clientId) {
  try {
    const { accessToken, refreshToken } = await getStoredTokens();

    if (!accessToken) {
      console.log('ℹ️ [TOKEN] No access token found');
      return null;
    }

    // If access token is not expired, return it
    if (!isTokenExpired(accessToken)) {
      console.log('✅ [TOKEN] Access token is valid');
      return accessToken;
    }

    // Access token is expired, try to refresh it
    console.log('⚠️ [TOKEN] Access token expired, attempting refresh...');
    
    if (!refreshToken) {
      console.log('❌ [TOKEN] No refresh token available');
      await clearTokens();
      return null;
    }

    try {
      const { accessToken: newAccessToken } = await refreshAccessToken(refreshToken, clientId);
      return newAccessToken;
    } catch (error) {
      console.error('❌ [TOKEN] Token refresh failed, clearing tokens');
      await clearTokens();
      return null;
    }
  } catch (error) {
    console.error('❌ [TOKEN] Failed to get valid access token:', error);
    return null;
  }
}

/**
 * Exchange authorization code for tokens using PKCE
 */
export async function exchangeCodeForTokens(code, codeVerifier, clientId, redirectUri) {
  console.log('🔄 [TOKEN] Exchanging authorization code for tokens using PKCE...');

  try {
    const response = await fetch('https://login.yotoplay.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        code_verifier: codeVerifier,
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [TOKEN] Failed to exchange code for tokens:', response.status, errorText);
      throw new Error(`Failed to exchange code for tokens: ${response.status} ${errorText}`);
    }

    const { access_token, refresh_token } = await response.json();
    console.log('✅ [TOKEN] Token exchange successful');

    await storeTokens(access_token, refresh_token);
    
    return { accessToken: access_token, refreshToken: refresh_token };
  } catch (error) {
    console.error('❌ [TOKEN] Token exchange failed:', error);
    throw error;
  }
}
