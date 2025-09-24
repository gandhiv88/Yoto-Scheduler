import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
} from 'react-native';
import { useSnackBarContext } from '../contexts/SnackBarContext';
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

  // Use snackbar context
  const { showSuccess, showError, showWarning } = useSnackBarContext();

  const predefinedColors = [
    { name: 'White', color: '#FFFFFF' },
    { name: 'Warm White', color: '#FFF0E6' },
    { name: 'Red', color: '#FF0000' },      // Pure red
    { name: 'Orange', color: '#FF8000' },   // Pure orange
    { name: 'Yellow', color: '#FFFF00' },   // Pure yellow
    { name: 'Green', color: '#00FF00' },    // Pure green
    { name: 'Blue', color: '#0000FF' },     // Pure blue
    { name: 'Purple', color: '#8000FF' },   // Pure purple
    { name: 'Pink', color: '#FF0080' },     // Pure pink
    { name: 'Cyan', color: '#00FFFF' },     // Pure cyan
  ];

  const handleSetAmbientLight = async () => {
    setIsLoading(true);
    try {
      await mqttClient.setAmbientLight(player.id, brightness, selectedColor);
      const colorName = predefinedColors.find(c => c.color === selectedColor)?.name || 'selected color';
      showSuccess(`Ambient light set to ${brightness}% brightness with ${colorName}`);
    } catch (error) {
      console.error('💡 [AMBIENT] Error setting ambient light:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to set ambient light';
      const errorStr = error instanceof Error ? error.message : String(error);
      
      if (errorStr.includes('403') || errorStr.includes('Authentication failed')) {
        // Show specific 403 error message
        showError('Authentication expired. Please disconnect and reconnect to your Yoto player.');
      } else if (errorStr.includes('not connected')) {
        errorMessage = 'MQTT connection lost. Please reconnect to the player.';
        showError(errorMessage);
      } else if (errorStr.includes('not healthy')) {
        errorMessage = 'Connection is unstable. Please try reconnecting.';
        showWarning(errorMessage);
      } else if (error instanceof Error && error.message) {
        errorMessage = error.message;
        showError(errorMessage);
      } else {
        showError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to convert hex to RGB (matches MQTT service)
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 }; // Default to white if parsing fails
  };

  const handleTurnOffLight = async () => {
    setIsLoading(true);
    try {
      await mqttClient.turnOffAmbientLight(player.id);
      showSuccess('Ambient light turned off');
    } catch (error) {
      console.error('Error turning off light:', error);
      const errorStr = error instanceof Error ? error.message : String(error);
      
      if (errorStr.includes('403') || errorStr.includes('Authentication failed')) {
        showError('Authentication expired. Please disconnect and reconnect to your Yoto player.');
      } else {
        showError('Failed to turn off light');
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
      showSuccess(enabled ? 'Night light enabled' : 'Night light disabled');
    } catch (error) {
      console.error('Error toggling night light:', error);
      const errorStr = error instanceof Error ? error.message : String(error);
      
      if (errorStr.includes('403') || errorStr.includes('Authentication failed')) {
        showError('Authentication expired. Please disconnect and reconnect to your Yoto player.');
      } else {
        showError('Failed to toggle night light');
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
          
          {/* Brightness Control Buttons */}
          <View style={styles.brightnessControls}>
            <TouchableOpacity
              style={styles.brightnessButton}
              onPress={() => setBrightness(Math.max(0, brightness - 10))}
            >
              <Text style={styles.brightnessButtonText}>-10</Text>
            </TouchableOpacity>
            
            <View style={styles.brightnessDisplay}>
              <Text style={styles.brightnessText}>{brightness}%</Text>
            </View>
            
            <TouchableOpacity
              style={styles.brightnessButton}
              onPress={() => setBrightness(Math.min(100, brightness + 10))}
            >
              <Text style={styles.brightnessButtonText}>+10</Text>
            </TouchableOpacity>
          </View>
          
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
              <View style={styles.brightnessControls}>
                <TouchableOpacity
                  style={styles.brightnessButton}
                  onPress={() => setNightLightBrightness(Math.max(5, nightLightBrightness - 5))}
                >
                  <Text style={styles.brightnessButtonText}>-5</Text>
                </TouchableOpacity>
                
                <View style={styles.brightnessDisplay}>
                  <Text style={styles.brightnessText}>{nightLightBrightness}%</Text>
                </View>
                
                <TouchableOpacity
                  style={styles.brightnessButton}
                  onPress={() => setNightLightBrightness(Math.min(50, nightLightBrightness + 5))}
                >
                  <Text style={styles.brightnessButtonText}>+5</Text>
                </TouchableOpacity>
              </View>
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
              setSelectedColor('#FFF0E6');
              setBrightness(30);
              handleSetAmbientLight();
            }}
            disabled={isLoading}
          >
            <Text style={styles.quickActionText}>Warm Reading</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionButton, styles.sleepButton]}
            onPress={() => {
              setSelectedColor('#FF0000');
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
              setSelectedColor('#0000FF');
              setBrightness(60);
              handleSetAmbientLight();
            }}
            disabled={isLoading}
          >
            <Text style={styles.quickActionText}>Play Time</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Color Testing Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🧪 Color Testing</Text>
        <Text style={styles.testDescription}>
          Test primary colors to verify color accuracy on your device
        </Text>
        <View style={styles.colorTestGrid}>
          {[
            { name: 'Red', color: '#FF0000' },
            { name: 'Green', color: '#00FF00' },
            { name: 'Blue', color: '#0000FF' },
            { name: 'White', color: '#FFFFFF' },
          ].map((testColor) => (
            <TouchableOpacity
              key={testColor.name}
              style={[styles.colorTestButton, { backgroundColor: testColor.color }]}
              onPress={() => {
                setSelectedColor(testColor.color);
                setBrightness(75);
                // Auto-apply for testing
                setTimeout(() => handleSetAmbientLight(), 100);
              }}
              disabled={isLoading}
            >
              <Text style={[
                styles.colorTestText,
                testColor.name === 'White' ? { color: '#333' } : { color: '#FFF' }
              ]}>
                {testColor.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.testNote}>
          💡 Test these colors to verify they display correctly on your device
        </Text>
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
  brightnessControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  brightnessButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 10,
  },
  brightnessButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  brightnessDisplay: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  brightnessText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
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
  testDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  colorTestGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  colorTestButton: {
    width: 70,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#DDD',
  },
  colorTestText: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  testNote: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
