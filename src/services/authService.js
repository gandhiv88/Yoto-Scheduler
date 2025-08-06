import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Crypto from 'expo-crypto';

// Complete the auth session on web browsers
WebBrowser.maybeCompleteAuthSession();

export class YotoAuth {
  static CLIENT_ID = 'NJ4lW4Y3FrBcpR4R6YlkKs30gTxPjvC4';
  static REDIRECT_URI = 'https://gandhiv88.github.io/yoto-callback/';
  static YOTO_AUTH_ENDPOINT = 'https://login.yotoplay.com/authorize';
  static YOTO_TOKEN_ENDPOINT = 'https://login.yotoplay.com/oauth/token';
  
  // Prevent multiple auth sessions running simultaneously 
  static isAuthInProgress = false;
  
  // Store PKCE values for the current session
  static currentCodeVerifier = null;
  static currentCodeChallenge = null;

  // Generate PKCE code verifier (random string)
  static async generateCodeVerifier() {
    // Generate a random string using Expo's random functionality
    // PKCE code verifier should be 43-128 characters, using URL-safe characters
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    
    let result = '';
    for (let i = 0; i < 43; i++) {  // Generate 43 character string
      result += charset[randomBytes[i % 32] % charset.length];
    }
    
    return result;
  }

  // Generate PKCE code challenge from verifier
  static async generateCodeChallenge(verifier) {
    try {
      console.log('🔐 [PKCE] Generating challenge for verifier:', verifier.substring(0, 10) + '...');
      
      // Try different approaches to make expo-crypto work
      console.log('🔍 [PKCE] Available digest algorithms:', Object.keys(Crypto.CryptoDigestAlgorithm || {}));
      
      let digest;
      
      // Try multiple algorithm formats
      const algorithmVariants = [
        Crypto.CryptoDigestAlgorithm?.SHA256,
        'SHA256',
        'sha256',
        'SHA-256'
      ];
      
      const encodingVariants = [
        Crypto.CryptoEncoding?.BASE64,
        'base64',
        'BASE64'
      ];
      
      for (const algorithm of algorithmVariants) {
        if (!algorithm) continue;
        
        for (const encoding of encodingVariants) {
          if (!encoding) continue;
          
          try {
            console.log(`🧪 [PKCE] Trying algorithm: ${algorithm}, encoding: ${encoding}`);
            digest = await Crypto.digestStringAsync(algorithm, verifier, { encoding });
            console.log('✅ [PKCE] Success with algorithm:', algorithm, 'encoding:', encoding);
            break;
          } catch (err) {
            console.log(`❌ [PKCE] Failed with algorithm: ${algorithm}, encoding: ${encoding}`);
            continue;
          }
        }
        
        if (digest) break;
      }
      
      if (!digest) {
        throw new Error('No working algorithm/encoding combination found');
      }
      
      console.log('🔐 [PKCE] Raw digest:', digest);
      
      // Convert standard base64 to base64url format
      const base64url = digest
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
        
      console.log('🔐 [PKCE] Base64URL challenge:', base64url);
      return base64url;
    } catch (error) {
      console.error('❌ [PKCE] Error generating code challenge:', error);
      throw error;
    }
  }

