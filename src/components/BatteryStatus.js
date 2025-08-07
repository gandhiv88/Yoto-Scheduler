import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const BatteryStatus = ({ batteryInfo }) => {
  if (!batteryInfo || batteryInfo.level === undefined) {
    return null;
  }

  const getBatteryIcon = (level, isCharging) => {
    if (isCharging) {
      return '🔌';
    }
    
    if (level >= 80) return '🔋';
    if (level >= 60) return '🔋';
    if (level >= 40) return '🪫';
    if (level >= 20) return '🪫';
    return '🪫';
  };

  const getBatteryColor = (level) => {
    if (level >= 60) return '#34C759'; // Green
    if (level >= 20) return '#FF9500'; // Orange
    return '#FF3B30'; // Red
  };

  const batteryLevel = batteryInfo.level;
  const isCharging = batteryInfo.isCharging;

  return (
    <View style={styles.container}>
      <View style={styles.batteryInfo}>
        <Text style={styles.batteryIcon}>
          {getBatteryIcon(batteryLevel, isCharging)}
        </Text>
        <View style={styles.batteryDetails}>
          <Text style={[styles.batteryLevel, { color: getBatteryColor(batteryLevel) }]}>
            {batteryLevel}%
          </Text>
          <Text style={styles.batteryStatus}>
            {isCharging ? 'Charging' : 'Battery'}
          </Text>
        </View>
      </View>
      
      {/* Battery bar visualization */}
      <View style={styles.batteryBar}>
        <View
          style={[
            styles.batteryFill,
            {
              width: `${batteryLevel}%`,
              backgroundColor: getBatteryColor(batteryLevel),
            }
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    marginBottom: 10,
  },
  batteryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batteryIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  batteryDetails: {
    flex: 1,
  },
  batteryLevel: {
    fontSize: 16,
    fontWeight: '600',
  },
  batteryStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  batteryBar: {
    marginTop: 8,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  batteryFill: {
    height: '100%',
    borderRadius: 2,
  },
});
