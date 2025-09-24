import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { ExpoGoScheduler } from '../services/expoGoSchedulerService';
import { SchedulerService } from '../services/simpleSchedulerService';

export const ExpoGoBackgroundStatus = ({ onBack }) => {
  const [capabilities, setCapabilities] = useState(null);
  const [schedules, setSchedules] = useState([]);

  useEffect(() => {
    loadCapabilities();
    loadSchedules();
  }, []);

  const loadCapabilities = async () => {
    const caps = ExpoGoScheduler.getCapabilities();
    setCapabilities(caps);
  };

  const loadSchedules = async () => {
    try {
      // Get notification schedules from ExpoGo scheduler
      const notificationSchedules = await ExpoGoScheduler.getSchedules();
      
      // Get regular schedules from SchedulerService
      const regularSchedules = await SchedulerService.getAllSchedules();
      
      // Combine both types of schedules
      const allSchedules = [
        ...notificationSchedules.map(schedule => ({
          ...schedule,
          type: 'notification',
        })),
        ...regularSchedules.map(schedule => ({
          ...schedule,
          type: 'regular',
        })),
      ];
      
      setSchedules(allSchedules);
    } catch (error) {
      console.error('Failed to load schedules:', error);
      setSchedules([]);
    }
  };

  const testNotification = async () => {
    try {
      await ExpoGoScheduler.addSchedule({
        id: 'test-notification',
        cardTitle: 'Test Notification',
        cardId: 'test',
        cardUri: 'https://yoto.io/test',
        playerId: 'test-player',
        playerName: 'Test Player',
        scheduledTime: new Date(Date.now() + 5000), // 5 seconds from now
        daysOfWeek: [],
        repeatWeekly: false,
        isEnabled: true,
        createdAt: new Date(),
      });
      
      Alert.alert(
        'Test Scheduled',
        'A test notification will appear in 5 seconds!',
        [{ text: 'OK' }]
      );
      
      setTimeout(loadSchedules, 1000);
    } catch (error) {
      Alert.alert('Error', 'Failed to schedule test notification');
    }
  };

  if (!capabilities) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Background Status</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📱 Current Environment</Text>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Running in:</Text>
          <Text style={[styles.statusValue, styles.expoGo]}>Expo Go</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Background Fetch:</Text>
          <Text style={[styles.statusValue, styles.unavailable]}>❌ Not Available</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Task Manager:</Text>
          <Text style={[styles.statusValue, styles.unavailable]}>❌ Not Available</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Notifications:</Text>
          <Text style={[styles.statusValue, styles.available]}>✅ Available</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚠️ Limitations</Text>
        {capabilities.limitations.map((limitation, index) => (
          <Text key={index} style={styles.limitation}>• {limitation}</Text>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 How It Works</Text>
        <Text style={styles.explanation}>
          In Expo Go, schedules work through notifications:
        </Text>
        <Text style={styles.step}>1. Schedule creates a local notification</Text>
        <Text style={styles.step}>2. Notification appears at scheduled time</Text>
        <Text style={styles.step}>3. Tap notification to play the card</Text>
        <Text style={styles.step}>4. App must be in memory for MQTT connection</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚀 For True Background Scheduling</Text>
        <Text style={styles.upgradeText}>
          To get schedules that work automatically when the app is closed:
        </Text>
        <Text style={styles.step}>1. Use EAS development build</Text>
        <Text style={styles.step}>2. Enable background app refresh on iOS</Text>
        <Text style={styles.step}>3. Background tasks will handle execution</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Active Schedules</Text>
        {schedules.length === 0 ? (
          <Text style={styles.noSchedules}>No schedules found</Text>
        ) : (
          schedules.map((schedule) => (
            <View key={schedule.id} style={styles.scheduleItem}>
              <View style={styles.scheduleHeader}>
                <Text style={styles.scheduleName}>{schedule.cardTitle}</Text>
                <Text style={[
                  styles.scheduleType,
                  schedule.type === 'notification' ? styles.notificationType : styles.regularType
                ]}>
                  {schedule.type === 'notification' ? '🔔 Notification' : '⚡ Active'}
                </Text>
              </View>
              <Text style={styles.scheduleTime}>
                {new Date(schedule.scheduledTime).toLocaleString()}
              </Text>
              {schedule.type === 'notification' && (
                <Text style={styles.scheduleNote}>
                  Tap notification when it appears to play
                </Text>
              )}
            </View>
          ))
        )}
      </View>

      <TouchableOpacity style={styles.testButton} onPress={testNotification}>
        <Text style={styles.testButtonText}>🔔 Test Notification</Text>
      </TouchableOpacity>
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
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
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
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusLabel: {
    fontSize: 16,
    color: '#666',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  available: {
    color: '#34C759',
  },
  unavailable: {
    color: '#FF3B30',
  },
  expoGo: {
    color: '#007AFF',
  },
  limitation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  explanation: {
    fontSize: 16,
    color: '#333',
    marginBottom: 15,
    lineHeight: 22,
  },
  step: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    paddingLeft: 10,
    lineHeight: 20,
  },
  upgradeText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 15,
    lineHeight: 22,
  },
  noSchedules: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  scheduleItem: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  scheduleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  scheduleType: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  notificationType: {
    backgroundColor: '#FFF3CD',
    color: '#856404',
  },
  regularType: {
    backgroundColor: '#D4EDDA',
    color: '#155724',
  },
  scheduleTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  scheduleNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
  testButton: {
    backgroundColor: '#007AFF',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
