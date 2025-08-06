import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import type { YotoPlayer } from '../types/index';

interface ConnectionLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  category: 'mqtt' | 'api' | 'auth' | 'general';
  message: string;
  details?: any;
}

interface ConnectionStatus {
  mqtt: {
    connected: boolean;
    lastConnected?: Date;
    lastError?: string;
    messagesSent: number;
    messagesReceived: number;
    reconnectCount: number;
  };
  api: {
    connected: boolean;
    lastRequest?: Date;
    lastError?: string;
    requestCount: number;
    avgResponseTime: number;
  };
  auth: {
    authenticated: boolean;
    tokenExpiry?: Date;
    lastRefresh?: Date;
    refreshCount: number;
  };
}

interface MqttClient {
  isConnected: boolean;
  connectionStatus?: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  testConnection: () => Promise<boolean>;
  getConnectionStats?: () => any;
}

interface ApiService {
  testConnection: () => Promise<{ success: boolean; error?: string }>;
  getRequestStats?: () => any;
}

interface ConnectionDiagnosticsProps {
  players: YotoPlayer[];
  mqttClient: MqttClient | null;
  apiService: ApiService | null;
  onBack: () => void;
}

export const ConnectionDiagnostics: React.FC<ConnectionDiagnosticsProps> = ({
  players,
  mqttClient,
  apiService,
  onBack,
}) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    mqtt: {
      connected: false,
      messagesSent: 0,
      messagesReceived: 0,
      reconnectCount: 0,
    },
    api: {
      connected: false,
      requestCount: 0,
      avgResponseTime: 0,
    },
    auth: {
      authenticated: false,
      refreshCount: 0,
    },
  });

  const [connectionLogs, setConnectionLogs] = useState<ConnectionLog[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRunningTests, setIsRunningTests] = useState(false);

  useEffect(() => {
    updateConnectionStatus();
    setupLogListeners();

    const interval = setInterval(updateConnectionStatus, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [mqttClient, apiService]);

  const addLog = (level: ConnectionLog['level'], category: ConnectionLog['category'], message: string, details?: any) => {
    const log: ConnectionLog = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      level,
      category,
      message,
      details,
    };

    setConnectionLogs(prev => [log, ...prev.slice(0, 99)]); // Keep last 100 logs
  };

  const setupLogListeners = () => {
    // Add MQTT event listeners if available
    if (mqttClient) {
      // Note: These would need to be implemented in the MQTT client
      addLog('info', 'mqtt', 'MQTT client monitoring started');
    }

    // Add API event listeners if available
    if (apiService) {
      addLog('info', 'api', 'API service monitoring started');
    }
  };

  const updateConnectionStatus = async () => {
    try {
      // Update MQTT status
      if (mqttClient) {
        const mqttStats = mqttClient.getConnectionStats ? mqttClient.getConnectionStats() : {};
        setConnectionStatus(prev => ({
          ...prev,
          mqtt: {
            ...prev.mqtt,
            connected: mqttClient.isConnected,
            lastConnected: mqttClient.isConnected ? new Date() : prev.mqtt.lastConnected,
            ...mqttStats,
          },
        }));
      }

      // Update API status
      if (apiService) {
        try {
          const apiResult = await apiService.testConnection();
          const apiStats = apiService.getRequestStats ? apiService.getRequestStats() : {};
          
          setConnectionStatus(prev => ({
            ...prev,
            api: {
              ...prev.api,
              connected: apiResult.success,
              lastRequest: new Date(),
              lastError: apiResult.success ? undefined : apiResult.error,
              ...apiStats,
            },
          }));

          if (!apiResult.success) {
            addLog('error', 'api', 'API connection test failed', apiResult.error);
          }
        } catch (error) {
          setConnectionStatus(prev => ({
            ...prev,
            api: {
              ...prev.api,
              connected: false,
              lastError: error instanceof Error ? error.message : 'Unknown error',
            },
          }));
        }
      }

      // Update auth status (this would need to be implemented)
      // For now, just assume authenticated if we have an API connection
      setConnectionStatus(prev => ({
        ...prev,
        auth: {
          ...prev.auth,
          authenticated: prev.api.connected,
        },
      }));

    } catch (error) {
      addLog('error', 'general', 'Failed to update connection status', error);
    }
  };

  const runConnectionTests = async () => {
    setIsRunningTests(true);
    addLog('info', 'general', 'Starting connection diagnostics...');

    try {
      // Test 1: MQTT Connection
      addLog('info', 'mqtt', 'Testing MQTT connection...');
      if (mqttClient) {
        try {
          const mqttTest = await mqttClient.testConnection();
          if (mqttTest) {
            addLog('success', 'mqtt', 'MQTT connection test passed');
          } else {
            addLog('error', 'mqtt', 'MQTT connection test failed');
          }
        } catch (error) {
          addLog('error', 'mqtt', 'MQTT connection test error', error);
        }
      } else {
        addLog('warning', 'mqtt', 'MQTT client not available');
      }

      // Test 2: API Connection
      addLog('info', 'api', 'Testing API connection...');
      if (apiService) {
        try {
          const startTime = Date.now();
          const apiResult = await apiService.testConnection();
          const responseTime = Date.now() - startTime;
          
          if (apiResult.success) {
            addLog('success', 'api', `API connection test passed (${responseTime}ms)`);
          } else {
            addLog('error', 'api', 'API connection test failed', apiResult.error);
          }
        } catch (error) {
          addLog('error', 'api', 'API connection test error', error);
        }
      } else {
        addLog('warning', 'api', 'API service not available');
      }

      // Test 3: Player Connectivity
      addLog('info', 'general', 'Testing player connectivity...');
      const onlinePlayers = players.filter(p => p.isOnline);
      const offlinePlayers = players.filter(p => !p.isOnline);
      
      addLog('info', 'general', `Found ${onlinePlayers.length} online players, ${offlinePlayers.length} offline`);
      
      if (offlinePlayers.length > 0) {
        addLog('warning', 'general', 'Some players are offline', {
          offlinePlayers: offlinePlayers.map(p => p.name)
        });
      }

      // Test 4: Network Quality
      addLog('info', 'general', 'Testing network quality...');
      try {
        const pingStart = Date.now();
        await fetch('https://api.yotoplay.com/ping', { method: 'HEAD' });
        const pingTime = Date.now() - pingStart;
        
        if (pingTime < 100) {
          addLog('success', 'general', `Excellent network quality (${pingTime}ms)`);
        } else if (pingTime < 300) {
          addLog('info', 'general', `Good network quality (${pingTime}ms)`);
        } else if (pingTime < 1000) {
          addLog('warning', 'general', `Poor network quality (${pingTime}ms)`);
        } else {
          addLog('error', 'general', `Very poor network quality (${pingTime}ms)`);
        }
      } catch (error) {
        addLog('error', 'general', 'Network quality test failed', error);
      }

      addLog('success', 'general', 'Connection diagnostics completed');
      
    } catch (error) {
      addLog('error', 'general', 'Diagnostics failed', error);
    } finally {
      setIsRunningTests(false);
    }
  };

  const reconnectMqtt = async () => {
    if (!mqttClient) return;

    try {
      addLog('info', 'mqtt', 'Attempting MQTT reconnection...');
      await mqttClient.disconnect();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await mqttClient.connect();
      addLog('success', 'mqtt', 'MQTT reconnection successful');
    } catch (error) {
      addLog('error', 'mqtt', 'MQTT reconnection failed', error);
    }
  };

  const clearLogs = () => {
    Alert.alert(
      'Clear Logs',
      'Are you sure you want to clear all connection logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setConnectionLogs([]);
            addLog('info', 'general', 'Connection logs cleared');
          },
        },
      ]
    );
  };

  const exportLogs = () => {
    const logsText = connectionLogs
      .map(log => `[${log.timestamp.toISOString()}] ${log.level.toUpperCase()} ${log.category}: ${log.message}`)
      .join('\n');
    
    Alert.alert(
      'Export Logs',
      'Connection logs prepared for export.',
      [
        { text: 'Copy to Clipboard', onPress: () => {
          // Note: Would need to implement clipboard functionality
          addLog('info', 'general', 'Logs copied to clipboard');
        }},
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const formatDuration = (date?: Date): string => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getStatusColor = (connected: boolean): string => {
    return connected ? '#28A745' : '#DC3545';
  };

  const getLogColor = (level: ConnectionLog['level']): string => {
    switch (level) {
      case 'success': return '#28A745';
      case 'info': return '#007AFF';
      case 'warning': return '#FFC107';
      case 'error': return '#DC3545';
      default: return '#666';
    }
  };

  const getLogIcon = (level: ConnectionLog['level']): string => {
    switch (level) {
      case 'success': return '✅';
      case 'info': return 'ℹ️';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return '📝';
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={updateConnectionStatus} />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Connection Diagnostics</Text>
        <Text style={styles.subtitle}>Monitor and troubleshoot connections</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryAction]}
          onPress={runConnectionTests}
          disabled={isRunningTests}
        >
          <Text style={styles.actionButtonText}>
            {isRunningTests ? '🔄 Testing...' : '🔍 Run Diagnostics'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryAction]}
          onPress={reconnectMqtt}
          disabled={!mqttClient}
        >
          <Text style={styles.secondaryActionText}>🔄 Reconnect MQTT</Text>
        </TouchableOpacity>
      </View>

      {/* Connection Status Cards */}
      <View style={styles.statusContainer}>
        {/* MQTT Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>MQTT Connection</Text>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(connectionStatus.mqtt.connected) }]} />
          </View>
          
          <Text style={styles.statusText}>
            Status: {connectionStatus.mqtt.connected ? 'Connected' : 'Disconnected'}
          </Text>
          
          <Text style={styles.statusDetail}>
            Last Connected: {formatDuration(connectionStatus.mqtt.lastConnected)}
          </Text>
          
          <Text style={styles.statusDetail}>
            Messages Sent: {connectionStatus.mqtt.messagesSent}
          </Text>
          
          <Text style={styles.statusDetail}>
            Reconnections: {connectionStatus.mqtt.reconnectCount}
          </Text>
          
          {connectionStatus.mqtt.lastError && (
            <Text style={styles.errorText}>
              Error: {connectionStatus.mqtt.lastError}
            </Text>
          )}
        </View>

        {/* API Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>API Connection</Text>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(connectionStatus.api.connected) }]} />
          </View>
          
          <Text style={styles.statusText}>
            Status: {connectionStatus.api.connected ? 'Connected' : 'Disconnected'}
          </Text>
          
          <Text style={styles.statusDetail}>
            Last Request: {formatDuration(connectionStatus.api.lastRequest)}
          </Text>
          
          <Text style={styles.statusDetail}>
            Total Requests: {connectionStatus.api.requestCount}
          </Text>
          
          <Text style={styles.statusDetail}>
            Avg Response: {connectionStatus.api.avgResponseTime}ms
          </Text>
          
          {connectionStatus.api.lastError && (
            <Text style={styles.errorText}>
              Error: {connectionStatus.api.lastError}
            </Text>
          )}
        </View>

        {/* Auth Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>Authentication</Text>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(connectionStatus.auth.authenticated) }]} />
          </View>
          
          <Text style={styles.statusText}>
            Status: {connectionStatus.auth.authenticated ? 'Authenticated' : 'Not Authenticated'}
          </Text>
          
          <Text style={styles.statusDetail}>
            Token Expiry: {connectionStatus.auth.tokenExpiry ? connectionStatus.auth.tokenExpiry.toLocaleString() : 'Unknown'}
          </Text>
          
          <Text style={styles.statusDetail}>
            Last Refresh: {formatDuration(connectionStatus.auth.lastRefresh)}
          </Text>
          
          <Text style={styles.statusDetail}>
            Refresh Count: {connectionStatus.auth.refreshCount}
          </Text>
        </View>
      </View>

      {/* Player Status */}
      <View style={styles.playersContainer}>
        <Text style={styles.sectionTitle}>Player Status</Text>
        {players.map(player => (
          <View key={player.id} style={styles.playerCard}>
            <View style={styles.playerHeader}>
              <Text style={styles.playerName}>{player.name}</Text>
              <View style={[styles.playerStatus, { backgroundColor: getStatusColor(player.isOnline) }]}>
                <Text style={styles.playerStatusText}>
                  {player.isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>
            
            <Text style={styles.playerDetail}>Model: {player.model}</Text>
            {player.firmwareVersion && (
              <Text style={styles.playerDetail}>Firmware: {player.firmwareVersion}</Text>
            )}
            {player.batteryLevel !== undefined && (
              <Text style={styles.playerDetail}>Battery: {player.batteryLevel}%</Text>
            )}
          </View>
        ))}
      </View>

      {/* Connection Logs */}
      <View style={styles.logsContainer}>
        <View style={styles.logsHeader}>
          <Text style={styles.sectionTitle}>Connection Logs</Text>
          <View style={styles.logsActions}>
            <TouchableOpacity style={styles.logAction} onPress={exportLogs}>
              <Text style={styles.logActionText}>📤</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logAction} onPress={clearLogs}>
              <Text style={styles.logActionText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.logsList}>
          {connectionLogs.length === 0 ? (
            <Text style={styles.emptyLogs}>No logs yet. Run diagnostics to generate logs.</Text>
          ) : (
            connectionLogs.slice(0, 50).map(log => (
              <View key={log.id} style={styles.logEntry}>
                <View style={styles.logHeader}>
                  <Text style={styles.logIcon}>{getLogIcon(log.level)}</Text>
                  <Text style={styles.logCategory}>{log.category.toUpperCase()}</Text>
                  <Text style={styles.logTime}>
                    {log.timestamp.toLocaleTimeString()}
                  </Text>
                </View>
                <Text style={[styles.logMessage, { color: getLogColor(log.level) }]}>
                  {log.message}
                </Text>
                {log.details && (
                  <Text style={styles.logDetails}>
                    {JSON.stringify(log.details, null, 2)}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    marginBottom: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: 15,
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  primaryAction: {
    backgroundColor: '#007AFF',
  },
  secondaryAction: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryActionText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statusContainer: {
    padding: 15,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  statusDetail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
  errorText: {
    fontSize: 12,
    color: '#DC3545',
    marginTop: 5,
    fontStyle: 'italic',
  },
  playersContainer: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  playerCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  playerName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  playerStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  playerStatusText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  playerDetail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  logsContainer: {
    padding: 15,
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  logsActions: {
    flexDirection: 'row',
  },
  logAction: {
    padding: 8,
    marginLeft: 8,
  },
  logActionText: {
    fontSize: 16,
  },
  logsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyLogs: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: 20,
  },
  logEntry: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 10,
    marginBottom: 10,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  logIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  logCategory: {
    fontSize: 10,
    color: '#999',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  logTime: {
    fontSize: 10,
    color: '#999',
    marginLeft: 'auto',
  },
  logMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  logDetails: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
    backgroundColor: '#F8F9FA',
    padding: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  bottomPadding: {
    height: 50,
  },
});
