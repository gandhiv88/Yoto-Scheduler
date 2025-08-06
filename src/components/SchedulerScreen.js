import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  FlatList,
  Switch
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SchedulerService } from '../services/simpleSchedulerService';

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
  
  // Create schedule form state
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [selectedDays, setSelectedDays] = useState([]);
  const [notifyIfOffline, setNotifyIfOffline] = useState(true);
  const [repeatWeekly, setRepeatWeekly] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCardPicker, setShowCardPicker] = useState(false);

  useEffect(() => {
    loadSchedules();
    SchedulerService.initialize().catch(console.error);
    
    // Start checking schedules every minute
    const interval = setInterval(() => {
      SchedulerService.checkAndExecuteSchedules(mqttClient);
    }, 60000);
    
    return () => clearInterval(interval);
  }, [mqttClient]);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const playerSchedules = await SchedulerService.getSchedulesForPlayer(player.id);
      setSchedules(playerSchedules);
    } catch (error) {
      console.error('Failed to load schedules:', error);
      Alert.alert('Error', 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!selectedCard || selectedDays.length === 0) {
      Alert.alert('Validation Error', 'Please select a card and at least one day');
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
      
      Alert.alert('Success', 'Schedule created successfully!');
      setShowCreateModal(false);
      resetForm();
      await loadSchedules();
    } catch (error) {
      console.error('Failed to create schedule:', error);
      Alert.alert('Error', 'Failed to create schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    Alert.alert(
      'Delete Schedule',
      'Are you sure you want to delete this schedule?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await SchedulerService.deleteSchedule(scheduleId);
              await loadSchedules();
            } catch (error) {
              console.error('Failed to delete schedule:', error);
              Alert.alert('Error', 'Failed to delete schedule');
            }
          }
        }
      ]
    );
  };

  const handleToggleSchedule = async (scheduleId, currentState) => {
    try {
      await SchedulerService.toggleSchedule(scheduleId, !currentState);
      await loadSchedules();
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
      Alert.alert('Error', 'Failed to toggle schedule');
    }
  };

  const resetForm = () => {
    setSelectedCard(null);
    setSelectedTime(new Date());
    setSelectedDays([]);
    setNotifyIfOffline(true);
    setRepeatWeekly(true);
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

  const renderScheduleItem = ({ item }) => {
    const nextExecution = SchedulerService.getNextExecutionTime(item);
    
    return (
      <View style={[styles.scheduleItem, !item.isEnabled && styles.disabledSchedule]}>
        <View style={styles.scheduleHeader}>
          <Text style={styles.cardTitle}>{item.cardTitle}</Text>
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
        
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteSchedule(item.id)}
        >
          <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCardItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.cardPickerItem,
        selectedCard?.id === item.id && styles.selectedCardItem
      ]}
      onPress={() => {
        setSelectedCard(item);
        setShowCardPicker(false);
      }}
    >
      <Text style={styles.cardPickerTitle}>{item.title}</Text>
    </TouchableOpacity>
  );

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
        <Text style={styles.playerName}>📱 {player.name}</Text>
        <Text style={styles.playerStatus}>
          {mqttClient?.isConnectionHealthy() ? '🟢 Online' : '🔴 Offline'}
        </Text>
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
          <FlatList
            data={schedules}
            keyExtractor={(item) => item.id}
            renderItem={renderScheduleItem}
            scrollEnabled={false}
          />
        )}
      </ScrollView>

      {/* Create Schedule Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Schedule</Text>
            <TouchableOpacity onPress={handleCreateSchedule} disabled={loading}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Card Selection */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Select Card</Text>
              <TouchableOpacity
                style={styles.cardSelector}
                onPress={() => setShowCardPicker(true)}
              >
                <Text style={styles.cardSelectorText}>
                  {selectedCard ? selectedCard.title : 'Choose a card...'}
                </Text>
                <Text style={styles.cardSelectorIcon}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* Time Selection */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Time</Text>
              <TouchableOpacity
                style={styles.timeSelector}
                onPress={() => setShowTimePicker(true)}
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
        </View>
      </Modal>

      {/* Time Picker */}
      {showTimePicker && (
        <DateTimePicker
          value={selectedTime}
          mode="time"
          is24Hour={false}
          onChange={(event, time) => {
            setShowTimePicker(false);
            if (time) setSelectedTime(time);
          }}
        />
      )}

      {/* Card Picker Modal */}
      <Modal
        visible={showCardPicker}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.cardPickerContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCardPicker(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Card</Text>
            <View />
          </View>
          <FlatList
            data={cards}
            keyExtractor={(item) => item.id}
            renderItem={renderCardItem}
          />
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
  disabledSchedule: {
    opacity: 0.6,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
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
  deleteButton: {
    backgroundColor: '#FF3B30',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 5,
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
  cardPickerContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  cardPickerItem: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  selectedCardItem: {
    backgroundColor: '#E3F2FD',
  },
  cardPickerTitle: {
    fontSize: 16,
    color: '#333',
  },
});
