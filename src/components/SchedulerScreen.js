import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  FlatList,
  Switch,
  Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SchedulerService } from '../services/simpleSchedulerService';
import { useSnackBarContext } from '../contexts/SnackBarContext';

const DAYS_OF_WEEK = [
  { id: 0, name: 'Sunday', short: 'Sun' },
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
];

export function SchedulerScreen({ player, cards, mqttClient, onBack }) {
  const [schedules, setSchedules] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Edit mode state
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Use snackbar context
  const { showSuccess, showError, showWarning } = useSnackBarContext();
  
  // Create schedule form state
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [selectedDays, setSelectedDays] = useState([]);
  const [notifyIfOffline, setNotifyIfOffline] = useState(true);
  const [repeatWeekly, setRepeatWeekly] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCardPicker, setShowCardPicker] = useState(false);

  // Handler functions with useCallback for performance and debugging
  const handleCardPickerOpen = useCallback(() => {
    console.log('📋 [CARD] Opening card picker - button pressed');
    setShowCardPicker(true);
  }, []);

  const handleCardPickerClose = useCallback(() => {
    console.log('📋 [CARD] Closing card picker');
    setShowCardPicker(false);
  }, []);

  const handleTimePickerOpen = useCallback(() => {
    console.log('⏰ [TIME] Opening time picker - button pressed');
    setShowTimePicker(true);
  }, []);

  const handleTimePickerChange = useCallback((event, time) => {
    console.log('⏰ [TIME] Time picker event:', { type: event?.type, time });
    setShowTimePicker(false);
    if (event?.type === 'set' && time) {
      setSelectedTime(time);
    }
  }, []);

  useEffect(() => {
    loadSchedules();
    SchedulerService.initialize().catch(console.error);
  }, [player.id]); // Only re-run when player changes

  useEffect(() => {
    if (!mqttClient) return;
    
    // Start checking schedules every minute
    const interval = setInterval(() => {
      SchedulerService.checkAndExecuteSchedules(mqttClient);
    }, 60000);
    
    return () => clearInterval(interval);
  }, [mqttClient]); // Only re-run when mqttClient changes

  // Load schedules when component mounts

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const playerSchedules = await SchedulerService.getSchedulesForPlayer(player.id);
      setSchedules(playerSchedules);
    } catch (error) {
      console.error('Failed to load schedules:', error);
      showError('Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSchedule = async () => {
    // For edit mode, use the update function
    if (isEditMode) {
      await handleUpdateSchedule();
      return;
    }

    if (!selectedCard || selectedDays.length === 0) {
      showWarning('Please select a card and at least one day');
      return;
    }

    try {
      setLoading(true);
      
      const scheduleData = {
        cardId: selectedCard.id,
        cardTitle: selectedCard.title,
        cardUri: selectedCard.uri || `https://yoto.io/${selectedCard.id}`,
        playerId: player.id,
        playerName: player.name,
        scheduledTime: selectedTime,
        daysOfWeek: selectedDays,
        repeatWeekly,
        notifyIfOffline
      };

      await SchedulerService.createSchedule(scheduleData);
      
      showSuccess('Schedule created successfully!');
      setShowCreateModal(false);
      resetForm();
      await loadSchedules();
    } catch (error) {
      console.error('Failed to create schedule:', error);
      showError('Failed to create schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    // For now, directly delete - we could add a confirmation modal later
    try {
      await SchedulerService.deleteSchedule(scheduleId);
      await loadSchedules();
      showSuccess('Schedule deleted successfully');
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      showError('Failed to delete schedule');
    }
  };

  const handleToggleSchedule = async (scheduleId, currentState) => {
    try {
      await SchedulerService.toggleSchedule(scheduleId, !currentState);
      await loadSchedules();
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
      showError('Failed to toggle schedule');
    }
  };

  const resetForm = () => {
    setSelectedCard(null);
    setSelectedTime(new Date());
    setSelectedDays([]);
    setNotifyIfOffline(true);
    setRepeatWeekly(true);
    setIsEditMode(false);
    setEditingSchedule(null);
  };

  // Edit schedule functions
  const handleEditSchedule = (schedule) => {
    console.log('✏️ [EDIT] Starting edit for schedule:', schedule.cardTitle);
    
    // Pre-fill form with existing schedule data
    setSelectedCard({
      id: schedule.cardId,
      title: schedule.cardTitle,
      uri: schedule.cardUri
    });
    setSelectedTime(new Date(schedule.scheduledTime));
    setSelectedDays(schedule.daysOfWeek);
    setRepeatWeekly(schedule.repeatWeekly);
    setNotifyIfOffline(schedule.notifyIfOffline);
    
    // Set edit mode
    setIsEditMode(true);
    setEditingSchedule(schedule);
    setShowCreateModal(true);
  };

  const handleUpdateSchedule = async () => {
    if (selectedDays.length === 0) {
      showWarning('Please select at least one day');
      return;
    }

    try {
      setLoading(true);
      
      console.log('📝 [EDIT] Updating schedule:', {
        scheduleId: editingSchedule.id,
        originalTime: editingSchedule.scheduledTime,
        newTime: selectedTime,
        originalDays: editingSchedule.daysOfWeek,
        newDays: selectedDays
      });
      
      const updates = {
        scheduledTime: selectedTime,
        daysOfWeek: selectedDays,
        repeatWeekly,
        notifyIfOffline,
        lastTriggered: null // Reset trigger status so it can execute again
      };

      await SchedulerService.updateSchedule(editingSchedule.id, updates);
      
      console.log('✅ [EDIT] Schedule updated successfully');
      showSuccess('Schedule updated successfully!');
      setShowCreateModal(false);
      resetForm();
      await loadSchedules();
    } catch (error) {
      console.error('Failed to update schedule:', error);
      showError('Failed to update schedule');
    } finally {
      setLoading(false);
    }
  };

  // Modal close handler
  const handleModalClose = () => {
    setShowCreateModal(false);
    resetForm();
  };

  const toggleDay = (dayId) => {
    setSelectedDays(prev => 
      prev.includes(dayId) 
        ? prev.filter(id => id !== dayId)
        : [...prev, dayId]
    );
  };

  const selectAllWeekdays = () => {
    setSelectedDays([1, 2, 3, 4, 5]); // Monday to Friday
  };

  const selectAllDays = () => {
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]); // All days
  };

  // Filter out schedules that have passed for today and won't repeat
  const getActiveSchedules = () => {
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    return schedules.filter(schedule => {
      // Always show disabled schedules (user can enable them)
      if (!schedule.isEnabled) return true;
      
      // Always show weekly repeating schedules
      if (schedule.repeatWeekly) return true;
      
      // For one-time schedules, check if they've already passed today
      const scheduledTime = new Date(schedule.scheduledTime);
      const scheduledHour = scheduledTime.getHours();
      const scheduledMinute = scheduledTime.getMinutes();
      
      // If today is not a scheduled day, show it (it will run on the next scheduled day)
      if (!schedule.daysOfWeek.includes(currentDay)) return true;
      
      // If today is a scheduled day, check if the time has passed
      const hasTimePassed = 
        currentHour > scheduledHour || 
        (currentHour === scheduledHour && currentMinute > scheduledMinute + 1);
      
      // If the schedule was already triggered today and it's not repeating, hide it
      if (hasTimePassed && schedule.lastTriggered) {
        const lastTriggered = new Date(schedule.lastTriggered);
        const isTriggeredToday = 
          lastTriggered.getDate() === now.getDate() &&
          lastTriggered.getMonth() === now.getMonth() &&
          lastTriggered.getFullYear() === now.getFullYear();
        
        if (isTriggeredToday) return false;
      }
      
      return true;
    });
  };

  const renderScheduleItem = ({ item }) => {
    const nextExecution = SchedulerService.getNextExecutionTime(item);
    
    // Check if this schedule was completed today
    const now = new Date();
    const isCompletedToday = item.lastTriggered && 
      new Date(item.lastTriggered).toDateString() === now.toDateString();
    
    return (
      <View style={[
        styles.scheduleItem, 
        !item.isEnabled && styles.disabledSchedule,
        isCompletedToday && styles.completedSchedule
      ]}>
        <View style={styles.scheduleHeader}>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardTitle}>
              {isCompletedToday ? '✅ ' : ''}{item.cardTitle}
            </Text>
            {isCompletedToday && (
              <Text style={styles.completedText}>Played today</Text>
            )}
          </View>
          <Switch
            value={item.isEnabled}
            onValueChange={() => handleToggleSchedule(item.id, item.isEnabled)}
            trackColor={{ false: '#D1D5DB', true: '#34C759' }}
            thumbColor={item.isEnabled ? '#FFFFFF' : '#F3F4F6'}
          />
        </View>
        
        <View style={styles.scheduleDetails}>
          <View style={styles.scheduleRow}>
            <Text style={styles.scheduleLabel}>⏰ Time:</Text>
            <Text style={styles.scheduleValue}>
              {SchedulerService.formatTime(new Date(item.scheduledTime))}
            </Text>
          </View>
          
          <View style={styles.scheduleRow}>
            <Text style={styles.scheduleLabel}>📅 Days:</Text>
            <Text style={styles.scheduleValue}>
              {SchedulerService.formatDays(item.daysOfWeek)}
            </Text>
          </View>
          
          {nextExecution && (
            <View style={styles.scheduleRow}>
              <Text style={styles.scheduleLabel}>⏭️ Next:</Text>
              <Text style={styles.scheduleValue}>
                {nextExecution.toLocaleDateString()} at {SchedulerService.formatTime(nextExecution)}
              </Text>
            </View>
          )}
          
          <View style={styles.scheduleRow}>
            <Text style={styles.scheduleLabel}>🔔 Notify:</Text>
            <Text style={styles.scheduleValue}>
              {item.notifyIfOffline ? 'Yes' : 'No'}
            </Text>
          </View>
        </View>
        
        <View style={styles.scheduleActions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => handleEditSchedule(item)}
          >
            <Text style={styles.editButtonText}>✏️ Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteSchedule(item.id)}
          >
            <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderCardItem = useCallback(({ item }) => (
    <TouchableOpacity
      key={item.id}
      style={[
        styles.cardPickerItem,
        selectedCard?.id === item.id && styles.selectedCardItem
      ]}
      onPress={() => {
        console.log('📋 [CARD] Selected card:', item.title);
        setSelectedCard(item);
        handleCardPickerClose();
      }}
      activeOpacity={0.7}
    >
      <Text style={styles.cardPickerTitle}>{item.title}</Text>
      <Text style={styles.cardPickerSubtitle}>Tap to select</Text>
    </TouchableOpacity>
  ), [selectedCard?.id]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Scheduler</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Player Info */}
      <View style={styles.playerInfo}>
        <View style={styles.playerDetails}>
          <Text style={styles.playerName}>📱 {player.name}</Text>
          <Text style={styles.playerStatus}>
            {mqttClient?.isConnectionHealthy() ? '🟢 Online' : '🔴 Offline'}
          </Text>
        </View>
      </View>

      {/* Schedules List */}
      <ScrollView style={styles.scrollView}>
        {schedules.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No schedules created yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Tap the + Add button to create your first schedule
            </Text>
          </View>
        ) : (
          <>
            {getActiveSchedules().length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No active schedules</Text>
                <Text style={styles.emptyStateSubtext}>
                  All schedules for today have completed. Create new ones or wait for weekly schedules to repeat.
                </Text>
              </View>
            ) : (
              <FlatList
                data={getActiveSchedules()}
                keyExtractor={(item) => item.id}
                renderItem={renderScheduleItem}
                scrollEnabled={false}
              />
            )}
          </>
        )}
      </ScrollView>

      {/* Create Schedule Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={false}
        onRequestClose={handleModalClose}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleModalClose}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{isEditMode ? 'Edit Schedule' : 'New Schedule'}</Text>
            <TouchableOpacity onPress={handleCreateSchedule} disabled={loading}>
              <Text style={styles.modalSave}>{isEditMode ? 'Update' : 'Save'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Card Selection - Only show in create mode */}
            {!isEditMode && (
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Select Card</Text>
                <TouchableOpacity
                  style={styles.cardSelector}
                  onPress={handleCardPickerOpen}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cardSelectorText}>
                    {selectedCard ? selectedCard.title : 'Choose a card...'}
                  </Text>
                  <Text style={styles.cardSelectorIcon}>▼</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Card Display - Show in edit mode */}
            {isEditMode && selectedCard && (
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Card (cannot be changed)</Text>
                <View style={styles.cardDisplay}>
                  <Text style={styles.cardDisplayText}>{selectedCard.title}</Text>
                </View>
              </View>
            )}

            {/* Time Selection */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Time</Text>
              <TouchableOpacity
                style={styles.timeSelector}
                onPress={handleTimePickerOpen}
                activeOpacity={0.7}
              >
                <Text style={styles.timeSelectorText}>
                  {SchedulerService.formatTime(selectedTime)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Days Selection */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Days</Text>
              <View style={styles.dayQuickSelect}>
                <TouchableOpacity style={styles.quickSelectButton} onPress={selectAllDays}>
                  <Text style={styles.quickSelectText}>All Days</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickSelectButton} onPress={selectAllWeekdays}>
                  <Text style={styles.quickSelectText}>Weekdays</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.daysContainer}>
                {DAYS_OF_WEEK.map(day => (
                  <TouchableOpacity
                    key={day.id}
                    style={[
                      styles.dayButton,
                      selectedDays.includes(day.id) && styles.selectedDayButton
                    ]}
                    onPress={() => toggleDay(day.id)}
                  >
                    <Text style={[
                      styles.dayButtonText,
                      selectedDays.includes(day.id) && styles.selectedDayButtonText
                    ]}>
                      {day.short}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Options */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Options</Text>
              
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Repeat Weekly</Text>
                <Switch
                  value={repeatWeekly}
                  onValueChange={setRepeatWeekly}
                  trackColor={{ false: '#D1D5DB', true: '#007AFF' }}
                />
              </View>
              
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Notify if Device Offline</Text>
                <Switch
                  value={notifyIfOffline}
                  onValueChange={setNotifyIfOffline}
                  trackColor={{ false: '#D1D5DB', true: '#007AFF' }}
                />
              </View>
            </View>
          </ScrollView>
          
          {/* Card Picker Overlay inside the modal */}
          {showCardPicker && (
            <View style={styles.cardPickerOverlay}>
              <TouchableOpacity 
                style={styles.cardPickerBackdrop}
                activeOpacity={1}
                onPress={handleCardPickerClose}
              />
              <View style={styles.cardPickerContainer}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={handleCardPickerClose}>
                    <Text style={styles.modalCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Select Card</Text>
                  <View style={styles.modalPlaceholder} />
                </View>
                {cards && cards.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No cards available</Text>
                    <Text style={styles.emptyStateSubtext}>Please load some cards first</Text>
                  </View>
                ) : (
                  <FlatList
                    data={cards || []}
                    keyExtractor={(item) => item.id}
                    renderItem={renderCardItem}
                    style={styles.cardPickerList}
                    contentContainerStyle={styles.cardPickerContent}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={10}
                  />
                )}
              </View>
            </View>
          )}
          
          {/* Time Picker inside the modal */}
          {showTimePicker && (
            <View style={styles.timePickerContainer}>
              <Text style={styles.timePickerTitle}>Select Time</Text>
              <View style={styles.timePickerRow}>
                <View style={styles.timePickerGroup}>
                  <Text style={styles.timeLabel}>Hour</Text>
                  <ScrollView style={styles.timePicker} showsVerticalScrollIndicator={false}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                      <TouchableOpacity
                        key={hour}
                        style={[
                          styles.timeOption,
                          selectedTime.getHours() % 12 === hour % 12 && selectedTime.getHours() !== 0 
                            ? styles.selectedTimeOption : {}
                        ]}
                        onPress={() => {
                          const newTime = new Date(selectedTime);
                          const currentHour = selectedTime.getHours();
                          const isPM = currentHour >= 12;
                          newTime.setHours(isPM ? hour + 12 : hour);
                          setSelectedTime(newTime);
                        }}
                      >
                        <Text style={[
                          styles.timeOptionText,
                          selectedTime.getHours() % 12 === hour % 12 && selectedTime.getHours() !== 0
                            ? styles.selectedTimeOptionText : {}
                        ]}>
                          {hour}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                
                <View style={styles.timePickerGroup}>
                  <Text style={styles.timeLabel}>Minute</Text>
                  <ScrollView style={styles.timePicker} showsVerticalScrollIndicator={false}>
                    {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
                      <TouchableOpacity
                        key={minute}
                        style={[
                          styles.timeOption,
                          selectedTime.getMinutes() === minute ? styles.selectedTimeOption : {}
                        ]}
                        onPress={() => {
                          const newTime = new Date(selectedTime);
                          newTime.setMinutes(minute);
                          setSelectedTime(newTime);
                        }}
                      >
                        <Text style={[
                          styles.timeOptionText,
                          selectedTime.getMinutes() === minute ? styles.selectedTimeOptionText : {}
                        ]}>
                          {minute.toString().padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                
                <View style={styles.timePickerGroup}>
                  <Text style={styles.timeLabel}>AM/PM</Text>
                  <ScrollView style={styles.timePicker} showsVerticalScrollIndicator={false}>
                    {['AM', 'PM'].map((period) => (
                      <TouchableOpacity
                        key={period}
                        style={[
                          styles.timeOption,
                          (selectedTime.getHours() >= 12 ? 'PM' : 'AM') === period 
                            ? styles.selectedTimeOption : {}
                        ]}
                        onPress={() => {
                          const newTime = new Date(selectedTime);
                          const currentHour = selectedTime.getHours();
                          if (period === 'AM' && currentHour >= 12) {
                            newTime.setHours(currentHour - 12);
                          } else if (period === 'PM' && currentHour < 12) {
                            newTime.setHours(currentHour + 12);
                          }
                          setSelectedTime(newTime);
                        }}
                      >
                        <Text style={[
                          styles.timeOptionText,
                          (selectedTime.getHours() >= 12 ? 'PM' : 'AM') === period
                            ? styles.selectedTimeOptionText : {}
                        ]}>
                          {period}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
              
              <View style={styles.timePickerButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    console.log('⏰ [TIME] Time picker cancelled');
                    setShowTimePicker(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={() => {
                    console.log('⏰ [TIME] Time selected:', selectedTime.toLocaleTimeString());
                    setShowTimePicker(false);
                  }}
                >
                  <Text style={styles.confirmButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 15,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#34C759',
    borderRadius: 15,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  playerInfo: {
    backgroundColor: '#FFFFFF',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerDetails: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  playerStatus: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 15,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  scheduleItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  completedSchedule: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#34C759',
  },
  disabledSchedule: {
    opacity: 0.6,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  completedText: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '500',
    marginTop: 4,
  },
  scheduleDetails: {
    marginBottom: 10,
  },
  scheduleRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  scheduleLabel: {
    fontSize: 14,
    color: '#666',
    width: 80,
  },
  scheduleValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  scheduleActions: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 10,
  },
  editButton: {
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalCancel: {
    color: '#007AFF',
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalSave: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalPlaceholder: {
    width: 50, // Same width as cancel/save buttons for balance
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  formSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  cardSelector: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cardSelectorText: {
    fontSize: 16,
    color: '#333',
  },
  cardSelectorIcon: {
    fontSize: 16,
    color: '#666',
  },
  cardDisplay: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cardDisplayText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  timeSelector: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  timeSelectorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
  },
  dayQuickSelect: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 10,
  },
  quickSelectButton: {
    backgroundColor: '#E3F2FD',
    padding: 8,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  quickSelectText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dayButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedDayButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  selectedDayButtonText: {
    color: '#FFFFFF',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  optionLabel: {
    fontSize: 16,
    color: '#333',
  },
  cardPickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  cardPickerBackdrop: {
    flex: 1,
  },
  cardPickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%', // Limit height to 70% of screen
    paddingBottom: 40, // Add padding for safe area
  },
  cardPickerList: {
    maxHeight: 400, // Limit the list height
  },
  cardPickerContent: {
    paddingBottom: 20,
  },
  cardPickerItem: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    minHeight: 70,
    justifyContent: 'center',
  },
  selectedCardItem: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  cardPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  cardPickerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  timePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    marginHorizontal: 20,
    marginVertical: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
  },
  timePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 150,
    marginBottom: 20,
  },
  timePickerGroup: {
    flex: 1,
    marginHorizontal: 5,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  timePicker: {
    height: 120,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
  },
  timeOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  selectedTimeOption: {
    backgroundColor: '#007AFF',
  },
  timeOptionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedTimeOptionText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dateTimePicker: {
    height: 200,
    backgroundColor: '#FFFFFF',
  },
  timePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  confirmButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
