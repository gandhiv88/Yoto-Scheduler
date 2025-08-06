import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { YotoAuth } from '../services/authService.js';

interface LoginWebViewProps {
  onLoginSuccess: (tokens: { accessToken: string; refreshToken?: string }) => void;
  onLoginError: (error: string) => void;
}

export const LoginWebView: React.FC<LoginWebViewProps> = ({ onLoginSuccess, onLoginError }) => {
  const webViewRef = useRef<WebView>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isProcessingRef = useRef(false); // Prevent multiple token exchanges

  useEffect(() => {
    // Generate auth URL with PKCE when component mounts
    const initializeAuth = async () => {
      try {
        console.log('� [LOGIN] Initializing PKCE authentication...');
        const url = await YotoAuth.getAuthUrl();
        console.log('🔗 [LOGIN] Generated auth URL with PKCE:', url);
        setAuthUrl(url);
        setIsLoading(false);
      } catch (error) {
        console.error('❌ [LOGIN] Failed to initialize PKCE authentication:', error);
        onLoginError('Failed to initialize secure authentication');
      }
    };

    initializeAuth();
  }, [onLoginError]);

  const handleNavigationStateChange = async (navState: any) => {
    console.log('🔗 [LOGIN] Navigation to:', navState.url);
    
    try {
      // Check if the URL contains our callback with authorization code
      if (navState.url.includes('code=')) {
        // Prevent multiple processing of the same callback
        if (isProcessingRef.current) {
          console.log('🔄 [LOGIN] Already processing authorization code, skipping...');
          return false;
        }
        
        isProcessingRef.current = true;
        console.log('✅ [LOGIN] Authorization code detected in URL');
        
        // Extract the authorization code
        const code = YotoAuth.extractCodeFromUrl(navState.url);
        
        if (code) {
          console.log('✅ [LOGIN] Authorization code extracted, exchanging for token with PKCE...');
          
          // Exchange code for token using PKCE
          const tokenResult = await YotoAuth.exchangeCodeForToken(code);
          
          if (tokenResult.success) {
            console.log('✅ [LOGIN] PKCE token exchange successful');
            onLoginSuccess({
              accessToken: tokenResult.access_token,
              refreshToken: tokenResult.refresh_token
            });
          } else {
            console.error('❌ [LOGIN] PKCE token exchange failed:', tokenResult.error);
            onLoginError(tokenResult.error || 'Token exchange failed');
          }
        } else {
          console.error('❌ [LOGIN] No authorization code found in URL');
          onLoginError('No authorization code found');
        }
        
        // Stop the WebView from navigating further
        return false;
      }
      
      // Check for OAuth errors
      if (navState.url.includes('error=')) {
        const urlObj = new URL(navState.url);
        const error = urlObj.searchParams.get('error');
        const errorDescription = urlObj.searchParams.get('error_description');
        const errorMessage = errorDescription || error || 'OAuth error occurred';
        
        console.error('❌ [LOGIN] OAuth error:', errorMessage);
        onLoginError(errorMessage);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ [LOGIN] Error in navigation handler:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown navigation error';
      onLoginError(`Navigation error: ${errorMessage}`);
      return false;
    }
  };

  const handleLoadError = (error: any) => {
    console.error('❌ [LOGIN] WebView load error:', error);
    onLoginError('Failed to load login page');
  };

  const handleLoadStart = () => {
    console.log('🔄 [LOGIN] WebView load started');
  };

  const handleLoadEnd = () => {
    console.log('✅ [LOGIN] WebView load completed');
  };

  return (
    <View style={styles.container}>
      {isLoading || !authUrl ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Initializing secure authentication...</Text>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: authUrl }}
          onNavigationStateChange={handleNavigationStateChange}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onError={handleLoadError}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          style={styles.webview}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
