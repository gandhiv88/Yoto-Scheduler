import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import type { YotoPlayer } from '../types/index';

interface MqttClient {
  playCard: (playerId: string, cardId: string) => Promise<void>;
  pausePlayback: (playerId: string) => Promise<void>;
  stopPlayback: (playerId: string) => Promise<void>;
  setAmbientLight: (playerId: string, brightness: number, color?: string) => Promise<void>;
}

interface ScheduledTask {
  id: string;
  name: string;
  playerId: string;
  playerName: string;
  action: 'play' | 'pause' | 'stop' | 'ambient_light';
  cardId?: string;
  cardTitle?: string;
  scheduledTime: Date;
  enabled: boolean;
  repeat: 'none' | 'daily' | 'weekly' | 'weekdays' | 'weekends';
  ambientLightConfig?: {
    brightness: number;
    color: string;
  };
  lastExecuted?: Date;
  nextExecution?: Date;
}

interface Content {
  id: string;
  title: string;
  description?: string;
}

interface SchedulerManagerProps {
  players: YotoPlayer[];
  content: Content[];
  mqttClient: MqttClient | null;
  onBack: () => void;
}

export const SchedulerManager: React.FC<SchedulerManagerProps> = ({
  players,
  content,
  mqttClient,
  onBack,
}) => {
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // New task form state
  const [newTask, setNewTask] = useState<Partial<ScheduledTask>>({
    name: '',
    playerId: players[0]?.id || '',
    action: 'play',
    scheduledTime: new Date(),
    enabled: true,
    repeat: 'none',
    ambientLightConfig: {
      brightness: 50,
      color: '#FFFFFF',
    },
  });

  const STORAGE_KEY = 'yoto_scheduled_tasks';

  useEffect(() => {
    loadScheduledTasks();
    startSchedulerEngine();

    return () => {
      // Cleanup any timers when component unmounts
    };
  }, []);

  const loadScheduledTasks = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const tasks = JSON.parse(stored).map((task: any) => ({
          ...task,
          scheduledTime: new Date(task.scheduledTime),
          lastExecuted: task.lastExecuted ? new Date(task.lastExecuted) : undefined,
          nextExecution: task.nextExecution ? new Date(task.nextExecution) : undefined,
        }));
        setScheduledTasks(tasks);
        console.log('📅 [SCHEDULER] Loaded', tasks.length, 'scheduled tasks');
      }
    } catch (error) {
      console.error('❌ [SCHEDULER] Failed to load scheduled tasks:', error);
    }
  };

  const saveScheduledTasks = async (tasks: ScheduledTask[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      console.log('💾 [SCHEDULER] Saved', tasks.length, 'scheduled tasks');
    } catch (error) {
      console.error('❌ [SCHEDULER] Failed to save scheduled tasks:', error);
    }
  };

  const calculateNextExecution = (task: ScheduledTask): Date => {
    const now = new Date();
    const scheduledTime = new Date(task.scheduledTime);
    let nextExecution = new Date();

    nextExecution.setHours(scheduledTime.getHours());
    nextExecution.setMinutes(scheduledTime.getMinutes());
    nextExecution.setSeconds(0);
    nextExecution.setMilliseconds(0);

    // If the time has already passed today, move to appropriate next occurrence
    if (nextExecution <= now) {
      switch (task.repeat) {
        case 'daily':
          nextExecution.setDate(nextExecution.getDate() + 1);
          break;
        case 'weekly':
          nextExecution.setDate(nextExecution.getDate() + 7);
          break;
        case 'weekdays':
          do {
            nextExecution.setDate(nextExecution.getDate() + 1);
          } while (nextExecution.getDay() === 0 || nextExecution.getDay() === 6); // Skip weekends
          break;
        case 'weekends':
          do {
            nextExecution.setDate(nextExecution.getDate() + 1);
          } while (nextExecution.getDay() !== 0 && nextExecution.getDay() !== 6); // Only weekends
          break;
        case 'none':
        default:
          // For non-repeating tasks, if time has passed, disable the task
          return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Far future
      }
    }

    return nextExecution;
  };

  const startSchedulerEngine = () => {
    // Check for tasks to execute every minute
    const checkInterval = setInterval(() => {
      checkAndExecuteTasks();
    }, 60000); // Check every minute

    // Initial check
    checkAndExecuteTasks();

    return () => clearInterval(checkInterval);
  };

  const checkAndExecuteTasks = async () => {
    const now = new Date();
    const tasksToUpdate: ScheduledTask[] = [];

    for (const task of scheduledTasks) {
      if (!task.enabled) continue;

      const nextExecution = task.nextExecution || calculateNextExecution(task);
      
      if (nextExecution <= now && (!task.lastExecuted || 
          nextExecution.getTime() !== task.lastExecuted.getTime())) {
        
        console.log('⏰ [SCHEDULER] Executing task:', task.name);
        
        try {
          await executeTask(task);
          
          const updatedTask = {
            ...task,
            lastExecuted: now,
            nextExecution: task.repeat !== 'none' ? calculateNextExecution({
              ...task,
              scheduledTime: nextExecution
            }) : undefined,
          };

          // If it's a non-repeating task, disable it after execution
          if (task.repeat === 'none') {
            updatedTask.enabled = false;
          }

          tasksToUpdate.push(updatedTask);
        } catch (error) {
          console.error('❌ [SCHEDULER] Failed to execute task:', task.name, error);
        }
      }
    }

    if (tasksToUpdate.length > 0) {
      const updatedTasks = scheduledTasks.map(task => {
        const updated = tasksToUpdate.find(t => t.id === task.id);
        return updated || task;
      });
      
      setScheduledTasks(updatedTasks);
      await saveScheduledTasks(updatedTasks);
    }
  };

  const executeTask = async (task: ScheduledTask) => {
    if (!mqttClient) {
      throw new Error('MQTT client not available');
    }

    switch (task.action) {
      case 'play':
        if (task.cardId) {
          await mqttClient.playCard(task.playerId, task.cardId);
        }
        break;
      case 'pause':
        await mqttClient.pausePlayback(task.playerId);
        break;
      case 'stop':
        await mqttClient.stopPlayback(task.playerId);
        break;
      case 'ambient_light':
        if (task.ambientLightConfig) {
          await mqttClient.setAmbientLight(
            task.playerId,
            task.ambientLightConfig.brightness,
            task.ambientLightConfig.color
          );
        }
        break;
    }
  };

  const addNewTask = async () => {
    if (!newTask.name || !newTask.playerId) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (newTask.action === 'play' && !newTask.cardId) {
      Alert.alert('Error', 'Please select a card to play');
      return;
    }

    setIsLoading(true);

    try {
      const task: ScheduledTask = {
        id: Date.now().toString(),
        name: newTask.name!,
        playerId: newTask.playerId!,
        playerName: players.find(p => p.id === newTask.playerId)?.name || 'Unknown',
        action: newTask.action!,
        cardId: newTask.cardId,
        cardTitle: content.find(c => c.id === newTask.cardId)?.title,
        scheduledTime: newTask.scheduledTime!,
        enabled: newTask.enabled!,
        repeat: newTask.repeat!,
        ambientLightConfig: newTask.ambientLightConfig,
        nextExecution: calculateNextExecution({
          ...newTask,
          scheduledTime: newTask.scheduledTime!,
          repeat: newTask.repeat!,
        } as ScheduledTask),
      };

      const updatedTasks = [...scheduledTasks, task];
      setScheduledTasks(updatedTasks);
      await saveScheduledTasks(updatedTasks);

      // Reset form
      setNewTask({
        name: '',
        playerId: players[0]?.id || '',
        action: 'play',
        scheduledTime: new Date(),
        enabled: true,
        repeat: 'none',
        ambientLightConfig: {
          brightness: 50,
          color: '#FFFFFF',
        },
      });
      setShowNewTaskForm(false);

      Alert.alert('Success', 'Scheduled task created successfully!');
    } catch (error) {
      console.error('❌ [SCHEDULER] Failed to create task:', error);
      Alert.alert('Error', 'Failed to create scheduled task');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTaskEnabled = async (taskId: string) => {
    const updatedTasks = scheduledTasks.map(task => 
      task.id === taskId 
        ? { 
            ...task, 
            enabled: !task.enabled,
            nextExecution: !task.enabled ? calculateNextExecution(task) : undefined
          }
        : task
    );
    
    setScheduledTasks(updatedTasks);
    await saveScheduledTasks(updatedTasks);
  };

  const deleteTask = async (taskId: string) => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this scheduled task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedTasks = scheduledTasks.filter(task => task.id !== taskId);
            setScheduledTasks(updatedTasks);
            await saveScheduledTasks(updatedTasks);
          },
        },
      ]
    );
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatNextExecution = (date?: Date): string => {
    if (!date) return 'Not scheduled';
    
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `Today at ${formatTime(date)}`;
    } else if (diffDays === 1) {
      return `Tomorrow at ${formatTime(date)}`;
    } else {
      return `${date.toLocaleDateString()} at ${formatTime(date)}`;
    }
  };

  const selectedPlayer = players.find(p => p.id === newTask.playerId);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Schedule Manager</Text>
        <Text style={styles.subtitle}>Automate your Yoto players</Text>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{scheduledTasks.length}</Text>
          <Text style={styles.statLabel}>Total Tasks</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {scheduledTasks.filter(t => t.enabled).length}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {scheduledTasks.filter(t => t.nextExecution && t.nextExecution > new Date()).length}
          </Text>
          <Text style={styles.statLabel}>Upcoming</Text>
        </View>
      </View>

      {/* Add New Task Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowNewTaskForm(!showNewTaskForm)}
      >
        <Text style={styles.addButtonText}>
          {showNewTaskForm ? '✕ Cancel' : '+ Add New Schedule'}
        </Text>
      </TouchableOpacity>

      {/* New Task Form */}
      {showNewTaskForm && (
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Create New Schedule</Text>
          
          {/* Task Name */}
          <Text style={styles.label}>Task Name</Text>
          <TouchableOpacity style={styles.input}>
            <Text style={[styles.inputText, !newTask.name && styles.placeholder]}>
              {newTask.name || 'Enter task name...'}
            </Text>
          </TouchableOpacity>

          {/* Player Selection */}
          <Text style={styles.label}>Player</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={newTask.playerId}
              onValueChange={(value: string) => setNewTask({...newTask, playerId: value})}
              style={styles.picker}
            >
              {players.map(player => (
                <Picker.Item
                  key={player.id}
                  label={`${player.name} ${player.isOnline ? '🟢' : '🔴'}`}
                  value={player.id}
                />
              ))}
            </Picker>
          </View>

          {/* Action Selection */}
          <Text style={styles.label}>Action</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={newTask.action}
              onValueChange={(value: string) => setNewTask({...newTask, action: value as any})}
              style={styles.picker}
            >
              <Picker.Item label="▶️ Play Card" value="play" />
              <Picker.Item label="⏸️ Pause Playback" value="pause" />
              <Picker.Item label="⏹️ Stop Playback" value="stop" />
              <Picker.Item label="💡 Set Ambient Light" value="ambient_light" />
            </Picker>
          </View>

          {/* Card Selection (for play action) */}
          {newTask.action === 'play' && (
            <>
              <Text style={styles.label}>Card to Play</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={newTask.cardId}
                  onValueChange={(value: string) => setNewTask({...newTask, cardId: value})}
                  style={styles.picker}
                >
                  <Picker.Item label="Select a card..." value="" />
                  {content.map(card => (
                    <Picker.Item
                      key={card.id}
                      label={card.title}
                      value={card.id}
                    />
                  ))}
                </Picker>
              </View>
            </>
          )}

          {/* Time Selection */}
          <Text style={styles.label}>Scheduled Time</Text>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={styles.timeButtonText}>
              {formatTime(newTask.scheduledTime!)}
            </Text>
          </TouchableOpacity>

          {showTimePicker && (
            <DateTimePicker
              value={newTask.scheduledTime!}
              mode="time"
              is24Hour={false}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event: any, selectedTime: Date | undefined) => {
                setShowTimePicker(Platform.OS === 'ios');
                if (selectedTime) {
                  setNewTask({...newTask, scheduledTime: selectedTime});
                }
              }}
            />
          )}

          {/* Repeat Options */}
          <Text style={styles.label}>Repeat</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={newTask.repeat}
              onValueChange={(value: string) => setNewTask({...newTask, repeat: value as any})}
              style={styles.picker}
            >
              <Picker.Item label="🚫 No Repeat" value="none" />
              <Picker.Item label="📅 Daily" value="daily" />
              <Picker.Item label="📆 Weekly" value="weekly" />
              <Picker.Item label="💼 Weekdays Only" value="weekdays" />
              <Picker.Item label="🎉 Weekends Only" value="weekends" />
            </Picker>
          </View>

          {/* Create Button */}
          <TouchableOpacity
            style={[styles.createButton, isLoading && styles.buttonDisabled]}
            onPress={addNewTask}
            disabled={isLoading}
          >
            <Text style={styles.createButtonText}>
              {isLoading ? 'Creating...' : 'Create Schedule'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Scheduled Tasks List */}
      <View style={styles.tasksContainer}>
        <Text style={styles.sectionTitle}>Scheduled Tasks</Text>
        
        {scheduledTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No scheduled tasks yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Create your first schedule to automate your Yoto players
            </Text>
          </View>
        ) : (
          scheduledTasks
            .sort((a, b) => {
              // Sort by enabled status first, then by next execution time
              if (a.enabled !== b.enabled) {
                return a.enabled ? -1 : 1;
              }
              if (a.nextExecution && b.nextExecution) {
                return a.nextExecution.getTime() - b.nextExecution.getTime();
              }
              return 0;
            })
            .map(task => (
              <View key={task.id} style={[
                styles.taskCard,
                !task.enabled && styles.taskCardDisabled
              ]}>
                <View style={styles.taskHeader}>
                  <Text style={[styles.taskName, !task.enabled && styles.disabledText]}>
                    {task.name}
                  </Text>
                  <Switch
                    value={task.enabled}
                    onValueChange={() => toggleTaskEnabled(task.id)}
                    trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
                    thumbColor={task.enabled ? '#FFFFFF' : '#FFFFFF'}
                  />
                </View>
                
                <Text style={[styles.taskDetail, !task.enabled && styles.disabledText]}>
                  📱 {task.playerName}
                </Text>
                
                <Text style={[styles.taskDetail, !task.enabled && styles.disabledText]}>
                  ⏰ {formatTime(task.scheduledTime)} • {task.repeat === 'none' ? 'Once' : task.repeat}
                </Text>
                
                <Text style={[styles.taskAction, !task.enabled && styles.disabledText]}>
                  {task.action === 'play' && `▶️ Play: ${task.cardTitle}`}
                  {task.action === 'pause' && '⏸️ Pause Playback'}
                  {task.action === 'stop' && '⏹️ Stop Playback'}
                  {task.action === 'ambient_light' && '💡 Set Ambient Light'}
                </Text>
                
                {task.enabled && (
                  <Text style={styles.nextExecution}>
                    Next: {formatNextExecution(task.nextExecution)}
                  </Text>
                )}
                
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteTask(task.id)}
                >
                  <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
                </TouchableOpacity>
              </View>
            ))
        )}
      </View>
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
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    marginBottom: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 15,
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  addButton: {
    backgroundColor: '#007AFF',
    margin: 15,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  formContainer: {
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
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 15,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F8F9FA',
  },
  inputText: {
    fontSize: 16,
    color: '#333',
  },
  placeholder: {
    color: '#999',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
  picker: {
    height: 50,
  },
  timeButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  createButton: {
    backgroundColor: '#28A745',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  tasksContainer: {
    margin: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '500',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  taskCardDisabled: {
    opacity: 0.6,
    backgroundColor: '#F8F9FA',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  taskDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  taskAction: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginBottom: 8,
  },
  nextExecution: {
    fontSize: 12,
    color: '#28A745',
    fontWeight: '500',
    backgroundColor: '#E8F5E8',
    padding: 6,
    borderRadius: 6,
    textAlign: 'center',
    marginBottom: 8,
  },
  disabledText: {
    color: '#999',
  },
  deleteButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#DC3545',
  },
});
