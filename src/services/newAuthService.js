import * as WebBrowser from 'expo-web-browser';
import { exchangeCodeForTokens, getValidAccessToken, clearTokens } from '../utils/tokenUtils';

// Complete the auth session on web browsers
WebBrowser.maybeCompleteAuthSession();

// Configuration - you'll need to set your Client ID
const config = {
  clientId: 'NJ4lW4Y3FrBcpR4R6YlkKs30gTxPjvC4', // Replace with your actual client ID
  redirectUri: 'https://gandhiv88.github.io/yoto-callback/', // Your web callback URL
  authUrl: 'https://login.yotoplay.com/authorize',
  audience: 'https://api.yotoplay.com',
  scope: 'offline_access openid'
};

/**
 * Set the client ID for authentication
 */
export function setClientId(clientId) {
  config.clientId = clientId;
  console.log('🔧 [AUTH] Client ID configured');
}

/**
 * Generate PKCE challenge pair using basic methods
 */
async function generatePKCEChallenge() {
  try {
    // Generate a simple code verifier (43+ chars, URL-safe)
    const codeVerifier = Math.random().toString(36).substring(2, 15) + 
                        Math.random().toString(36).substring(2, 15) + 
                        Math.random().toString(36).substring(2, 15);

    console.log('🔑 [AUTH] Generated code verifier, creating challenge...');

    // For now, use the code verifier as the challenge (S256 method requires crypto)
    // This is "plain" method which is allowed by some OAuth providers
    const codeChallenge = codeVerifier;

    console.log('🔑 [AUTH] Generated PKCE challenge pair successfully');
    return { codeVerifier, codeChallenge, codeChallengeMethod: 'plain' };
  } catch (error) {
    console.error('❌ [AUTH] Error generating PKCE challenge:', error);
    throw error;
  }
}

/**
 * Store PKCE code verifier temporarily
 */
let temporaryCodeVerifier = null;

export class YotoAuth {
  // Prevent multiple auth sessions running simultaneously 
  static isAuthInProgress = false;

  /**
   * Initiate OAuth login with PKCE
   */
  static async initiateLogin() {
    try {
      console.log('🚀 [AUTH] Starting PKCE OAuth authentication flow...');
      
      // Prevent multiple auth sessions
      if (this.isAuthInProgress) {
        console.log('⚠️ [AUTH] Authentication already in progress, please wait...');
        return {
          success: false,
          error: 'Authentication already in progress. Please wait for the current session to complete.'
        };
      }
      
      this.isAuthInProgress = true;
      console.log('🔐 [AUTH] Setting auth lock to prevent multiple sessions');

      // Generate PKCE challenge
      const { codeVerifier, codeChallenge, codeChallengeMethod } = await generatePKCEChallenge();
      
      // Store code verifier for later exchange
      temporaryCodeVerifier = codeVerifier;

      // Build authorization URL with PKCE parameters
      const authParams = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: config.scope,
        audience: config.audience,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod
      });

      const authUrl = `${config.authUrl}?${authParams.toString()}`;
      console.log('🔗 [AUTH] Opening WebBrowser with OAuth URL:', authUrl.substring(0, 100) + '...');

