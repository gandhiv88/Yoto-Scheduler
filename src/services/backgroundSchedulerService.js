import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { SchedulerService } from './simpleSchedulerService';
import { MQTTService } from './mqttService';

const BACKGROUND_FETCH_TASK = 'background-schedule-check';

export class BackgroundSchedulerService {
  static isRegistered = false;

  // Initialize background scheduling
  static async initialize() {
    try {
      console.log('🌙 [BACKGROUND] Initializing background scheduler...');
      
      // Request notification permissions
      await this.requestNotificationPermissions();
      
      // Register background task
      await this.registerBackgroundTask();
      
      // Schedule notification-based scheduling as backup
      await this.scheduleNotificationChecks();
      
      console.log('✅ [BACKGROUND] Background scheduler initialized');
    } catch (error) {
      console.error('❌ [BACKGROUND] Failed to initialize:', error);
    }
  }

  // Request notification permissions
  static async requestNotificationPermissions() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('⚠️ [BACKGROUND] Notification permission not granted');
      return false;
    }

    console.log('✅ [BACKGROUND] Notification permissions granted');
    return true;
  }

  // Register background fetch task
  static async registerBackgroundTask() {
    try {
      // Define the background task
      TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
        console.log('🌙 [BACKGROUND] Running background schedule check...');
        
        try {
          // Get all schedules
          const schedules = await SchedulerService.getAllSchedules();
          const now = new Date();
          
          // Check for due schedules
          for (const schedule of schedules) {
            if (!schedule.isEnabled) continue;
            
            if (SchedulerService.isScheduleDue(schedule, now)) {
              console.log('🔔 [BACKGROUND] Schedule due:', schedule.cardTitle);
              
              // Send notification to user
              await this.sendScheduleNotification(schedule);
              
              // Try to connect and play if possible
              await this.attemptBackgroundPlay(schedule);
              
              // Update last triggered
              await SchedulerService.updateSchedule(schedule.id, { 
                lastTriggered: new Date() 
              });
            }
          }
          
          return BackgroundFetch.BackgroundFetchResult.NewData;
        } catch (error) {
          console.error('❌ [BACKGROUND] Background task error:', error);
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
      });

      // Register the background fetch task
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
      
      if (!isRegistered) {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
          minimumInterval: 60 * 1000, // 1 minute minimum
          stopOnTerminate: false,
          startOnBoot: true,
        });
        
        console.log('✅ [BACKGROUND] Background fetch registered');
        this.isRegistered = true;
      } else {
        console.log('ℹ️ [BACKGROUND] Background fetch already registered');
        this.isRegistered = true;
      }
    } catch (error) {
      console.error('❌ [BACKGROUND] Failed to register background task:', error);
    }
  }

  // Send notification when schedule is due
  static async sendScheduleNotification(schedule) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🎵 Yoto Schedule Active',
          body: `Playing "${schedule.cardTitle}" on ${schedule.playerName}`,
          data: { 
            scheduleId: schedule.id,
            cardTitle: schedule.cardTitle,
            playerName: schedule.playerName
          },
        },
        trigger: null, // Send immediately
      });
      
      console.log('📢 [BACKGROUND] Notification sent for schedule:', schedule.cardTitle);
    } catch (error) {
      console.error('❌ [BACKGROUND] Failed to send notification:', error);
    }
  }

  // Attempt to play card in background (limited capabilities)
  static async attemptBackgroundPlay(schedule) {
    try {
      console.log('🎵 [BACKGROUND] Attempting background play for:', schedule.cardTitle);
      
      // Initialize MQTT service for background operation
      const mqttService = new MQTTService();
      
      // Try to establish connection (this might fail in background)
      await mqttService.connect();
      
      if (mqttService.isConnectionHealthy()) {
        await mqttService.playCard(schedule.playerId, schedule.cardUri);
        console.log('✅ [BACKGROUND] Successfully played card in background');
      } else {
        console.log('📴 [BACKGROUND] Could not establish connection in background');
        
        // Schedule a notification to remind user to open app
        await this.scheduleOpenAppReminder(schedule);
      }
    } catch (error) {
      console.error('❌ [BACKGROUND] Background play failed:', error);
      
      // Schedule reminder notification
      await this.scheduleOpenAppReminder(schedule);
    }
  }

  // Schedule notification to remind user to open app
  static async scheduleOpenAppReminder(schedule) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📱 Open Yoto Scheduler',
          body: `Schedule for "${schedule.cardTitle}" needs the app to be open to play`,
          data: { 
            scheduleId: schedule.id,
            action: 'open_app',
            cardTitle: schedule.cardTitle
          },
        },
        trigger: {
          seconds: 30, // Remind after 30 seconds
        },
      });
    } catch (error) {
      console.error('❌ [BACKGROUND] Failed to schedule reminder:', error);
    }
  }

  // Schedule upcoming notification checks
  static async scheduleNotificationChecks() {
    try {
      // Cancel existing notifications
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      const schedules = await SchedulerService.getAllSchedules();
      
      for (const schedule of schedules) {
        if (!schedule.isEnabled) continue;
        
        const nextExecution = SchedulerService.getNextExecutionTime(schedule);
        if (!nextExecution) continue;
        
        // Schedule notification 1 minute before
        const notificationTime = new Date(nextExecution.getTime() - 60000);
        
        if (notificationTime > new Date()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '⏰ Yoto Schedule Coming Up',
              body: `"${schedule.cardTitle}" will play in 1 minute. Open app for best reliability.`,
              data: { 
                scheduleId: schedule.id,
                action: 'upcoming_schedule'
              },
            },
            trigger: notificationTime,
          });
          
          // Schedule the actual execution notification
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '🎵 Yoto Schedule Active',
              body: `"${schedule.cardTitle}" should be playing now on ${schedule.playerName}`,
              data: { 
                scheduleId: schedule.id,
                action: 'schedule_execution'
              },
            },
            trigger: nextExecution,
          });
        }
      }
      
      console.log('📅 [BACKGROUND] Scheduled notification checks for upcoming schedules');
    } catch (error) {
      console.error('❌ [BACKGROUND] Failed to schedule notification checks:', error);
    }
  }

  // Update scheduled notifications when schedules change
  static async updateScheduledNotifications() {
    await this.scheduleNotificationChecks();
  }

  // Check background fetch status
  static async getBackgroundFetchStatus() {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
      
      return {
        status,
        isRegistered,
        statusText: this.getStatusText(status)
      };
    } catch (error) {
      console.error('❌ [BACKGROUND] Failed to get background fetch status:', error);
      return { status: 'unknown', isRegistered: false, statusText: 'Unknown' };
    }
  }

  // Get human-readable status text
  static getStatusText(status) {
    switch (status) {
      case BackgroundFetch.BackgroundFetchStatus.Available:
        return 'Available';
      case BackgroundFetch.BackgroundFetchStatus.Denied:
        return 'Denied - Background refresh disabled';
      case BackgroundFetch.BackgroundFetchStatus.Restricted:
        return 'Restricted - Low Power Mode or restrictions';
      default:
        return 'Unknown';
    }
  }

  // Handle notification response
  static async handleNotificationResponse(response) {
    const data = response.notification.request.content.data;
    
    if (data.action === 'open_app') {
      console.log('📱 [BACKGROUND] User opened app from notification');
      // App is now open, trigger immediate schedule check
      await SchedulerService.checkNow();
    } else if (data.action === 'schedule_execution') {
      console.log('🎵 [BACKGROUND] Schedule execution notification received');
      // Trigger schedule check
      await SchedulerService.checkNow();
    }
  }

  // Manual background task trigger (for testing)
  static async triggerBackgroundCheck() {
    try {
      console.log('🧪 [BACKGROUND] Manually triggering background check...');
      
      const schedules = await SchedulerService.getAllSchedules();
      const now = new Date();
      
      for (const schedule of schedules) {
        if (!schedule.isEnabled) continue;
        
        console.log('🔍 [BACKGROUND] Checking schedule:', {
          title: schedule.cardTitle,
          scheduledTime: schedule.scheduledTime,
          daysOfWeek: schedule.daysOfWeek,
          isDue: SchedulerService.isScheduleDue(schedule, now)
        });
      }
      
      return true;
    } catch (error) {
      console.error('❌ [BACKGROUND] Manual trigger failed:', error);
      return false;
    }
  }

  // Cleanup
  static async cleanup() {
    try {
      if (this.isRegistered) {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
        this.isRegistered = false;
        console.log('🧹 [BACKGROUND] Background task unregistered');
      }
      
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('🧹 [BACKGROUND] All notifications cancelled');
    } catch (error) {
      console.error('❌ [BACKGROUND] Cleanup failed:', error);
    }
  }
}

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
