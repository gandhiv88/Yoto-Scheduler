import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';

import { YotoAuth } from './src/services/authService';
import { YotoAPI } from './src/services/apiService';
import { MqttClient } from './src/services/mqttService';
import { SchedulerService } from './src/services/simpleSchedulerService';
import { BackgroundSchedulerService } from './src/services/backgroundSchedulerService';
import { AmbientLightControl } from './src/components/AmbientLightControl';
import { SchedulerScreen } from './src/components/SchedulerScreen';
import { BackgroundSchedulerStatus } from './src/components/BackgroundSchedulerStatus';
import { ExpoGoBackgroundStatus } from './src/components/ExpoGoBackgroundStatus';
import Constants from 'expo-constants';
import { BatteryStatus } from './src/components/BatteryStatus';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { SnackBarProvider, useSnackBarContext } from './src/contexts/SnackBarContext';
import { YOTO_CLIENT_ID, validateConfig } from './src/config/env';
import type { YotoPlayer, YotoCard } from './src/types/index';

// Internal App component that uses the SnackBar context
const AppContent: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showWebViewLogin, setShowWebViewLogin] = useState(false);
  const [players, setPlayers] = useState<YotoPlayer[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<YotoPlayer | null>(null);
  const [cards, setCards] = useState<YotoCard[]>([]);
  const [mqttClient, setMqttClient] = useState<MqttClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [showAmbientControl, setShowAmbientControl] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [showBackgroundStatus, setShowBackgroundStatus] = useState(false);
  const [processedCallbackUrl, setProcessedCallbackUrl] = useState<string | null>(null);
  const [batteryInfo, setBatteryInfo] = useState<any>(null);
  const [authUrl, setAuthUrl] = useState<string>('');

  // Use snackbar context
  const { showSuccess, showError, showWarning, showInfo } = useSnackBarContext();

  useEffect(() => {
    console.log('App component mounted, checking authentication status...');
    
    // Validate configuration on startup
    try {
      validateConfig();
      YotoAPI.initialize();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown configuration error';
      console.error('❌ [CONFIG] Configuration validation failed:', error);
      showError(`Configuration Error: ${errorMessage}`);
      return;
    }
    
    checkAuthenticationStatus();
    setupDeepLinking();
    
    // Initialize scheduler service
    SchedulerService.initialize().catch(console.error);
    
    // Initialize background scheduler service based on environment
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) {
      // ExpoGo scheduler will be initialized when needed in ExpoGoBackgroundStatus component
      console.log('Running in Expo Go - using notification-based scheduler');
    } else {
      BackgroundSchedulerService.initialize().catch(console.error);
    }
    
    // Cleanup function for timers and connections
    return () => {
      if (mqttClient) {
        mqttClient.disconnect();
      }
    };
  }, []);

  const setupDeepLinking = () => {
    console.log('🔗 [APP] Setting up deep linking for OAuth callbacks...');
    
    const handleDeepLink = (url: string) => {
      console.log('🔗 [DEEP] Received deep link:', url);
      if (url.includes('code=')) {
        console.log('✅ [DEEP] OAuth callback detected in deep link');
        setShowWebViewLogin(false);
      }
    };

    // Listen for incoming deep links
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Check if app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => subscription?.remove();
  };

  const checkAuthenticationStatus = async () => {
    console.log('🔍 [AUTH] Checking authentication status...');
    const authenticated = await YotoAuth.isAuthenticated();
    console.log('🔑 [AUTH] Is authenticated:', authenticated);
    
    if (authenticated) {
      console.log('✅ [AUTH] User is authenticated');
      setIsAuthenticated(true);
      await loadPlayers();
    } else {
      console.log('❌ [AUTH] User is not authenticated');
      setIsAuthenticated(false);
    }
  };

  const loadPlayers = async () => {
    console.log('🔍 [APP] Loading players from Yoto API...');
    try {
      const playerList = await YotoAPI.getPlayers();
      console.log('✅ [APP] Players loaded successfully');
      setPlayers(playerList);
      
      // Auto-select first player if available
      if (playerList.length > 0) {
        setSelectedPlayer(playerList[0]);
      }
      
      await loadUserContent();
    } catch (error) {
      console.error('❌ [APP] Failed to load players:', error);
    }
  };

  const loadUserContent = async () => {
    console.log('🔍 [APP] Loading user content from Yoto API...');
    try {
      const userCards = await YotoAPI.getUserContent();
      console.log('✅ [APP] User content loaded successfully');
      console.log('🎵 [CARDS] Card details:', userCards.map(card => ({
        id: card.id,
        title: card.title,
        contentType: card.contentType || 'unknown',
        uri: card.uri
      })));
      setCards(userCards);
    } catch (error) {
      console.error('❌ [APP] Failed to load user content:', error);
    }
  };

  const handleLogin = async () => {
    console.log('🚀 [AUTH] Starting WebView login...');
    try {
      const url = await YotoAuth.getAuthUrl();
      setAuthUrl(url);
      setProcessedCallbackUrl(null); // Reset processed URL for new auth session
      setShowWebViewLogin(true);
    } catch (error) {
      console.error('Failed to get auth URL:', error);
      showError('Failed to start login process');
    }
  };

  const handleWebViewClose = () => {
    console.log('🔄 [AUTH] WebView closed');
    setShowWebViewLogin(false);
  };

  const handleLogout = async () => {
    try {
      if (mqttClient) {
        mqttClient.disconnect();
      }
      
      await YotoAuth.logout();
      setIsAuthenticated(false);
      setPlayers([]);
      setSelectedPlayer(null);
      setCards([]);
      setMqttClient(null);
      setConnectionStatus('Disconnected');
      setBatteryInfo(null);
      setShowAmbientControl(false);
      setShowScheduler(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const connectToPlayer = async (player: YotoPlayer) => {
    setLoading(true);
    try {
      const token = await YotoAuth.getCurrentToken();
      if (!token) {
        showError('Authentication failed. Please log in again.');
        await handleLogout();
        return;
      }

      const client = new MqttClient();
      
      // Set up status callback after creating client
      client.connectionStatusCallback = (status: string) => {
        setConnectionStatus(status);
      };

      // Set up battery status callback
      client.batteryStatusCallback = (battery: any) => {
        console.log('🔋 [APP] Battery status received:', battery);
        setBatteryInfo(battery);
      };

      const connected = await client.connect(player.id, token);
      if (connected) {
        setMqttClient(client);
        setSelectedPlayer(player);
        
        // Pass MQTT client to scheduler service for foreground execution
        SchedulerService.setMqttClient(client);
        
        showSuccess(`Connected to ${player.name}`);
      } else {
        showError('Could not connect to player');
      }
    } catch (error) {
      console.error('Connection error:', error);
      showError('Failed to connect to player');
    } finally {
      setLoading(false);
    }
  };

  const playCard = async (card: YotoCard) => {
    if (!mqttClient || !selectedPlayer) {
      showError('No player connected');
      return;
    }

    // Create proper Yoto URI format if not already provided
    let cardUri = card.uri;
    if (!cardUri) {
      // Construct the proper Yoto URI format: https://yoto.io/<cardID>
      cardUri = `https://yoto.io/${card.id}`;
    } else if (!cardUri.startsWith('https://yoto.io/') && !cardUri.startsWith('http')) {
      // If URI is provided but not in full format, construct it
      cardUri = `https://yoto.io/${card.uri}`;
    }

    console.log('🎵 [PLAY] Attempting to play card:', {
      cardId: card.id,
      cardTitle: card.title,
      originalUri: card.uri,
      constructedUri: cardUri,
      hasOriginalUri: !!card.uri,
      playerId: selectedPlayer.id,
      playerName: selectedPlayer.name
    });

    try {
      await mqttClient.playCard(selectedPlayer.id, cardUri);
      showSuccess(`Playing ${card.title}`);
    } catch (error) {
      console.error('Play error:', error);
      showError('Failed to play card');
    }
  };

  const refreshConnection = async () => {
    if (!selectedPlayer) return;
    
    try {
      if (mqttClient) {
        mqttClient.disconnect();
      }
      await connectToPlayer(selectedPlayer);
    } catch (error) {
      console.error('Refresh connection error:', error);
      throw error;
    }
  };

  const disconnectFromPlayer = () => {
    if (mqttClient) {
      console.log('🔌 [DISCONNECT] Disconnecting from MQTT client');
      mqttClient.disconnect();
      setMqttClient(null);
      setSelectedPlayer(null);
      setConnectionStatus('Disconnected');
      setBatteryInfo(null);
      showSuccess('Successfully disconnected from player');
    } else {
      showInfo('No active connection to disconnect');
    }
  };

  if (!isAuthenticated) {
    console.log('🔓 [RENDER] User not authenticated, showing login screen. ShowWebView:', showWebViewLogin);
    
    if (showWebViewLogin) {
      return (
        <SafeAreaView style={styles.container}>
          <WebView
            source={{ uri: authUrl }}
            onNavigationStateChange={async (navState) => {
              console.log('🔗 [LOGIN] Navigation to:', navState.url);
              if (navState.url.includes('code=')) {
                console.log('✅ [LOGIN] Authorization code detected in URL');
                
                // Prevent processing the same callback URL multiple times
                if (processedCallbackUrl === navState.url) {
                  console.log('⚠️ [LOGIN] Already processed this callback URL, skipping...');
                  return;
                }
                
                // Mark this URL as being processed
                setProcessedCallbackUrl(navState.url);
                console.log('� [DEBUG] STARTING CALLBACK PROCESSING NOW');
                console.log('�🔍 [DEBUG] Callback URL:', navState.url);
                
                // Process the callback URL to exchange code for tokens
                try {
                  console.log('🔄 [DEBUG] Calling handleOAuthCallback...');
                  const callbackResult = await YotoAuth.handleOAuthCallback(navState.url);
                  console.log('🔍 [DEBUG] Callback result:', { 
                    success: callbackResult.success, 
                    hasTokens: !!callbackResult.tokens,
                    error: callbackResult.error 
                  });
                  
                  if (callbackResult.success) {
                    console.log('✅ [AUTH] Token exchange successful from WebView');
                    setShowWebViewLogin(false);
                    
                    // Check if tokens are now available
                    const isNowAuthenticated = await YotoAuth.isAuthenticated();
                    console.log('🔍 [DEBUG] Is now authenticated after token exchange:', isNowAuthenticated);
                    
                    setIsAuthenticated(isNowAuthenticated);
                    if (isNowAuthenticated) {
                      await loadPlayers();
                    }
                  } else {
                    console.error('❌ [AUTH] Token exchange failed:', callbackResult.error);
                    setShowWebViewLogin(false);
                    showError(callbackResult.error || 'Failed to complete login');
                  }
                } catch (error) {
                  console.error('❌ [AUTH] Error processing callback:', error);
                  setShowWebViewLogin(false);
                  showError('Failed to process login callback');
                }
                
                console.log('🏁 [DEBUG] Navigation handler completed');
              }
            }}
            onLoadStart={() => console.log('🔄 [LOGIN] WebView load started')}
            onLoadEnd={() => console.log('✅ [LOGIN] WebView load completed')}
            style={{ flex: 1 }}
          />
          <TouchableOpacity style={styles.closeButton} onPress={handleWebViewClose}>
            <Text style={styles.closeButtonText}>✕ Close</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }

    return (
      <View style={styles.container}>
        <StatusBar style="auto" />
        <View style={styles.loginContainer}>
          <Text style={styles.title}>Yoto Scheduler</Text>
          <Text style={styles.subtitle}>Control your Yoto players</Text>
          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Login with Yoto</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (showBackgroundStatus) {
    // Use ExpoGoBackgroundStatus in Expo Go, BackgroundSchedulerStatus in dev build
    const isExpoGo = Constants.appOwnership === 'expo';
    
    if (isExpoGo) {
      return (
        <ExpoGoBackgroundStatus
          onBack={() => setShowBackgroundStatus(false)}
        />
      );
    } else {
      return (
        <BackgroundSchedulerStatus
          onBack={() => setShowBackgroundStatus(false)}
        />
      );
    }
  }

  if (showAmbientControl && selectedPlayer && mqttClient) {
    return (
      <AmbientLightControl
        player={selectedPlayer}
        mqttClient={mqttClient}
        onBack={() => setShowAmbientControl(false)}
        onRefreshConnection={refreshConnection}
      />
    );
  }

  if (showScheduler && selectedPlayer) {
    return (
      <SchedulerScreen
        player={selectedPlayer}
        cards={cards}
        mqttClient={mqttClient}
        onBack={() => setShowScheduler(false)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Yoto MQTT Controller</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Connection Status */}
        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>MQTT Connection: {connectionStatus}</Text>
            {/* Battery status inline with connection status */}
            {(batteryInfo || selectedPlayer) && (
              <BatteryStatus batteryInfo={batteryInfo || { level: 50, isCharging: false }} />
            )}
          </View>
          
          {selectedPlayer && (
            <>
              <Text style={styles.playerText}>Connected to: {selectedPlayer.name}</Text>
              {!batteryInfo && (
                <Text style={styles.waitingText}>
                  Waiting for device...
                </Text>
              )}
              <View style={styles.connectionButtonsContainer}>
                <TouchableOpacity style={styles.disconnectButton} onPress={disconnectFromPlayer}>
                  <Text style={styles.disconnectButtonText}>Disconnect</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.refreshButton} onPress={refreshConnection}>
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Players Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Players</Text>
          {players.map((player) => (
            <TouchableOpacity
              key={player.id}
              style={[
                styles.playerButton,
                selectedPlayer?.id === player.id && styles.selectedPlayer,
              ]}
              onPress={() => connectToPlayer(player)}
              disabled={loading}
            >
              <Text style={styles.playerName}>{player.name}</Text>
              <Text style={styles.playerStatus}>
                {selectedPlayer?.id === player.id ? 'Connected' : 'Tap to connect'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Controls Section */}
        {mqttClient && selectedPlayer && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Controls</Text>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setShowAmbientControl(true)}
            >
              <Text style={styles.controlButtonText}>💡 Ambient Light Control</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setShowScheduler(true)}
            >
              <Text style={styles.controlButtonText}>📅 Card Scheduler</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setShowBackgroundStatus(true)}
            >
              <Text style={styles.controlButtonText}>🌙 Background Status</Text>
            </TouchableOpacity>
            
            {/* Playback Controls */}
            <View style={styles.playbackControlsContainer}>
              <TouchableOpacity
                style={styles.playbackButton}
                onPress={() => mqttClient.pausePlayback(selectedPlayer.id)}
              >
                <Text style={styles.playbackButtonText}>⏸️ Pause</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.playbackButton}
                onPress={() => mqttClient.resumePlayback(selectedPlayer.id)}
              >
                <Text style={styles.playbackButtonText}>▶️ Resume</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.playbackButton, styles.stopButton]}
                onPress={() => mqttClient.stopPlayback(selectedPlayer.id)}
              >
                <Text style={styles.playbackButtonText}>⏹️ Stop</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Cards Section */}
        {cards.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Cards</Text>
            {!mqttClient && (
              <View style={styles.disconnectedNotice}>
                <Text style={styles.disconnectedNoticeText}>
                  🔌 Connect to a player to control card playback
                </Text>
              </View>
            )}
            {cards.slice(0, 5).map((card) => (
              <TouchableOpacity
                key={card.id}
                style={[
                  styles.cardButton,
                  !mqttClient && styles.cardButtonDisabled
                ]}
                onPress={() => playCard(card)}
                disabled={!mqttClient}
              >
                <Text style={[
                  styles.cardTitle,
                  !mqttClient && styles.cardTitleDisabled
                ]}>
                  {card.title}
                </Text>
                <Text style={[
                  styles.cardSubtitle,
                  !mqttClient && styles.cardSubtitleDisabled
                ]}>
                  {mqttClient ? 'Tap to play' : 'Connect to player first'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Connecting...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// Main App component wrapped with Error Boundary and SnackBarProvider
export default function App() {
  return (
    <ErrorBoundary>
      <SnackBarProvider>
        <AppContent />
      </SnackBarProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollView: {
    flex: 1,
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  loginButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  statusContainer: {
    backgroundColor: '#FFFFFF',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  waitingText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  playerText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  section: {
    backgroundColor: '#FFFFFF',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  playerButton: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPlayer: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  playerStatus: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  controlButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  controlButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cardButton: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  connectionButtonsContainer: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  disconnectButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
  },
  disconnectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  refreshButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  playbackControlsContainer: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 10,
  },
  playbackButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  playbackButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  disconnectedNotice: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  disconnectedNoticeText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  cardButtonDisabled: {
    backgroundColor: '#F5F5F5',
    opacity: 0.6,
    borderLeftColor: '#CCCCCC',
  },
  cardTitleDisabled: {
    color: '#999999',
  },
  cardSubtitleDisabled: {
    color: '#BBBBBB',
  },
});