  // Get the OAuth URL for WebView with PKCE (fallback to standard OAuth if PKCE fails)
  static async getAuthUrl() {
    try {
      // Debug: Check what crypto is available
      console.log('🔍 [PKCE] Crypto module available:', !!Crypto);
      console.log('🔍 [PKCE] digestStringAsync available:', !!Crypto.digestStringAsync);
      console.log('🔍 [PKCE] getRandomBytesAsync available:', !!Crypto.getRandomBytesAsync);
      
      // Try to generate PKCE values
      try {
        this.currentCodeVerifier = await this.generateCodeVerifier();
        this.currentCodeChallenge = await this.generateCodeChallenge(this.currentCodeVerifier);
        
        console.log('🔐 [PKCE] Generated code verifier and challenge');
        console.log('🔐 [PKCE] Code verifier length:', this.currentCodeVerifier.length);
        console.log('🔐 [PKCE] Code challenge length:', this.currentCodeChallenge.length);
        
        // Build PKCE-enabled auth URL
        const authParams = new URLSearchParams({
          client_id: this.CLIENT_ID,
          redirect_uri: this.REDIRECT_URI,
          response_type: 'code',
          scope: 'offline_access read:devices write:devices',
          audience: 'https://api.yotoplay.com',
          code_challenge: this.currentCodeChallenge,
          code_challenge_method: 'S256'
        });
        
        console.log('✅ [PKCE] Using PKCE-enabled OAuth flow');
        return `${this.YOTO_AUTH_ENDPOINT}?${authParams.toString()}`;
      } catch (pkceError) {
        console.warn('⚠️ [PKCE] PKCE generation failed, falling back to standard OAuth:', pkceError.message);
        
        // Clear any partial PKCE state
        this.currentCodeVerifier = null;
        this.currentCodeChallenge = null;
        
        // Build standard OAuth URL without PKCE
        const authParams = new URLSearchParams({
          client_id: this.CLIENT_ID,
          redirect_uri: this.REDIRECT_URI,
          response_type: 'code',
          scope: 'offline_access read:devices write:devices',
          audience: 'https://api.yotoplay.com'
        });
        
        console.log('✅ [AUTH] Using standard OAuth flow (no PKCE)');
        return `${this.YOTO_AUTH_ENDPOINT}?${authParams.toString()}`;
      }
    } catch (error) {
      console.error('❌ [AUTH] Error generating auth URL:', error);
      throw error;
    }
  }

