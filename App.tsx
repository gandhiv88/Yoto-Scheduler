import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
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
import { AmbientLightControl } from './src/components/AmbientLightControl';
import type { YotoPlayer, YotoCard } from './src/types/index';

const CLIENT_ID = 'NJ4lW4Y3FrBcpR4R6YlkKs30gTxPjvC4';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showWebViewLogin, setShowWebViewLogin] = useState(false);
  const [players, setPlayers] = useState<YotoPlayer[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<YotoPlayer | null>(null);
  const [cards, setCards] = useState<YotoCard[]>([]);
  const [mqttClient, setMqttClient] = useState<MqttClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [showAmbientControl, setShowAmbientControl] = useState(false);

  const [authUrl, setAuthUrl] = useState<string>('');

  useEffect(() => {
    console.log('App component mounted, checking authentication status...');
    checkAuthenticationStatus();
    setupDeepLinking();
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
      setShowWebViewLogin(true);
    } catch (error) {
      console.error('Failed to get auth URL:', error);
      Alert.alert('Error', 'Failed to start login process');
    }
  };

  const handleWebViewClose = () => {
    console.log('🔄 [AUTH] WebView closed');
    setShowWebViewLogin(false);
  };

  const handleWebViewLoad = async () => {
    console.log('✅ [AUTH] Login successful via WebView');
    setShowWebViewLogin(false);
    setIsAuthenticated(true);
    await loadPlayers();
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
      setShowAmbientControl(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const connectToPlayer = async (player: YotoPlayer) => {
    setLoading(true);
    try {
      const token = await YotoAuth.getCurrentToken();
      if (!token) {
        Alert.alert('Error', 'Authentication failed. Please log in again.');
        await handleLogout();
        return;
      }

      const client = new MqttClient();
      
      // Set up status callback after creating client
      client.connectionStatusCallback = (status: string) => {
        setConnectionStatus(status);
      };

      const connected = await client.connect(player.id, token);
      if (connected) {
        setMqttClient(client);
        setSelectedPlayer(player);
        Alert.alert('Success', `Connected to ${player.name}`);
      } else {
        Alert.alert('Failed', 'Could not connect to player');
      }
    } catch (error) {
      console.error('Connection error:', error);
      Alert.alert('Error', 'Failed to connect to player');
    } finally {
      setLoading(false);
    }
  };

  const playCard = async (card: YotoCard) => {
    if (!mqttClient || !selectedPlayer) {
      Alert.alert('Error', 'No player connected');
      return;
    }

    try {
      await mqttClient.playCard(selectedPlayer.id, card.id);
      Alert.alert('Success', `Playing ${card.title}`);
    } catch (error) {
      console.error('Play error:', error);
      Alert.alert('Error', 'Failed to play card');
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

  if (!isAuthenticated) {
    console.log('🔓 [RENDER] User not authenticated, showing login screen. ShowWebView:', showWebViewLogin);
    
    if (showWebViewLogin) {
      return (
        <SafeAreaView style={styles.container}>
          <WebView
            source={{ uri: authUrl }}
            onNavigationStateChange={(navState) => {
              console.log('🔗 [LOGIN] Navigation to:', navState.url);
              if (navState.url.includes('code=')) {
                console.log('✅ [LOGIN] Authorization code detected in URL');
                handleWebViewLoad();
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
          <Text style={styles.title}>Yoto MQTT Controller</Text>
          <Text style={styles.subtitle}>Control your Yoto players via MQTT</Text>
          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Login with Yoto</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
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
          <Text style={styles.statusText}>Status: {connectionStatus}</Text>
          {selectedPlayer && (
            <Text style={styles.playerText}>Connected to: {selectedPlayer.name}</Text>
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
          </View>
        )}

        {/* Cards Section */}
        {cards.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Cards</Text>
            {cards.slice(0, 5).map((card) => (
              <TouchableOpacity
                key={card.id}
                style={styles.cardButton}
                onPress={() => playCard(card)}
                disabled={!mqttClient}
              >
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardSubtitle}>Tap to play</Text>
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
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
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
});
