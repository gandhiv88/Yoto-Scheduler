import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { YotoAuth } from '../services/authService';
import { useSnackBarContext } from '../contexts/SnackBarContext';

interface AuthWebViewProps {
  onSuccess: (code: string) => void;
  onCancel: () => void;
}

export const AuthWebView: React.FC<AuthWebViewProps> = ({ onSuccess, onCancel }) => {
  const webViewRef = useRef<WebView>(null);
  const { showSuccess, showError, showWarning, showInfo } = useSnackBarContext();

  const handleNavigationStateChange = (navState: any) => {
    console.log('🌐 [WebView] Navigation to:', navState.url);
    
    // Check if this is our callback URL with a code parameter
    if (navState.url.includes('gandhiv88.github.io/yoto-callback/')) {
      try {
        const url = new URL(navState.url);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        
        if (error) {
          console.error('❌ [WebView] OAuth error:', error);
          showError(`OAuth error: ${error}`);
          onCancel();
          return false; // Prevent navigation
        }
        
        if (code) {
          console.log('✅ [WebView] Authorization code received, preventing navigation to callback page');
          onSuccess(code);
          return false; // Prevent navigation to callback page - just like Flutter!
        }
      } catch (err) {
        console.error('🚨 [WebView] Error parsing callback URL:', err);
      }
    }
    
    return true; // Allow navigation for other URLs
  };

  const handleError = (errorEvent: any) => {
    console.error('🚨 [WebView] WebView error:', errorEvent.nativeEvent);
    showError('Failed to load authentication page');
    onCancel();
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: YotoAuth.getAuthUrl() }}
        onNavigationStateChange={handleNavigationStateChange}
        onError={handleError}
        startInLoadingState={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        style={styles.webview}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
});