  // Extract authorization code from URL (similar to Flutter code)
  static extractCodeFromUrl(url) {
    try {
      if (url.includes('code=')) {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        const error = urlObj.searchParams.get('error');
        
        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }
        
        return code;
      }
      return null;
    } catch (error) {
      console.error('❌ [AUTH] Error extracting code from URL:', error);
      throw error;
    }
  }

  static async authenticate() {
    try {
      console.log('🚀 [AUTH] Starting OAuth authentication flow...');
      
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
      
      // Build authorization URL exactly as per Yoto documentation
      const authParams = new URLSearchParams({
        client_id: this.CLIENT_ID,
        redirect_uri: this.REDIRECT_URI,
        response_type: 'code',
        scope: 'offline_access read:devices write:devices',
        audience: 'https://api.yotoplay.com'
      });
      
      const authUrl = `${this.YOTO_AUTH_ENDPOINT}?${authParams.toString()}`;
      console.log('🔗 [AUTH] Opening auth URL:', authUrl);
      
      // Use the same pattern as Flutter - direct WebBrowser with custom scheme
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        this.REDIRECT_URI
      );
      
      console.log('📥 [AUTH] Auth result:', result);

      if (result.type === 'success' && result.url) {
        // Parse authorization code from callback URL
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        
        if (error) {
          console.error('❌ [AUTH] OAuth error:', error);
          return {
            success: false,
            error: `OAuth error: ${error}`
          };
        }
        
        if (!code) {
          console.error('❌ [AUTH] No authorization code received');
          return {
            success: false,
            error: 'No authorization code received'
          };
        }
        
        console.log('✅ [AUTH] Auth successful, exchanging code for token...');
        const tokenResult = await this.exchangeCodeForToken(code);
        
        if (tokenResult.success) {
          console.log('✅ [AUTH] Token exchange successful');
          return {
            success: true,
            token: tokenResult.access_token,
            refreshToken: tokenResult.refresh_token
          };
        } else {
          console.error('❌ [AUTH] Token exchange failed:', tokenResult.error);
          return {
            success: false,
            error: tokenResult.error || 'Token exchange failed'
          };
        }
      } else if (result.type === 'cancel') {
        console.log('🚫 [AUTH] Authentication cancelled by user');
        return {
          success: false,
          error: 'Authentication cancelled'
        };
      } else {
        console.error('🚨 [AUTH] Authentication failed with result:', result);
        return {
          success: false,
          error: 'Authentication failed'
        };
      }
    } catch (error) {
      console.error('🚨 [AUTH] Exception during authentication:', error);
      return {
        success: false,
        error: error.message || 'Unknown authentication error'
      };
    } finally {
      this.isAuthInProgress = false;
      console.log('🔓 [AUTH] Releasing auth lock');
    }
  }

  static async exchangeCodeForToken(code) {
    try {
      const isPkceFlow = !!this.currentCodeVerifier;
      const flowType = isPkceFlow ? 'PKCE' : 'standard OAuth';
      
      console.log(`💱 [TOKEN] Exchanging authorization code for access token with ${flowType}...`);
      console.log('💱 [TOKEN] Code received:', code ? 'YES' : 'NO');
      console.log('💱 [TOKEN] Code verifier available:', isPkceFlow ? 'YES' : 'NO');
      
      if (!code) {
        throw new Error('No authorization code provided');
      }
      
      // Build the request body based on flow type
      const tokenParams = {
        grant_type: 'authorization_code',
        client_id: this.CLIENT_ID,
        code: code,
        redirect_uri: this.REDIRECT_URI,
      };
      
      // Add PKCE verifier if available
      if (isPkceFlow) {
        tokenParams.code_verifier = this.currentCodeVerifier;
      }
      
      // Exchange code for token
      const response = await fetch(this.YOTO_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams(tokenParams).toString(),
      });

      const data = await response.json();
      console.log(`📊 [TOKEN] ${flowType} token exchange response:`, {
        status: response.status,
        hasAccessToken: !!data.access_token,
        hasRefreshToken: !!data.refresh_token,
        error: data.error,
        errorDescription: data.error_description
      });

      // Clear PKCE values after use (they're single-use)
      this.currentCodeVerifier = null;
      this.currentCodeChallenge = null;

      if (response.ok && data.access_token) {
        console.log(`✅ [TOKEN] ${flowType} token exchange successful`);
        return {
          success: true,
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_in: data.expires_in,
          token_type: data.token_type
        };
      } else {
        const errorMsg = data.error_description || data.error || `HTTP ${response.status}`;
        console.error(`❌ [TOKEN] ${flowType} token exchange failed:`, errorMsg);
        return {
          success: false,
          error: errorMsg
        };
      }
    } catch (error) {
      console.error('🚨 [TOKEN] Token exchange error:', error);
      // Clear PKCE values on error
      this.currentCodeVerifier = null;
      this.currentCodeChallenge = null;
      return {
        success: false,
        error: error.message || 'Token exchange failed'
      };
    }
  }

  // Additional methods for compatibility with App.tsx
  static setClientId(clientId) {
    this.CLIENT_ID = clientId;
  }

  static async isAuthenticated() {
    // Simple check - just return false for now since we're not storing tokens in this simple version
    return false;
  }

  static async getCurrentToken() {
    // Simple implementation - return null since we're not storing tokens
    return null;
  }

  static async initiateLogin() {
    return await this.authenticate();
  }

  static async handleOAuthCallback(url) {
    try {
      console.log('🔗 [AUTH] Processing OAuth callback URL:', url);
      
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

      console.log('✅ [AUTH] Auth code received, exchanging for token...');
      const tokenResult = await this.exchangeCodeForToken(code);
      
      if (tokenResult.success) {
        console.log('✅ [AUTH] Token exchange successful');
        return {
          success: true,
          tokens: {
            accessToken: tokenResult.access_token,
            refreshToken: tokenResult.refresh_token
          }
        };
      } else {
        console.error('❌ [AUTH] Token exchange failed:', tokenResult.error);
        return {
          success: false,
          error: tokenResult.error || 'Token exchange failed'
        };
      }
    } catch (error) {
      console.error('🚨 [AUTH] Exception during callback handling:', error);
      return {
        success: false,
        error: `Callback handling failed: ${error.message}`
      };
    } finally {
      this.isAuthInProgress = false;
    }
  }

  static async logout() {
    console.log('🔓 [AUTH] User logged out');
    // Clear PKCE state on logout
    this.currentCodeVerifier = null;
    this.currentCodeChallenge = null;
    this.isAuthInProgress = false;
    return { success: true };
  }

  static resetAuthLock() {
    console.log('🔓 [AUTH] Manually resetting auth lock...');
    this.isAuthInProgress = false;
    // Also clear PKCE state
    this.currentCodeVerifier = null;
    this.currentCodeChallenge = null;
  }

  static validateConfig() {
    const issues = [];
    
    if (!this.CLIENT_ID) {
      issues.push('CLIENT_ID is missing');
    }
    
    if (!this.REDIRECT_URI) {
      issues.push('REDIRECT_URI is missing');
    }
    
    if (!this.YOTO_AUTH_ENDPOINT) {
      issues.push('YOTO_AUTH_ENDPOINT is missing');
    }
    
    if (!this.YOTO_TOKEN_ENDPOINT) {
      issues.push('YOTO_TOKEN_ENDPOINT is missing');
    }
    
    return {
      isValid: issues.length === 0,
      issues: issues
    };
  }
}
