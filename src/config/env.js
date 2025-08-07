import Constants from 'expo-constants';

// Environment configuration with fallbacks
const ENV_CONFIG = {
  // Yoto API Configuration
  YOTO_CLIENT_ID: Constants.expoConfig?.extra?.yotoClientId || 'NJ4lW4Y3FrBcpR4R6YlkKs30gTxPjvC4',
  YOTO_REDIRECT_URI: Constants.expoConfig?.extra?.yotoRedirectUri || 'https://gandhiv88.github.io/yoto-callback/',
  
  // API Endpoints
  YOTO_API_BASE_URL: 'https://api.yotoplay.com/v1',
  YOTO_AUTH_URL: 'https://auth.yotoplay.com',
  
  // MQTT Configuration
  MQTT_BROKER: 'aqrphjqbp3u2z-ats.iot.eu-west-2.amazonaws.com',
  MQTT_PORT: 443,
  MQTT_PROTOCOL: 'wss',
  
  // Debug Configuration
  LOG_LEVEL: Constants.expoConfig?.extra?.logLevel || 'debug',
  
  // App Configuration
  CONNECTION_TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000
};

// Validation function to ensure required config is present
export const validateConfig = () => {
  const required = ['YOTO_CLIENT_ID', 'YOTO_REDIRECT_URI'];
  const missing = required.filter(key => !ENV_CONFIG[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment configuration: ${missing.join(', ')}`);
  }
  
  return true;
};

// Export individual configs for backward compatibility
export const {
  YOTO_CLIENT_ID,
  YOTO_REDIRECT_URI,
  YOTO_AUTH_ENDPOINT,
  YOTO_TOKEN_ENDPOINT,
  YOTO_API_BASE_URL,
  MQTT_BROKER_URL,
  MQTT_KEEPALIVE,
  MQTT_PORT,
  IS_DEV,
  LOG_LEVEL
} = ENV_CONFIG;
