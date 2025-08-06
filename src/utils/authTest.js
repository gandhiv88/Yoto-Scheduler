// Quick test function to diagnose the "Type Locked" error
export const testAuthFlow = async () => {
  console.log('🧪 [TEST] Starting authentication flow test...');
  
  try {
    // Test 1: Check if the auth endpoints are accessible
    console.log('🧪 [TEST] Testing auth endpoint accessibility...');
    const authTest = await fetch('https://login.yotoplay.com/authorize', {
      method: 'HEAD'
    });
    console.log('🧪 [TEST] Auth endpoint status:', authTest.status);
    
    // Test 2: Check token endpoint
    console.log('🧪 [TEST] Testing token endpoint accessibility...');
    const tokenTest = await fetch('https://login.yotoplay.com/oauth/token', {
      method: 'HEAD'
    });
    console.log('🧪 [TEST] Token endpoint status:', tokenTest.status);
    
    // Test 3: Check client ID format
    console.log('🧪 [TEST] Client ID format check:', {
      clientId: 'NJ4lW4Y3FrBcpR4R6YlkKs30gTxPjvC4',
      length: 'NJ4lW4Y3FrBcpR4R6YlkKs30gTxPjvC4'.length,
      type: typeof 'NJ4lW4Y3FrBcpR4R6YlkKs30gTxPjvC4'
    });
    
  } catch (error) {
    console.error('🧪 [TEST] Test failed:', error);
  }
};
