import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

/**
 * Expo Go Compatible Background Scheduler
 * Provides basic background scheduling using notifications as fallback
 */
class ExpoGoSchedulerService {
  constructor() {
    this.schedules = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Request notification permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.warn('🔔 [EXPO-SCHEDULER] Notification permission denied');
      } else {
        console.log('✅ [EXPO-SCHEDULER] Notification permissions granted');
      }

      // Configure notifications
      await Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });

      // Load existing schedules
      await this.loadSchedules();
      
      this.initialized = true;
      console.log('✅ [EXPO-SCHEDULER] Expo Go scheduler initialized');
      
    } catch (error) {
      console.error('❌ [EXPO-SCHEDULER] Initialization failed:', error);
    }
  }

  async loadSchedules() {
    try {
      const stored = await AsyncStorage.getItem('expogo_schedules');
      if (stored) {
        const schedules = JSON.parse(stored);
        for (const schedule of schedules) {
          this.schedules.set(schedule.id, schedule);
          // Schedule notification for each
          await this.scheduleNotification(schedule);
        }
        console.log(`📅 [EXPO-SCHEDULER] Loaded ${schedules.length} schedules`);
      }
    } catch (error) {
      console.error('❌ [EXPO-SCHEDULER] Failed to load schedules:', error);
    }
  }

  async saveSchedules() {
    try {
      const schedules = Array.from(this.schedules.values());
      await AsyncStorage.setItem('expogo_schedules', JSON.stringify(schedules));
    } catch (error) {
      console.error('❌ [EXPO-SCHEDULER] Failed to save schedules:', error);
    }
  }

  async addSchedule(schedule) {
    try {
      this.schedules.set(schedule.id, schedule);
      await this.scheduleNotification(schedule);
      await this.saveSchedules();
      
      console.log(`📅 [EXPO-SCHEDULER] Schedule added: ${schedule.cardTitle} at ${schedule.scheduledTime}`);
      return { success: true, scheduleId: schedule.id };
    } catch (error) {
      console.error('❌ [EXPO-SCHEDULER] Failed to add schedule:', error);
      return { success: false, error: error.message };
    }
  }

  async scheduleNotification(schedule) {
    try {
      // Cancel existing notification
      await Notifications.cancelScheduledNotificationAsync(schedule.id);
      
      const scheduledTime = new Date(schedule.scheduledTime);
      const now = new Date();
      
      if (scheduledTime <= now) {
        console.log('⚠️ [EXPO-SCHEDULER] Schedule is in the past, skipping notification');
        return;
      }

      // Schedule notification
      await Notifications.scheduleNotificationAsync({
        identifier: schedule.id,
        content: {
          title: '🎵 Yoto Schedule Ready',
          body: `Time to play "${schedule.cardTitle}" on your Yoto player!`,
          data: {
            scheduleId: schedule.id,
            cardId: schedule.cardId,
            cardTitle: schedule.cardTitle,
            cardUri: schedule.cardUri,
            playerId: schedule.playerId,
            playerName: schedule.playerName,
          },
          sound: true,
        },
        trigger: {
          date: scheduledTime,
        },
      });

      console.log(`🔔 [EXPO-SCHEDULER] Notification scheduled for ${schedule.cardTitle} at ${scheduledTime}`);
    } catch (error) {
      console.error('❌ [EXPO-SCHEDULER] Failed to schedule notification:', error);
    }
  }

  async removeSchedule(scheduleId) {
    try {
      this.schedules.delete(scheduleId);
      await Notifications.cancelScheduledNotificationAsync(scheduleId);
      await this.saveSchedules();
      
      console.log(`🗑️ [EXPO-SCHEDULER] Schedule removed: ${scheduleId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ [EXPO-SCHEDULER] Failed to remove schedule:', error);
      return { success: false, error: error.message };
    }
  }

  async getSchedules() {
    return Array.from(this.schedules.values());
  }

  getCapabilities() {
    return {
      hasBackgroundFetch: false,
      hasTaskManager: false,
      hasNotifications: true,
      isExpoGo: true,
      limitations: [
        'Schedules work via notifications only',
        'Requires app to be in memory for MQTT connection',
        'Best used with notification-based reminders',
        'For true background execution, use development build'
      ]
    };
  }

  // Listen for notification responses
  setupNotificationListener(mqttClient) {
    Notifications.addNotificationResponseReceivedListener(async (response) => {
      const { data } = response.notification.request.content;
      
      if (data.scheduleId && data.cardUri && data.playerId) {
        console.log('🔔 [EXPO-SCHEDULER] User tapped notification, attempting to play card');
        
        try {
          if (mqttClient && mqttClient.isConnected()) {
            await mqttClient.playCard(data.playerId, data.cardUri);
            console.log(`✅ [EXPO-SCHEDULER] Played "${data.cardTitle}" via notification`);
          } else {
            console.warn('⚠️ [EXPO-SCHEDULER] MQTT client not available, card not played');
          }
        } catch (error) {
          console.error('❌ [EXPO-SCHEDULER] Failed to play card from notification:', error);
        }
      }
    });
  }
}

export const ExpoGoScheduler = new ExpoGoSchedulerService();
