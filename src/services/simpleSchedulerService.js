import * as SecureStore from 'expo-secure-store';

export class SchedulerService {
  static SCHEDULES_KEY = 'yoto_schedules';
  static isInitialized = false;
  static schedulerInterval = null;
  
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
      console.log('📅 [SCHEDULER] Initializing simple scheduler service...');
      
      // Start foreground scheduler (checks every minute when app is active)
      this.startForegroundScheduler();
      
      this.isInitialized = true;
      console.log('✅ [SCHEDULER] Simple scheduler service initialized (foreground only)');
    } catch (error) {
      console.error('❌ [SCHEDULER] Failed to initialize:', error);
      this.isInitialized = true; // Mark as initialized to prevent retry loops
    }
  }

  static startForegroundScheduler() {
    // Clear any existing interval
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
    
    // Check every 30 seconds when app is active
    this.schedulerInterval = setInterval(async () => {
      try {
        await this.checkAndExecuteSchedules();
      } catch (error) {
        console.error('❌ [SCHEDULER] Error in foreground scheduler:', error);
      }
    }, 30000); // 30 seconds
    
    console.log('⏰ [SCHEDULER] Foreground scheduler started (30-second intervals)');
  }

  static stopForegroundScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      console.log('⏰ [SCHEDULER] Foreground scheduler stopped');
    }
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
      
      if (schedules.length > 0) {
        console.log(`⏰ [SCHEDULER] Checking ${schedules.length} schedules at ${now.toLocaleTimeString()}`);
      }
      
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
          
          // Log success
          console.log(`✅ [SCHEDULER] Card "${schedule.cardTitle}" played successfully on ${schedule.playerName}`);
          
        } catch (error) {
          console.error('❌ [SCHEDULER] Failed to play card:', error);
          console.log(`❌ [SCHEDULER] Could not play "${schedule.cardTitle}" on ${schedule.playerName}: ${error.message}`);
        }
      } else {
        // Device is offline
        console.log('📴 [SCHEDULER] Device offline');
        console.log(`📴 [SCHEDULER] Could not play "${schedule.cardTitle}" because ${schedule.playerName} is offline`);
      }
    } catch (error) {
      console.error('❌ [SCHEDULER] Failed to execute schedule:', error);
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

  // Set MQTT client for foreground execution
  static setMqttClient(mqttClient) {
    this.mqttClient = mqttClient;
  }

  // Manual check (can be called from UI)
  static async checkNow(mqttClient) {
    console.log('🔍 [SCHEDULER] Manual schedule check requested');
    await this.checkAndExecuteSchedules(mqttClient);
  }
}
