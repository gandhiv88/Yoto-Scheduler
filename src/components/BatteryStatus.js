import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const BatteryStatus = ({ batteryInfo }) => {
  if (!batteryInfo || batteryInfo.level === undefined) {
    return null;
  }

  const getBatteryColor = (level) => {
    if (level >= 60) return '#34C759'; // Green
    if (level >= 20) return '#FF9500'; // Orange
    return '#FF3B30'; // Red
  };

  const batteryLevel = batteryInfo.level;
  const isCharging = batteryInfo.isCharging;
  const batteryColor = getBatteryColor(batteryLevel);

  return (
    <View style={styles.container}>
      {/* Battery Icon */}
      <View style={styles.batteryIcon}>
        {/* Battery Body */}
        <View style={[styles.batteryBody, { borderColor: batteryColor }]}>
          {/* Battery Fill */}
          <View
            style={[
              styles.batteryFill,
              {
                width: `${Math.max(5, batteryLevel)}%`, // Minimum 5% width for visibility
                backgroundColor: batteryColor,
              }
            ]}
          />
        </View>
        {/* Battery Tip */}
        <View style={[styles.batteryTip, { backgroundColor: batteryColor }]} />
      </View>
      
      {/* Battery Percentage */}
      <Text style={[styles.batteryText, { color: batteryColor }]}>
        {batteryLevel}%
      </Text>
      
      {/* Charging Indicator */}
      {isCharging && (
        <Text style={styles.chargingIcon}>⚡</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start', // Make it compact
  },
  batteryIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  batteryBody: {
    width: 20,
    height: 10,
    borderWidth: 1,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    position: 'relative',
  },
  batteryFill: {
    height: '100%',
    borderRadius: 1,
  },
  batteryTip: {
    width: 2,
    height: 6,
    borderTopRightRadius: 1,
    borderBottomRightRadius: 1,
    marginLeft: 1,
  },
  batteryText: {
    fontSize: 12,
    fontWeight: '500',
    marginRight: 4,
  },
  chargingIcon: {
    fontSize: 12,
    marginLeft: 2,
  },
});
