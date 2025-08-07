import { useState, useEffect, useCallback, useRef } from 'react';
import { MqttClient } from '../services/mqttService';
import { YotoAuth } from '../services/authService';

export const usePlayerConnection = (player) => {
  const [mqttClient, setMqttClient] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [batteryInfo, setBatteryInfo] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  
  // Use ref to track cleanup
  const cleanupRef = useRef(null);

  const connect = useCallback(async () => {
    if (!player || isConnecting) return false;
    
    setIsConnecting(true);
    setError(null);
    
    try {
      const token = await YotoAuth.getCurrentToken();
      if (!token) {
        throw new Error('Authentication failed. Please log in again.');
      }

      const client = new MqttClient();
      
      // Set up status callback
      client.connectionStatusCallback = (status) => {
        setConnectionStatus(status);
      };

      // Set up battery status callback
      client.batteryStatusCallback = (battery) => {
        console.log('🔋 [HOOK] Battery status received:', battery);
        setBatteryInfo(battery);
      };

      const connected = await client.connect(player.id, token);
      if (connected) {
        setMqttClient(client);
        setConnectionStatus('Connected');
        return true;
      } else {
        throw new Error('Could not connect to player');
      }
    } catch (err) {
      console.error('Connection error:', err);
      setError(err.message);
      setConnectionStatus('Error');
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [player, isConnecting]);

  const disconnect = useCallback(() => {
    if (mqttClient) {
      console.log('🔌 [HOOK] Disconnecting from MQTT client');
      mqttClient.disconnect();
      setMqttClient(null);
      setConnectionStatus('Disconnected');
      setBatteryInfo(null);
      setError(null);
    }
  }, [mqttClient]);

  const refresh = useCallback(async () => {
    if (!player) return false;
    
    disconnect();
    // Small delay before reconnecting
    await new Promise(resolve => setTimeout(resolve, 1000));
    return await connect();
  }, [player, disconnect, connect]);

  // Cleanup on unmount or player change
  useEffect(() => {
    return () => {
      if (mqttClient) {
        console.log('🧹 [HOOK] Cleaning up MQTT connection');
        mqttClient.disconnect();
      }
    };
  }, [mqttClient]);

  // Reset connection when player changes
  useEffect(() => {
    disconnect();
  }, [player?.id, disconnect]);

  return {
    mqttClient,
    connectionStatus,
    batteryInfo,
    isConnecting,
    error,
    connect,
    disconnect,
    refresh,
    isConnected: connectionStatus === 'Connected' && mqttClient?.isConnectionHealthy?.()
  };
};