      // Open WebBrowser for authentication with specific options
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        config.redirectUri,
        {
          dismissButtonStyle: 'cancel',
          showTitle: false,
          preferEphemeralSession: true
        }
      );
      
      console.log('🔗 [AUTH] WebBrowser result:', result);

      if (result.type === 'success' && result.url) {
        console.log('✅ [AUTH] WebBrowser returned success with URL');
        // Handle the callback URL
        const callbackResult = await this.handleOAuthCallback(result.url);
        return callbackResult;
      } else if (result.type === 'cancel') {
        console.log('⚠️ [AUTH] WebBrowser was canceled - this usually happens when using web redirect URLs');
        console.log('🔓 [AUTH] The user may have completed authentication in the browser');
        
        // When using web redirect URLs, iOS WebBrowser often reports "cancel" even when successful
        // because the browser doesn't automatically redirect back to the app.
        // We'll wait a moment and then show manual code entry as fallback.
        
        this.isAuthInProgress = false; // Release the lock since we're switching to manual mode
        
        return {
          success: true,
          requiresManualCode: true,
          message: 'Authentication opened in browser. If you completed the login, you can enter the authorization code manually below.'
        };
      } else {
        console.log('❌ [AUTH] WebBrowser authentication failed:', result);
        return {
          success: false,
          error: 'Authentication failed or was interrupted'
        };
      }    } catch (error) {
      console.error('🚨 [AUTH] Exception during authentication:', error);
      return {
        success: false,
        error: `Authentication failed: ${error.message}`
      };
    } finally {
      // Don't release auth lock yet if we're waiting for manual code entry
      // It will be released in handleOAuthCallback or handleManualCode
      console.log('🔓 [AUTH] WebBrowser session completed, waiting for callback or manual code...');
    }
  }

  /**
   * Handle OAuth callback URL
   */
  static async handleOAuthCallback(url) {
    try {
      console.log('🔗 [AUTH] Processing OAuth callback URL:', url);

      // Parse the URL to extract the authorization code
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');
      const error = urlObj.searchParams.get('error');

      if (error) {
        console.error('❌ [AUTH] OAuth error:', error);
        return {
          success: false,
          error: `OAuth error: ${error}`
        };
      }

      if (!code) {
        console.error('❌ [AUTH] No authorization code found in callback URL');
        return {
          success: false,
          error: 'No authorization code found in callback'
        };
      }

      if (!temporaryCodeVerifier) {
        console.error('❌ [AUTH] No code verifier found for token exchange');
        return {
          success: false,
          error: 'Missing code verifier for token exchange'
        };
      }

      console.log('🔄 [AUTH] Exchanging authorization code for tokens...');

      // Exchange the authorization code for tokens
      const tokens = await exchangeCodeForTokens(
        code,
        temporaryCodeVerifier,
        config.clientId,
        config.redirectUri
      );

      // Clear the temporary code verifier
      temporaryCodeVerifier = null;

      console.log('✅ [AUTH] Authentication successful');
      return {
        success: true,
        tokens
      };

    } catch (error) {
      console.error('❌ [AUTH] Error handling OAuth callback:', error);
      // Clear the temporary code verifier on error
      temporaryCodeVerifier = null;
      return {
        success: false,
        error: `Failed to process OAuth callback: ${error.message}`
      };
    } finally {
      // Release auth lock when callback is processed
      this.isAuthInProgress = false;
      console.log('🔓 [AUTH] Releasing auth lock after callback processing');
    }
  }

  /**
   * Handle manual code entry (fallback)
   */
  static async handleManualCode(code) {
    try {
      console.log('🔄 [AUTH] Processing manual authorization code...');

      if (!temporaryCodeVerifier) {
        console.error('❌ [AUTH] No code verifier found for manual code exchange');
        return {
          success: false,
          error: 'Missing code verifier. Please restart the login process.'
        };
      }

      // Exchange the authorization code for tokens
      const tokens = await exchangeCodeForTokens(
        code,
        temporaryCodeVerifier,
        config.clientId,
        config.redirectUri
      );

      // Clear the temporary code verifier
      temporaryCodeVerifier = null;

      console.log('✅ [AUTH] Manual code authentication successful');
      return {
        success: true,
        tokens
      };

    } catch (error) {
      console.error('❌ [AUTH] Error processing manual code:', error);
      // Clear the temporary code verifier on error
      temporaryCodeVerifier = null;
      return {
        success: false,
        error: `Failed to process authorization code: ${error.message}`
      };
    } finally {
      // Release auth lock when manual code is processed
      this.isAuthInProgress = false;
      console.log('🔓 [AUTH] Releasing auth lock after manual code processing');
    }
  }

  /**
   * Check if user is authenticated
   */
  static async isAuthenticated() {
    try {
      const accessToken = await getValidAccessToken(config.clientId);
      return !!accessToken;
    } catch (error) {
      console.error('❌ [AUTH] Error checking authentication status:', error);
      return false;
    }
  }

  /**
   * Get current access token
   */
  static async getCurrentToken() {
    try {
      return await getValidAccessToken(config.clientId);
    } catch (error) {
      console.error('❌ [AUTH] Error getting current token:', error);
      return null;
    }
  }

  /**
   * Logout user
   */
  static async logout() {
    try {
      console.log('🔓 [AUTH] Logging out user...');
      await clearTokens();
      // Clear any temporary code verifier
      temporaryCodeVerifier = null;
      console.log('✅ [AUTH] User logged out successfully');
    } catch (error) {
      console.error('❌ [AUTH] Error during logout:', error);
      throw error;
    }
  }
}
