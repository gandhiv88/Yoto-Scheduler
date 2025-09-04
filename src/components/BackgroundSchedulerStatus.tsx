import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import { BackgroundSchedulerService } from '../services/backgroundSchedulerService';
import { SchedulerService } from '../services/simpleSchedulerService';

interface BackgroundSchedulerStatusProps {
  onBack: () => void;
}

export const BackgroundSchedulerStatus: React.FC<BackgroundSchedulerStatusProps> = ({ onBack }) => {
  const [backgroundStatus, setBackgroundStatus] = useState<any>(null);
  const [scheduleCount, setScheduleCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBackgroundStatus();
  }, []);

  const loadBackgroundStatus = async () => {
    try {
      setLoading(true);
      
      // Get background fetch status
      const status = await BackgroundSchedulerService.getBackgroundFetchStatus();
      setBackgroundStatus(status);
      
      // Get schedule count
      const schedules = await SchedulerService.getAllSchedules();
      const enabledSchedules = schedules.filter((s: any) => s.isEnabled);
      setScheduleCount(enabledSchedules.length);
      
    } catch (error) {
      console.error('Failed to load background status:', error);
    } finally {
      setLoading(false);
    }
  };

  const testBackgroundFunction = async () => {
    try {
      Alert.alert(
        'Testing Background Scheduler',
        'This will test the background scheduling function. Check the console for results.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Test', 
            onPress: async () => {
              const result = await BackgroundSchedulerService.triggerBackgroundCheck();
              Alert.alert(
                'Test Complete',
                result ? 'Background check completed successfully' : 'Background check failed'
              );
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Test Failed', 'Could not test background function');
    }
  };

  const updateNotifications = async () => {
    try {
      await BackgroundSchedulerService.updateScheduledNotifications();
      Alert.alert('Success', 'Notification schedules updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update notifications');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available':
        return '#34C759'; // Green
      case 'Denied':
        return '#FF3B30'; // Red
      case 'Restricted':
        return '#FF9500'; // Orange
      default:
        return '#8E8E93'; // Gray
    }
  };

  const getRecommendations = () => {
    if (!backgroundStatus) return [];
    
    const recommendations = [];
    
    if (backgroundStatus.status === 'Denied') {
      recommendations.push({
        title: 'Enable Background Refresh',
        description: 'Go to Settings > General > Background App Refresh and enable it for Yoto Scheduler',
        priority: 'high'
      });
    }
    
    if (backgroundStatus.status === 'Restricted') {
      recommendations.push({
        title: 'Check Low Power Mode',
        description: 'Low Power Mode restricts background activity. Disable it for better scheduling reliability.',
        priority: 'medium'
      });
    }
    
    if (scheduleCount > 0) {
      recommendations.push({
        title: 'Keep App Nearby',
        description: 'For best reliability, keep the app open or recently used when schedules are due to execute.',
        priority: 'medium'
      });
      
      recommendations.push({
        title: 'Enable Notifications',
        description: 'Notifications will alert you when schedules activate and if the app needs to be opened.',
        priority: 'low'
      });
    }
    
    return recommendations;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Background Status</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading background status...</Text>
        </View>
      </View>
    );
  }

  const recommendations = getRecommendations();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Background Scheduling</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Status Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📱 Background Status</Text>
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Background Fetch:</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(backgroundStatus?.statusText || 'Unknown') }]}>
              <Text style={styles.statusBadgeText}>{backgroundStatus?.statusText || 'Unknown'}</Text>
            </View>
          </View>
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Task Registered:</Text>
            <View style={[styles.statusBadge, { backgroundColor: backgroundStatus?.isRegistered ? '#34C759' : '#FF3B30' }]}>
              <Text style={styles.statusBadgeText}>{backgroundStatus?.isRegistered ? 'Yes' : 'No'}</Text>
            </View>
          </View>
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Active Schedules:</Text>
            <View style={[styles.statusBadge, { backgroundColor: scheduleCount > 0 ? '#007AFF' : '#8E8E93' }]}>
              <Text style={styles.statusBadgeText}>{scheduleCount}</Text>
            </View>
          </View>
        </View>

        {/* How It Works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛠 How Background Scheduling Works</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>🌙 Background Tasks</Text>
            <Text style={styles.infoText}>
              The app registers background tasks that wake up periodically to check for due schedules.
            </Text>
          </View>
          
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>🔔 Smart Notifications</Text>
            <Text style={styles.infoText}>
              When schedules are due, you'll receive notifications even if the app is closed.
            </Text>
          </View>
          
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>📱 App Assistance</Text>
            <Text style={styles.infoText}>
              Some schedules may require opening the app for best reliability, especially MQTT connections.
            </Text>
          </View>
        </View>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💡 Recommendations</Text>
            {recommendations.map((rec, index) => (
              <View key={index} style={[styles.recommendationBox, { borderLeftColor: rec.priority === 'high' ? '#FF3B30' : rec.priority === 'medium' ? '#FF9500' : '#007AFF' }]}>
                <Text style={styles.recommendationTitle}>{rec.title}</Text>
                <Text style={styles.recommendationText}>{rec.description}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Limitations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Background Limitations</Text>
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>iOS Background Restrictions</Text>
            <Text style={styles.warningText}>
              • Background tasks run for limited time{'\n'}
              • System may restrict background execution{'\n'}
              • Low Power Mode disables background refresh{'\n'}
              • MQTT connections may need app to be active
            </Text>
          </View>
          
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>Best Practices</Text>
            <Text style={styles.warningText}>
              • Keep app recently used for critical schedules{'\n'}
              • Enable notifications for schedule alerts{'\n'}
              • Test schedules during different times{'\n'}
              • Consider opening app near scheduled times
            </Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔧 Controls</Text>
          
          <TouchableOpacity style={styles.actionButton} onPress={testBackgroundFunction}>
            <Text style={styles.actionButtonText}>🧪 Test Background Function</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={updateNotifications}>
            <Text style={styles.actionButtonText}>🔔 Update Notifications</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={loadBackgroundStatus}>
            <Text style={styles.actionButtonText}>🔄 Refresh Status</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    marginRight: 15,
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
  },
  content: {
    flex: 1,
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
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  recommendationBox: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  recommendationText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  warningBox: {
    backgroundColor: '#FFF3CD',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 5,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
});
