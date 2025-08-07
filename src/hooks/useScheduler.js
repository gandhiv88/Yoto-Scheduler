import { useState, useEffect, useCallback } from 'react';
import { SchedulerService } from '../services/simpleSchedulerService';

export const useScheduler = (player, mqttClient) => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load schedules for the current player
  const loadSchedules = useCallback(async () => {
    if (!player) {
      setSchedules([]);
      return;
    }

    setLoading(true);
    try {
      const playerSchedules = await SchedulerService.getSchedulesForPlayer(player.id);
      setSchedules(playerSchedules);
      setError(null);
    } catch (err) {
      console.error('Failed to load schedules:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [player]);

  // Create a new schedule
  const createSchedule = useCallback(async (scheduleData) => {
    setLoading(true);
    try {
      const newSchedule = await SchedulerService.createSchedule({
        ...scheduleData,
        playerId: player.id,
        playerName: player.name,
      });
      
      // Reload schedules to get updated list
      await loadSchedules();
      setError(null);
      return newSchedule;
    } catch (err) {
      console.error('Failed to create schedule:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [player, loadSchedules]);

  // Update an existing schedule
  const updateSchedule = useCallback(async (scheduleId, updates) => {
    setLoading(true);
    try {
      const updatedSchedule = await SchedulerService.updateSchedule(scheduleId, updates);
      await loadSchedules();
      setError(null);
      return updatedSchedule;
    } catch (err) {
      console.error('Failed to update schedule:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadSchedules]);

  // Delete a schedule
  const deleteSchedule = useCallback(async (scheduleId) => {
    setLoading(true);
    try {
      await SchedulerService.deleteSchedule(scheduleId);
      await loadSchedules();
      setError(null);
    } catch (err) {
      console.error('Failed to delete schedule:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadSchedules]);

  // Toggle schedule enabled/disabled
  const toggleSchedule = useCallback(async (scheduleId, isEnabled) => {
    return await updateSchedule(scheduleId, { isEnabled });
  }, [updateSchedule]);

  // Manual check for due schedules
  const checkNow = useCallback(async () => {
    if (!mqttClient) {
      console.log('⚠️ [SCHEDULER_HOOK] No MQTT client available for manual check');
      return;
    }
    
    try {
      await SchedulerService.checkNow(mqttClient);
    } catch (err) {
      console.error('Manual schedule check failed:', err);
      setError(err.message);
    }
  }, [mqttClient]);

  // Load schedules when player changes
  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  // Set MQTT client for scheduler service when available
  useEffect(() => {
    if (mqttClient) {
      SchedulerService.setMqttClient(mqttClient);
    }
  }, [mqttClient]);

  return {
    schedules,
    loading,
    error,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    toggleSchedule,
    loadSchedules,
    checkNow,
  };
};
