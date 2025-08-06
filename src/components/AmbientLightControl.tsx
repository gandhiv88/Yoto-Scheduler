import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  ScrollView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import type { YotoPlayer } from '../types/index';

interface MqttClient {
  setAmbientLight: (playerId: string, brightness: number, color?: string) => Promise<void>;
  turnOffAmbientLight: (playerId: string) => Promise<void>;
  setNightLight: (playerId: string, enabled: boolean, brightness?: number) => Promise<void>;
  connect?: (playerId: string, token: string) => Promise<boolean>;
  disconnect?: () => void;
}

interface AmbientLightControlProps {
  player: YotoPlayer;
  mqttClient: MqttClient;
  onBack: () => void;
  onRefreshConnection?: () => Promise<void>;
}

export const AmbientLightControl: React.FC<AmbientLightControlProps> = ({
  player,
  mqttClient,
  onBack,
  onRefreshConnection,
}) => {
  const [brightness, setBrightness] = useState<number>(50);
  const [selectedColor, setSelectedColor] = useState<string>('#FFFFFF');
  const [isNightLightEnabled, setIsNightLightEnabled] = useState<boolean>(false);
  const [nightLightBrightness, setNightLightBrightness] = useState<number>(20);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const predefinedColors = [
    { name: 'White', color: '#FFFFFF' },
    { name: 'Warm White', color: '#FFE5B4' },
    { name: 'Red', color: '#FF6B6B' },
    { name: 'Orange', color: '#FFA726' },
    { name: 'Yellow', color: '#FFEB3B' },
    { name: 'Green', color: '#66BB6A' },
    { name: 'Blue', color: '#42A5F5' },
    { name: 'Purple', color: '#AB47BC' },
    { name: 'Pink', color: '#EC407A' },
    { name: 'Teal', color: '#26A69A' },
  ];

  const handleSetAmbientLight = async () => {
    setIsLoading(true);
    try {
      console.log('💡 [AMBIENT] Setting ambient light:', {
        playerId: player.id,
        brightness: brightness,
        color: selectedColor,
        playerName: player.name
      });

      // Check if MQTT client is properly connected
      if (!mqttClient) {
        throw new Error('MQTT client not available');
      }

      // Check if the client has the method we need
      if (typeof mqttClient.setAmbientLight !== 'function') {
        throw new Error('setAmbientLight method not available on MQTT client');
      }

      // Try the ambient light command
      await mqttClient.setAmbientLight(player.id, brightness, selectedColor);
      Alert.alert('Success', `Ambient light set to ${brightness}% brightness with ${selectedColor} color`);
    } catch (error) {
      console.error('💡 [AMBIENT] Error setting ambient light:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to set ambient light';
      const errorStr = error instanceof Error ? error.message : String(error);
      
      if (errorStr.includes('403') || errorStr.includes('Authentication failed')) {
        // Show specific 403 error with retry option
        Alert.alert(
          'Authentication Error',
          'The connection to your Yoto player has expired or is not authorized. Would you like to try reconnecting?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Reconnect', 
              onPress: async () => {
                if (onRefreshConnection) {
                  setIsLoading(true);
                  try {
                    await onRefreshConnection();
                    // If reconnection successful, try ambient light again
                    setTimeout(() => {
                      handleSetAmbientLight();
                    }, 1000);
                  } catch (reconnectError) {
                    console.error('Reconnection failed:', reconnectError);
                    Alert.alert('Reconnection Failed', 'Please try logging out and logging back in.');
                  } finally {
                    setIsLoading(false);
                  }
                } else {
                  Alert.alert('Manual Reconnection Required', 'Please disconnect and reconnect to the player from the main screen.');
                }
              }
            }
          ]
        );
      } else if (errorStr.includes('not connected')) {
        errorMessage = 'MQTT connection lost. Please reconnect to the player.';
        Alert.alert('Connection Lost', errorMessage);
      } else if (errorStr.includes('not healthy')) {
        errorMessage = 'Connection is unstable. Please try reconnecting.';
        Alert.alert('Connection Unstable', errorMessage);
      } else if (error instanceof Error && error.message) {
        errorMessage = error.message;
        Alert.alert('Error', errorMessage);
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTurnOffLight = async () => {
    setIsLoading(true);
    try {
      await mqttClient.turnOffAmbientLight(player.id);
      Alert.alert('Success', 'Ambient light turned off');
    } catch (error) {
      console.error('Error turning off light:', error);
      const errorStr = error instanceof Error ? error.message : String(error);
      
      if (errorStr.includes('403') || errorStr.includes('Authentication failed')) {
        Alert.alert(
          'Authentication Error',
          'The connection to your Yoto player has expired. Would you like to try reconnecting?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Reconnect', 
              onPress: async () => {
                if (onRefreshConnection) {
                  try {
                    await onRefreshConnection();
                    setTimeout(() => handleTurnOffLight(), 1000);
                  } catch (reconnectError) {
                    Alert.alert('Reconnection Failed', 'Please try logging out and logging back in.');
                  }
                } else {
                  Alert.alert('Manual Reconnection Required', 'Please disconnect and reconnect to the player from the main screen.');
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to turn off light');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleNightLightToggle = async (enabled: boolean) => {
    setIsLoading(true);
    try {
      await mqttClient.setNightLight(player.id, enabled, nightLightBrightness);
      setIsNightLightEnabled(enabled);
      Alert.alert(
        'Success',
        enabled ? 'Night light enabled' : 'Night light disabled'
      );
    } catch (error) {
      console.error('Error toggling night light:', error);
      const errorStr = error instanceof Error ? error.message : String(error);
      
      if (errorStr.includes('403') || errorStr.includes('Authentication failed')) {
        Alert.alert(
          'Authentication Error',
          'The connection to your Yoto player has expired. Would you like to try reconnecting?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Reconnect', 
              onPress: async () => {
                if (onRefreshConnection) {
                  try {
                    await onRefreshConnection();
                    setTimeout(() => handleNightLightToggle(enabled), 1000);
                  } catch (reconnectError) {
                    Alert.alert('Reconnection Failed', 'Please try logging out and logging back in.');
                  }
                } else {
                  Alert.alert('Manual Reconnection Required', 'Please disconnect and reconnect to the player from the main screen.');
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to toggle night light');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const presetBrightness = [
    { label: '10%', value: 10 },
    { label: '25%', value: 25 },
    { label: '50%', value: 50 },
    { label: '75%', value: 75 },
    { label: '100%', value: 100 },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Ambient Light Control</Text>
        <Text style={styles.playerName}>{player.name}</Text>
      </View>

      {/* Main Ambient Light Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ambient Light</Text>
        
        {/* Brightness Control */}
        <View style={styles.brightnessContainer}>
          <Text style={styles.label}>Brightness: {brightness}%</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={100}
            value={brightness}
            onValueChange={setBrightness}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#E0E0E0"
            step={1}
          />
          
          {/* Brightness Presets */}
          <View style={styles.presetContainer}>
            {presetBrightness.map((preset) => (
              <TouchableOpacity
                key={preset.value}
                style={[
                  styles.presetButton,
                  brightness === preset.value && styles.presetButtonActive,
                ]}
                onPress={() => setBrightness(preset.value)}
              >
                <Text
                  style={[
                    styles.presetButtonText,
                    brightness === preset.value && styles.presetButtonTextActive,
                  ]}
                >
                  {preset.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Color Selection */}
        <View style={styles.colorContainer}>
          <Text style={styles.label}>Color</Text>
          <View style={styles.colorGrid}>
            {predefinedColors.map((colorOption) => (
              <TouchableOpacity
                key={colorOption.color}
                style={[
                  styles.colorButton,
                  { backgroundColor: colorOption.color },
                  selectedColor === colorOption.color && styles.colorButtonSelected,
                ]}
                onPress={() => setSelectedColor(colorOption.color)}
              >
                {selectedColor === colorOption.color && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.selectedColorText}>
            Selected: {predefinedColors.find(c => c.color === selectedColor)?.name}
          </Text>
        </View>

        {/* Control Buttons */}
        <View style={styles.controlButtons}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleSetAmbientLight}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Setting...' : 'Set Ambient Light'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleTurnOffLight}
            disabled={isLoading}
          >
            <Text style={styles.secondaryButtonText}>Turn Off</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Night Light Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Night Light</Text>
        
        <View style={styles.nightLightContainer}>
          <View style={styles.switchContainer}>
            <Text style={styles.label}>Enable Night Light</Text>
            <Switch
              value={isNightLightEnabled}
              onValueChange={handleNightLightToggle}
              trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
              thumbColor={isNightLightEnabled ? '#FFFFFF' : '#FFFFFF'}
              disabled={isLoading}
            />
          </View>

          {isNightLightEnabled && (
            <View style={styles.nightLightBrightnessContainer}>
              <Text style={styles.label}>Night Light Brightness: {nightLightBrightness}%</Text>
              <Slider
                style={styles.slider}
                minimumValue={5}
                maximumValue={50}
                value={nightLightBrightness}
                onValueChange={setNightLightBrightness}
                minimumTrackTintColor="#FFA726"
                maximumTrackTintColor="#E0E0E0"
                step={1}
              />
            </View>
          )}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickActionButton, styles.warmButton]}
            onPress={() => {
              setSelectedColor('#FFE5B4');
              setBrightness(30);
              handleSetAmbientLight();
            }}
            disabled={isLoading}
          >
            <Text style={styles.quickActionText}>Warm Reading Light</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionButton, styles.sleepButton]}
            onPress={() => {
              setSelectedColor('#FF6B6B');
              setBrightness(10);
              handleSetAmbientLight();
            }}
            disabled={isLoading}
          >
            <Text style={styles.quickActionText}>Sleep Time</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionButton, styles.playButton]}
            onPress={() => {
              setSelectedColor('#42A5F5');
              setBrightness(60);
              handleSetAmbientLight();
            }}
            disabled={isLoading}
          >
            <Text style={styles.quickActionText}>Play Time</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  playerName: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
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
  brightnessContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  presetContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  presetButton: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 50,
  },
  presetButtonActive: {
    backgroundColor: '#007AFF',
  },
  presetButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  presetButtonTextActive: {
    color: '#FFFFFF',
  },
  colorContainer: {
    marginBottom: 20,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  colorButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    margin: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorButtonSelected: {
    borderColor: '#333',
    borderWidth: 3,
  },
  checkmark: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedColorText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  nightLightContainer: {
    marginTop: 10,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  nightLightBrightnessContainer: {
    marginTop: 15,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  quickActionButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  warmButton: {
    backgroundColor: '#FFE5B4',
  },
  sleepButton: {
    backgroundColor: '#FF6B6B',
  },
  playButton: {
    backgroundColor: '#42A5F5',
  },
  quickActionText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
