import * as SecureStore from 'expo-secure-store';

// Conditional imports to handle missing native modules
let Notifications, TaskManager, BackgroundFetch;

try {
  Notifications = require('expo-notifications');
} catch (error) {
  console.warn('⚠️ [SCHEDULER] expo-notifications not available:', error.message);
  Notifications = null;
}

try {
  TaskManager = require('expo-task-manager');
} catch (error) {
  console.warn('⚠️ [SCHEDULER] expo-task-manager not available:', error.message);
  TaskManager = null;
}

try {
  BackgroundFetch = require('expo-background-fetch');
} catch (error) {
  console.warn('⚠️ [SCHEDULER] expo-background-fetch not available:', error.message);
  BackgroundFetch = null;
}

// Task name for background scheduling
const SCHEDULER_TASK_NAME = 'yoto-card-scheduler';

// Configure notifications
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export class SchedulerService {
  static SCHEDULES_KEY = 'yoto_schedules';
  static isInitialized = false;
  
  // Schedule structure:
  // {
  //   id: string,
  //   cardId: string,
  //   cardTitle: string,
  //   cardUri: string,
  //   playerId: string,
  //   playerName: string,
  //   scheduledTime: Date,
  //   daysOfWeek: number[], // 0=Sunday, 1=Monday, etc.
  //   isEnabled: boolean,
  //   repeatWeekly: boolean,
  //   createdAt: Date,
  //   lastTriggered: Date | null,
  //   notifyIfOffline: boolean
  // }

  static async initialize() {
    if (this.isInitialized) return;
    
    try {
      console.log('📅 [SCHEDULER] Initializing scheduler service...');
      
      // Request notification permissions with error handling
      try {
        if (Notifications) {
          const { status } = await Notifications.requestPermissionsAsync();
          if (status !== 'granted') {
            console.warn('⚠️ [SCHEDULER] Notification permissions not granted');
          } else {
            console.log('✅ [SCHEDULER] Notification permissions granted');
          }
        } else {
          console.warn('⚠️ [SCHEDULER] Notifications module not available, scheduling will work without push notifications');
        }
      } catch (notificationError) {
        console.warn('⚠️ [SCHEDULER] Notification module not available:', notificationError.message);
        // Continue without notifications if module isn't available
      }
      
      // Register background task with error handling
      try {
        await this.registerBackgroundTask();
        
        // Start background fetch
        if (BackgroundFetch) {
          await BackgroundFetch.registerTaskAsync(SCHEDULER_TASK_NAME, {
            minimumInterval: 60, // Check every minute
            stopOnTerminate: false,
            startOnBoot: true,
          });
        } else {
          console.warn('⚠️ [SCHEDULER] Background fetch not available, using foreground scheduling only');
        }
      } catch (backgroundError) {
        console.warn('⚠️ [SCHEDULER] Background task module not available:', backgroundError.message);
        // Continue without background tasks if module isn't available
      }
      
      this.isInitialized = true;
      console.log('✅ [SCHEDULER] Scheduler service initialized');
    } catch (error) {
      console.error('❌ [SCHEDULER] Failed to initialize:', error);
      // Don't throw error, allow app to continue without full scheduler functionality
      this.isInitialized = true; // Mark as initialized to prevent retry loops
    }
  }

  static async registerBackgroundTask() {
    if (!TaskManager || !BackgroundFetch) {
      console.warn('⚠️ [SCHEDULER] Background task modules not available, using foreground scheduling only');
      return;
    }
    
    TaskManager.defineTask(SCHEDULER_TASK_NAME, async () => {
      try {
        console.log('⏰ [SCHEDULER] Background task executing...');
        await this.checkAndExecuteSchedules();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (error) {
        console.error('❌ [SCHEDULER] Background task error:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
  }

  // Create a new schedule
  static async createSchedule(scheduleData) {
    try {
      const schedule = {
        id: this.generateId(),
        ...scheduleData,
        createdAt: new Date(),
        lastTriggered: null,
        isEnabled: true,
      };
      
      console.log('📅 [SCHEDULER] Creating new schedule:', {
        id: schedule.id,
        cardTitle: schedule.cardTitle,
        scheduledTime: schedule.scheduledTime,
        daysOfWeek: schedule.daysOfWeek,
        repeatWeekly: schedule.repeatWeekly
      });
      
      const schedules = await this.getAllSchedules();
      schedules.push(schedule);
      await this.saveSchedules(schedules);
      
      // Schedule local notification if enabled
      if (schedule.notifyIfOffline) {
        await this.scheduleNotification(schedule);
      }
      
      console.log('✅ [SCHEDULER] Schedule created successfully');
      return schedule;
    } catch (error) {
      console.error('❌ [SCHEDULER] Failed to create schedule:', error);
      throw error;
    }
  }

  // Get all schedules
  static async getAllSchedules() {
    try {
      const schedulesJson = await SecureStore.getItemAsync(this.SCHEDULES_KEY);
      if (!schedulesJson) return [];
      
      const schedules = JSON.parse(schedulesJson);
      // Convert date strings back to Date objects
      return schedules.map(schedule => ({
        ...schedule,
        scheduledTime: new Date(schedule.scheduledTime),
        createdAt: new Date(schedule.createdAt),
        lastTriggered: schedule.lastTriggered ? new Date(schedule.lastTriggered) : null
      }));
    } catch (error) {
      console.error('❌ [SCHEDULER] Failed to get schedules:', error);
      return [];
    }
  }

  // Save schedules to storage
  static async saveSchedules(schedules) {
    try {
      const schedulesJson = JSON.stringify(schedules);
      await SecureStore.setItemAsync(this.SCHEDULES_KEY, schedulesJson);
    } catch (error) {
      console.error('❌ [SCHEDULER] Failed to save schedules:', error);
      throw error;
    }
  }

  // Update a schedule
  static async updateSchedule(scheduleId, updates) {
    try {
      const schedules = await this.getAllSchedules();
      const index = schedules.findIndex(s => s.id === scheduleId);
      
      if (index === -1) {
        throw new Error('Schedule not found');
      }
      
      schedules[index] = { ...schedules[index], ...updates };
      await this.saveSchedules(schedules);
      
      console.log('✅ [SCHEDULER] Schedule updated:', scheduleId);
      return schedules[index];
    } catch (error) {
      console.error('❌ [SCHEDULER] Failed to update schedule:', error);
      throw error;
    }
  }

  // Delete a schedule
  static async deleteSchedule(scheduleId) {
    try {
      const schedules = await this.getAllSchedules();
      const filteredSchedules = schedules.filter(s => s.id !== scheduleId);
      await this.saveSchedules(filteredSchedules);
      
      // Cancel any pending notifications for this schedule
      try {
        if (Notifications && Notifications.cancelScheduledNotificationAsync) {
          await Notifications.cancelScheduledNotificationAsync(scheduleId);
        }
      } catch (notificationError) {
        console.warn('⚠️ [SCHEDULER] Could not cancel notification:', notificationError.message);
      }
      
      console.log('✅ [SCHEDULER] Schedule deleted:', scheduleId);
    } catch (error) {
      console.error('❌ [SCHEDULER] Failed to delete schedule:', error);
      throw error;
    }
  }

  // Check and execute due schedules
  static async checkAndExecuteSchedules(mqttClient = null) {
    try {
      const schedules = await this.getAllSchedules();
      const now = new Date();
      
      console.log(`⏰ [SCHEDULER] Checking ${schedules.length} schedules at ${now.toLocaleTimeString()}`);
      
      for (const schedule of schedules) {
        if (!schedule.isEnabled) continue;
        
        if (this.isScheduleDue(schedule, now)) {
          console.log('🔔 [SCHEDULER] Schedule is due:', schedule.cardTitle);
          await this.executeSchedule(schedule, mqttClient);
        }
      }
    } catch (error) {
      console.error('❌ [SCHEDULER] Error checking schedules:', error);
    }
  }

  // Check if a schedule is due
  static isScheduleDue(schedule, currentTime) {
    const scheduledTime = new Date(schedule.scheduledTime);
    const currentDay = currentTime.getDay();
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    
    // Check if today is a scheduled day
    if (!schedule.daysOfWeek.includes(currentDay)) {
      return false;
    }
    
    // Check if current time matches scheduled time (within 1 minute window)
    const scheduledHour = scheduledTime.getHours();
    const scheduledMinute = scheduledTime.getMinutes();
    
    const isTimeMatch = currentHour === scheduledHour && 
                       Math.abs(currentMinute - scheduledMinute) <= 1;
    
    if (!isTimeMatch) return false;
    
    // Prevent duplicate execution within the same minute
    if (schedule.lastTriggered) {
      const lastTriggered = new Date(schedule.lastTriggered);
      const timeDiff = currentTime.getTime() - lastTriggered.getTime();
      if (timeDiff < 60000) { // Less than 1 minute ago
        return false;
      }
    }
    
    return true;
  }

  // Execute a schedule
  static async executeSchedule(schedule, mqttClient) {
    try {
      console.log('🎵 [SCHEDULER] Executing schedule:', schedule.cardTitle);
      
      // Update last triggered time
      await this.updateSchedule(schedule.id, { lastTriggered: new Date() });
      
      if (mqttClient && mqttClient.isConnectionHealthy()) {
        // Device is online, play the card
        console.log('📱 [SCHEDULER] Device online, playing card...');
        
        try {
          await mqttClient.playCard(schedule.playerId, schedule.cardUri);
          
          // Send success notification
          await this.sendNotification(
            'Card Played Successfully',
            `"${schedule.cardTitle}" is now playing on ${schedule.playerName}`,
            { scheduleId: schedule.id, success: true }
          );
          
          console.log('✅ [SCHEDULER] Card played successfully');
        } catch (error) {
          console.error('❌ [SCHEDULER] Failed to play card:', error);
          
          // Send error notification
          await this.sendNotification(
            'Failed to Play Card',
            `Could not play "${schedule.cardTitle}" on ${schedule.playerName}. ${error.message}`,
            { scheduleId: schedule.id, success: false, error: error.message }
          );
        }
      } else {
        // Device is offline
        console.log('📴 [SCHEDULER] Device offline, sending notification...');
        
        if (schedule.notifyIfOffline) {
          await this.sendNotification(
            'Device Offline',
            `Could not play "${schedule.cardTitle}" because ${schedule.playerName} is offline.`,
            { scheduleId: schedule.id, offline: true }
          );
        }
      }
    } catch (error) {
      console.error('❌ [SCHEDULER] Failed to execute schedule:', error);
    }
  }

  // Schedule a notification
  static async scheduleNotification(schedule) {
    try {
      // Check if notifications module is available
      if (!Notifications || !Notifications.scheduleNotificationAsync) {
        console.warn('⚠️ [SCHEDULER] Notifications module not available, skipping scheduled notifications');
        return;
      }
      
      const scheduledTime = new Date(schedule.scheduledTime);
      
      // For each day of the week, schedule a notification
      for (const dayOfWeek of schedule.daysOfWeek) {
        const notificationTime = new Date();
        notificationTime.setDay(dayOfWeek);
        notificationTime.setHours(scheduledTime.getHours(), scheduledTime.getMinutes(), 0, 0);
        
        // If the time has passed today, schedule for next week
        if (notificationTime <= new Date()) {
          notificationTime.setDate(notificationTime.getDate() + 7);
        }
        
        await Notifications.scheduleNotificationAsync({
          identifier: `${schedule.id}-${dayOfWeek}`,
          content: {
            title: 'Scheduled Card Playback',
            body: `Time to play "${schedule.cardTitle}" on ${schedule.playerName}`,
            data: { scheduleId: schedule.id, dayOfWeek }
          },
          trigger: notificationTime
        });
      }
    } catch (error) {
      console.error('❌ [SCHEDULER] Failed to schedule notification:', error);
      // Continue without scheduled notifications
    }
  }

  // Send immediate notification
  static async sendNotification(title, body, data = {}) {
    try {
      // Check if notifications module is available
      if (!Notifications || !Notifications.scheduleNotificationAsync) {
        console.warn('⚠️ [SCHEDULER] Notifications module not available, logging instead');
        console.log(`📱 [NOTIFICATION] ${title}: ${body}`);
        return;
      }
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data
        },
        trigger: null // Send immediately
      });
    } catch (error) {
      console.error('❌ [SCHEDULER] Failed to send notification:', error);
      // Fallback to console logging
      console.log(`📱 [NOTIFICATION FALLBACK] ${title}: ${body}`);
    }
  }

  // Get schedules for a specific player
  static async getSchedulesForPlayer(playerId) {
    const allSchedules = await this.getAllSchedules();
    return allSchedules.filter(schedule => schedule.playerId === playerId);
  }

  // Get schedules for a specific card
  static async getSchedulesForCard(cardId) {
    const allSchedules = await this.getAllSchedules();
    return allSchedules.filter(schedule => schedule.cardId === cardId);
  }

  // Enable/disable a schedule
  static async toggleSchedule(scheduleId, isEnabled) {
    return await this.updateSchedule(scheduleId, { isEnabled });
  }

  // Helper function to generate unique IDs
  static generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Format time for display
  static formatTime(date) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // Format days for display
  static formatDays(daysArray) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (daysArray.length === 7) return 'Every day';
    if (daysArray.length === 5 && !daysArray.includes(0) && !daysArray.includes(6)) return 'Weekdays';
    if (daysArray.length === 2 && daysArray.includes(0) && daysArray.includes(6)) return 'Weekends';
    return daysArray.map(day => dayNames[day]).join(', ');
  }

  // Get next execution time for a schedule
  static getNextExecutionTime(schedule) {
    const now = new Date();
    const scheduledTime = new Date(schedule.scheduledTime);
    
    // Find the next day that matches the schedule
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(now.getDate() + i);
      checkDate.setHours(scheduledTime.getHours(), scheduledTime.getMinutes(), 0, 0);
      
      if (schedule.daysOfWeek.includes(checkDate.getDay()) && checkDate > now) {
        return checkDate;
      }
    }
    
    return null;
  }

  // Clean up old schedules (older than 30 days and not repeating)
  static async cleanupOldSchedules() {
    try {
      const schedules = await this.getAllSchedules();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const activeSchedules = schedules.filter(schedule => {
        if (schedule.repeatWeekly) return true; // Keep repeating schedules
        
        const scheduleDate = new Date(schedule.scheduledTime);
        return scheduleDate > thirtyDaysAgo; // Keep recent schedules
      });
      
      if (activeSchedules.length !== schedules.length) {
        await this.saveSchedules(activeSchedules);
        console.log(`🧹 [SCHEDULER] Cleaned up ${schedules.length - activeSchedules.length} old schedules`);
      }
    } catch (error) {
      console.error('❌ [SCHEDULER] Failed to cleanup old schedules:', error);
    }
  }
}
