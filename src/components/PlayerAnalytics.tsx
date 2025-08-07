import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSnackBarContext } from '../contexts/SnackBarContext';
import type { YotoPlayer } from '../types/index';

interface PlaybackSession {
  id: string;
  playerId: string;
  cardId: string;
  cardTitle: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in minutes
  completed: boolean;
}

interface PlayerUsage {
  playerId: string;
  playerName: string;
  totalSessions: number;
  totalPlaytime: number; // in minutes
  averageSessionLength: number;
  mostPlayedCard?: {
    cardId: string;
    cardTitle: string;
    playCount: number;
  };
  lastActivity?: Date;
  dailyUsage: { [date: string]: number }; // minutes per day
}

interface MqttClient {
  onPlaybackStarted?: (callback: (playerId: string, cardId: string, cardTitle: string) => void) => void;
  onPlaybackStopped?: (callback: (playerId: string) => void) => void;
}

interface PlayerAnalyticsProps {
  players: YotoPlayer[];
  mqttClient: MqttClient | null;
  onBack: () => void;
}

export const PlayerAnalytics: React.FC<PlayerAnalyticsProps> = ({
  players,
  mqttClient,
  onBack,
}) => {
  const { showSuccess, showError, showWarning, showInfo } = useSnackBarContext();
  const [playbackSessions, setPlaybackSessions] = useState<PlaybackSession[]>([]);
  const [playerUsage, setPlayerUsage] = useState<PlayerUsage[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'week' | 'month' | 'all'>('week');
  const [currentSessions, setCurrentSessions] = useState<Map<string, PlaybackSession>>(new Map());

  const SESSIONS_STORAGE_KEY = 'yoto_playback_sessions';
  const SCREEN_WIDTH = Dimensions.get('window').width;

  useEffect(() => {
    loadPlaybackData();
    setupMqttListeners();
  }, [mqttClient]);

  useEffect(() => {
    calculatePlayerUsage();
  }, [playbackSessions, selectedTimeRange]);

  const loadPlaybackData = async () => {
    try {
      const stored = await AsyncStorage.getItem(SESSIONS_STORAGE_KEY);
      if (stored) {
        const sessions = JSON.parse(stored).map((session: any) => ({
          ...session,
          startTime: new Date(session.startTime),
          endTime: session.endTime ? new Date(session.endTime) : undefined,
        }));
        setPlaybackSessions(sessions);
        console.log('📊 [ANALYTICS] Loaded', sessions.length, 'playback sessions');
      }
    } catch (error) {
      console.error('❌ [ANALYTICS] Failed to load playback data:', error);
    }
  };

  const savePlaybackData = async (sessions: PlaybackSession[]) => {
    try {
      await AsyncStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
      console.log('💾 [ANALYTICS] Saved', sessions.length, 'playback sessions');
    } catch (error) {
      console.error('❌ [ANALYTICS] Failed to save playback data:', error);
    }
  };

  const setupMqttListeners = () => {
    if (!mqttClient) return;

    // Listen for playback start events
    if (mqttClient.onPlaybackStarted) {
      mqttClient.onPlaybackStarted((playerId: string, cardId: string, cardTitle: string) => {
        const session: PlaybackSession = {
          id: Date.now().toString(),
          playerId,
          cardId,
          cardTitle,
          startTime: new Date(),
          completed: false,
        };

        // End any existing session for this player
        const existingSession = currentSessions.get(playerId);
        if (existingSession) {
          endPlaybackSession(existingSession);
        }

        // Start new session
        setCurrentSessions(prev => new Map(prev.set(playerId, session)));
        console.log('▶️ [ANALYTICS] Started session:', session.cardTitle, 'on', 
          players.find(p => p.id === playerId)?.name);
      });
    }

    // Listen for playback stop events
    if (mqttClient.onPlaybackStopped) {
      mqttClient.onPlaybackStopped((playerId: string) => {
        const session = currentSessions.get(playerId);
        if (session) {
          endPlaybackSession(session);
          setCurrentSessions(prev => {
            const newMap = new Map(prev);
            newMap.delete(playerId);
            return newMap;
          });
        }
      });
    }
  };

  const endPlaybackSession = (session: PlaybackSession) => {
    const endTime = new Date();
    const duration = Math.round((endTime.getTime() - session.startTime.getTime()) / (1000 * 60));
    
    // Only record sessions longer than 30 seconds
    if (duration >= 0.5) {
      const completedSession: PlaybackSession = {
        ...session,
        endTime,
        duration,
        completed: duration >= 5, // Consider completed if played for 5+ minutes
      };

      setPlaybackSessions(prev => {
        const updated = [...prev, completedSession];
        savePlaybackData(updated);
        return updated;
      });

      console.log('⏹️ [ANALYTICS] Ended session:', session.cardTitle, 
        `Duration: ${duration} minutes`);
    }
  };

  const calculatePlayerUsage = () => {
    const now = new Date();
    let startDate = new Date();

    switch (selectedTimeRange) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'all':
        startDate = new Date(0); // Beginning of time
        break;
    }

    const filteredSessions = playbackSessions.filter(session => 
      session.startTime >= startDate && session.duration !== undefined
    );

    const usage: PlayerUsage[] = players.map(player => {
      const playerSessions = filteredSessions.filter(session => session.playerId === player.id);
      const totalPlaytime = playerSessions.reduce((sum, session) => sum + (session.duration || 0), 0);
      
      // Calculate most played card
      const cardCounts: { [cardId: string]: { title: string; count: number } } = {};
      playerSessions.forEach(session => {
        if (!cardCounts[session.cardId]) {
          cardCounts[session.cardId] = { title: session.cardTitle, count: 0 };
        }
        cardCounts[session.cardId].count++;
      });

      const mostPlayedCard = Object.entries(cardCounts)
        .sort(([,a], [,b]) => b.count - a.count)[0];

      // Calculate daily usage for the last 7 days
      const dailyUsage: { [date: string]: number } = {};
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        
        const dayPlaytime = playerSessions
          .filter(session => session.startTime.toISOString().split('T')[0] === dateKey)
          .reduce((sum, session) => sum + (session.duration || 0), 0);
        
        dailyUsage[dateKey] = dayPlaytime;
      }

      return {
        playerId: player.id,
        playerName: player.name,
        totalSessions: playerSessions.length,
        totalPlaytime,
        averageSessionLength: playerSessions.length > 0 ? totalPlaytime / playerSessions.length : 0,
        mostPlayedCard: mostPlayedCard ? {
          cardId: mostPlayedCard[0],
          cardTitle: mostPlayedCard[1].title,
          playCount: mostPlayedCard[1].count,
        } : undefined,
        lastActivity: playerSessions.length > 0 ? 
          playerSessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0].startTime : 
          undefined,
        dailyUsage,
      };
    });

    setPlayerUsage(usage);
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${remainingMinutes}m`;
  };

  const formatLastActivity = (date?: Date): string => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getTotalStats = () => {
    const totalSessions = playerUsage.reduce((sum, player) => sum + player.totalSessions, 0);
    const totalPlaytime = playerUsage.reduce((sum, player) => sum + player.totalPlaytime, 0);
    const averageSessionLength = totalSessions > 0 ? totalPlaytime / totalSessions : 0;
    
    return { totalSessions, totalPlaytime, averageSessionLength };
  };

  const clearAnalyticsData = () => {
    // For now, directly clear data and show confirmation
    // TODO: Implement proper confirmation modal
    const performClear = async () => {
      setPlaybackSessions([]);
      setPlayerUsage([]);
      setCurrentSessions(new Map());
      await AsyncStorage.removeItem(SESSIONS_STORAGE_KEY);
      showSuccess('Analytics data cleared successfully');
    };
    
    performClear();
  };

  const SimpleBarChart: React.FC<{ data: { [date: string]: number }; height: number }> = ({ data, height }) => {
    const values = Object.values(data);
    const maxValue = Math.max(...values, 1);
    const barWidth = (SCREEN_WIDTH - 80) / 7; // 7 days, with padding

    return (
      <View style={[styles.chartContainer, { height }]}>
        {Object.entries(data).map(([date, value], index) => {
          const barHeight = (value / maxValue) * (height - 20);
          const dayOfWeek = new Date(date).toLocaleDateString('en', { weekday: 'short' });
          
          return (
            <View key={date} style={styles.barContainer}>
              <View style={[styles.bar, { height: barHeight, width: barWidth - 10 }]} />
              <Text style={styles.barLabel}>{dayOfWeek}</Text>
              <Text style={styles.barValue}>{Math.round(value)}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const { totalSessions, totalPlaytime, averageSessionLength } = getTotalStats();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Player Analytics</Text>
        <Text style={styles.subtitle}>Usage insights and statistics</Text>
      </View>

      {/* Time Range Selector */}
      <View style={styles.timeRangeContainer}>
        {(['week', 'month', 'all'] as const).map(range => (
          <TouchableOpacity
            key={range}
            style={[
              styles.timeRangeButton,
              selectedTimeRange === range && styles.timeRangeButtonActive
            ]}
            onPress={() => setSelectedTimeRange(range)}
          >
            <Text style={[
              styles.timeRangeButtonText,
              selectedTimeRange === range && styles.timeRangeButtonTextActive
            ]}>
              {range === 'week' ? 'Last 7 Days' : range === 'month' ? 'Last 30 Days' : 'All Time'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Overall Stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>Overall Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalSessions}</Text>
            <Text style={styles.statLabel}>Total Sessions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{formatDuration(totalPlaytime)}</Text>
            <Text style={styles.statLabel}>Total Playtime</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{formatDuration(averageSessionLength)}</Text>
            <Text style={styles.statLabel}>Avg Session</Text>
          </View>
        </View>
      </View>

      {/* Current Active Sessions */}
      {currentSessions.size > 0 && (
        <View style={styles.activeSessionsContainer}>
          <Text style={styles.sectionTitle}>🔴 Currently Playing</Text>
          {Array.from(currentSessions.values()).map(session => (
            <View key={session.id} style={styles.activeSessionCard}>
              <Text style={styles.activeSessionPlayer}>
                {players.find(p => p.id === session.playerId)?.name}
              </Text>
              <Text style={styles.activeSessionCard}>{session.cardTitle}</Text>
              <Text style={styles.activeSessionTime}>
                Started {new Date().getTime() - session.startTime.getTime() > 60000
                  ? `${Math.round((new Date().getTime() - session.startTime.getTime()) / 60000)} min ago`
                  : 'just now'
                }
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Individual Player Stats */}
      <View style={styles.playersContainer}>
        <Text style={styles.sectionTitle}>Player Details</Text>
        
        {playerUsage.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No usage data yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Start playing content to see analytics
            </Text>
          </View>
        ) : (
          playerUsage
            .sort((a, b) => b.totalPlaytime - a.totalPlaytime)
            .map(player => (
              <View key={player.playerId} style={styles.playerCard}>
                <View style={styles.playerHeader}>
                  <Text style={styles.playerName}>{player.playerName}</Text>
                  <Text style={styles.lastActivity}>
                    {formatLastActivity(player.lastActivity)}
                  </Text>
                </View>

                <View style={styles.playerStats}>
                  <View style={styles.playerStatItem}>
                    <Text style={styles.playerStatValue}>{player.totalSessions}</Text>
                    <Text style={styles.playerStatLabel}>Sessions</Text>
                  </View>
                  <View style={styles.playerStatItem}>
                    <Text style={styles.playerStatValue}>
                      {formatDuration(player.totalPlaytime)}
                    </Text>
                    <Text style={styles.playerStatLabel}>Total Time</Text>
                  </View>
                  <View style={styles.playerStatItem}>
                    <Text style={styles.playerStatValue}>
                      {formatDuration(player.averageSessionLength)}
                    </Text>
                    <Text style={styles.playerStatLabel}>Avg Session</Text>
                  </View>
                </View>

                {player.mostPlayedCard && (
                  <View style={styles.mostPlayedCard}>
                    <Text style={styles.mostPlayedTitle}>Most Played:</Text>
                    <Text style={styles.mostPlayedCardName}>
                      {player.mostPlayedCard.cardTitle} ({player.mostPlayedCard.playCount}x)
                    </Text>
                  </View>
                )}

                {/* Daily Usage Chart */}
                {selectedTimeRange === 'week' && (
                  <View style={styles.chartSection}>
                    <Text style={styles.chartTitle}>Daily Usage (Minutes)</Text>
                    <SimpleBarChart data={player.dailyUsage} height={80} />
                  </View>
                )}
              </View>
            ))
        )}
      </View>

      {/* Clear Data Button */}
      {playbackSessions.length > 0 && (
        <TouchableOpacity style={styles.clearButton} onPress={clearAnalyticsData}>
          <Text style={styles.clearButtonText}>🗑️ Clear Analytics Data</Text>
        </TouchableOpacity>
      )}

      <View style={styles.bottomPadding} />
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
  timeRangeContainer: {
    flexDirection: 'row',
    padding: 15,
    justifyContent: 'space-between',
  },
  timeRangeButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  timeRangeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  timeRangeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  timeRangeButtonTextActive: {
    color: '#FFFFFF',
  },
  statsContainer: {
    margin: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  activeSessionsContainer: {
    margin: 15,
  },
  activeSessionCard: {
    backgroundColor: '#FFF3CD',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  activeSessionPlayer: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  activeSessionTitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  activeSessionTime: {
    fontSize: 12,
    color: '#856404',
    marginTop: 4,
  },
  playersContainer: {
    margin: 15,
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
  playerCard: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  playerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  lastActivity: {
    fontSize: 12,
    color: '#666',
  },
  playerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  playerStatItem: {
    alignItems: 'center',
  },
  playerStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  playerStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  mostPlayedCard: {
    backgroundColor: '#E8F5E8',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  mostPlayedTitle: {
    fontSize: 12,
    color: '#28A745',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  mostPlayedCardName: {
    fontSize: 14,
    color: '#333',
  },
  chartSection: {
    marginTop: 10,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  barContainer: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    backgroundColor: '#007AFF',
    borderRadius: 2,
    minHeight: 2,
  },
  barLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  barValue: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  clearButton: {
    backgroundColor: '#DC3545',
    margin: 15,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 50,
  },
});
