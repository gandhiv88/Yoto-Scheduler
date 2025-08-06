// Debug utility to log authentication configuration
export const debugAuth = () => {
  console.log('=== YOTO AUTH DEBUG INFO ===');
  console.log('Client ID:', 'NJ4lW4Y3FrBcpR4R6YlkKs30gTxPjvC4');
  console.log('Auth Endpoint:', 'https://login.yotoplay.com/authorize');
  console.log('Token Endpoint:', 'https://login.yotoplay.com/oauth/token');
  
  // This will show the actual redirect URI when called
  import('expo-auth-session').then(({ AuthSession }) => {
    const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });
    console.log('Redirect URI:', redirectUri);
    console.log('========================');
  });
};
