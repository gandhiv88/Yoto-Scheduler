import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Image,
  FlatList,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { YotoPlayer } from '../types/index';

interface Content {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  contentType?: string;
  uri?: string;
  duration?: number;
  chapters?: any[];
  tracks?: any[];
  metadata?: any;
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  cards: string[]; // Array of card IDs
  createdAt: Date;
  lastPlayed?: Date;
  autoPlay: boolean;
  shuffleMode: boolean;
}

interface MqttClient {
  playCard: (playerId: string, cardId: string) => Promise<void>;
  pausePlayback: (playerId: string) => Promise<void>;
  stopPlayback: (playerId: string) => Promise<void>;
}

interface EnhancedContentBrowserProps {
  players: YotoPlayer[];
  content: Content[];
  mqttClient: MqttClient | null;
  onBack: () => void;
  onRefreshContent?: () => Promise<void>;
}

export const EnhancedContentBrowser: React.FC<EnhancedContentBrowserProps> = ({
  players,
  content,
  mqttClient,
  onBack,
  onRefreshContent,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showPlaylistForm, setShowPlaylistForm] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string>(players[0]?.id || '');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'title' | 'duration' | 'recent'>('title');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // New playlist form state
  const [newPlaylist, setNewPlaylist] = useState({
    name: '',
    description: '',
    autoPlay: false,
    shuffleMode: false,
  });

  const FAVORITES_KEY = 'yoto_favorites';
  const PLAYLISTS_KEY = 'yoto_playlists';

  useEffect(() => {
    loadFavorites();
    loadPlaylists();
  }, []);

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem(FAVORITES_KEY);
      if (stored) {
        setFavorites(new Set(JSON.parse(stored)));
      }
    } catch (error) {
      console.error('❌ [CONTENT] Failed to load favorites:', error);
    }
  };

  const saveFavorites = async (favs: Set<string>) => {
    try {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favs)));
    } catch (error) {
      console.error('❌ [CONTENT] Failed to save favorites:', error);
    }
  };

  const loadPlaylists = async () => {
    try {
      const stored = await AsyncStorage.getItem(PLAYLISTS_KEY);
      if (stored) {
        const lists = JSON.parse(stored).map((playlist: any) => ({
          ...playlist,
          createdAt: new Date(playlist.createdAt),
          lastPlayed: playlist.lastPlayed ? new Date(playlist.lastPlayed) : undefined,
        }));
        setPlaylists(lists);
      }
    } catch (error) {
      console.error('❌ [CONTENT] Failed to load playlists:', error);
    }
  };

  const savePlaylists = async (lists: Playlist[]) => {
    try {
      await AsyncStorage.setItem(PLAYLISTS_KEY, JSON.stringify(lists));
    } catch (error) {
      console.error('❌ [CONTENT] Failed to save playlists:', error);
    }
  };

  const toggleFavorite = async (cardId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(cardId)) {
      newFavorites.delete(cardId);
    } else {
      newFavorites.add(cardId);
    }
    setFavorites(newFavorites);
    await saveFavorites(newFavorites);
  };

  const getCategories = (): string[] => {
    const categories = new Set(['all']);
    content.forEach(card => {
      if (card.contentType) {
        categories.add(card.contentType);
      }
    });
    return Array.from(categories);
  };

  const getFilteredContent = (): Content[] => {
    let filtered = content;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(card =>
        card.title.toLowerCase().includes(query) ||
        (card.description && card.description.toLowerCase().includes(query))
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(card => card.contentType === selectedCategory);
    }

    // Filter by favorites
    if (showFavoritesOnly) {
      filtered = filtered.filter(card => favorites.has(card.id));
    }

    // Sort content
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'duration':
          return (b.duration || 0) - (a.duration || 0);
        case 'recent':
          // For now, just sort by title since we don't have recent play data in content
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const playCard = async (cardId: string) => {
    if (!mqttClient || !selectedPlayer) {
      Alert.alert('Error', 'Please select a player first');
      return;
    }

    try {
      await mqttClient.playCard(selectedPlayer, cardId);
      const card = content.find(c => c.id === cardId);
      Alert.alert('Success', `Playing "${card?.title}" on ${players.find(p => p.id === selectedPlayer)?.name}`);
    } catch (error) {
      console.error('❌ [CONTENT] Failed to play card:', error);
      Alert.alert('Error', 'Failed to play card');
    }
  };

  const createPlaylist = async () => {
    if (!newPlaylist.name.trim()) {
      Alert.alert('Error', 'Please enter a playlist name');
      return;
    }

    const playlist: Playlist = {
      id: Date.now().toString(),
      name: newPlaylist.name.trim(),
      description: newPlaylist.description.trim(),
      cards: [],
      createdAt: new Date(),
      autoPlay: newPlaylist.autoPlay,
      shuffleMode: newPlaylist.shuffleMode,
    };

    const updatedPlaylists = [...playlists, playlist];
    setPlaylists(updatedPlaylists);
    await savePlaylists(updatedPlaylists);

    setNewPlaylist({
      name: '',
      description: '',
      autoPlay: false,
      shuffleMode: false,
    });
    setShowPlaylistForm(false);

    Alert.alert('Success', 'Playlist created successfully!');
  };

  const addToPlaylist = (cardId: string, playlistId: string) => {
    const updatedPlaylists = playlists.map(playlist => {
      if (playlist.id === playlistId) {
        if (!playlist.cards.includes(cardId)) {
          return { ...playlist, cards: [...playlist.cards, cardId] };
        }
      }
      return playlist;
    });

    setPlaylists(updatedPlaylists);
    savePlaylists(updatedPlaylists);
    
    const card = content.find(c => c.id === cardId);
    const playlist = playlists.find(p => p.id === playlistId);
    Alert.alert('Success', `Added "${card?.title}" to "${playlist?.name}"`);
  };

  const playPlaylist = async (playlist: Playlist) => {
    if (!mqttClient || !selectedPlayer || playlist.cards.length === 0) {
      Alert.alert('Error', 'Playlist is empty or no player selected');
      return;
    }

    try {
      let cardsToPlay = [...playlist.cards];
      if (playlist.shuffleMode) {
        cardsToPlay = cardsToPlay.sort(() => Math.random() - 0.5);
      }

      // Play the first card
      await mqttClient.playCard(selectedPlayer, cardsToPlay[0]);
      
      // Update last played time
      const updatedPlaylists = playlists.map(p => 
        p.id === playlist.id ? { ...p, lastPlayed: new Date() } : p
      );
      setPlaylists(updatedPlaylists);
      await savePlaylists(updatedPlaylists);

      Alert.alert('Success', `Playing playlist "${playlist.name}"`);
      
      // TODO: Implement queue system for auto-playing remaining cards
    } catch (error) {
      console.error('❌ [CONTENT] Failed to play playlist:', error);
      Alert.alert('Error', 'Failed to play playlist');
    }
  };

  const refreshContent = async () => {
    if (!onRefreshContent) return;
    
    setIsRefreshing(true);
    try {
      await onRefreshContent();
    } catch (error) {
      console.error('❌ [CONTENT] Failed to refresh content:', error);
      Alert.alert('Error', 'Failed to refresh content');
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatDuration = (duration?: number): string => {
    if (!duration) return '';
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const filteredContent = getFilteredContent();
  const categories = getCategories();

  const ContentCard: React.FC<{ card: Content; isGridView: boolean }> = ({ card, isGridView }) => (
    <TouchableOpacity
      style={[styles.contentCard, isGridView ? styles.gridCard : styles.listCard]}
      onPress={() => playCard(card.id)}
    >
      {card.imageUrl && (
        <Image 
          source={{ uri: card.imageUrl }} 
          style={[styles.cardImage, isGridView ? styles.gridImage : styles.listImage]}
          resizeMode="cover"
        />
      )}
      
      <View style={[styles.cardInfo, isGridView && styles.gridCardInfo]}>
        <Text style={[styles.cardTitle, isGridView && styles.gridCardTitle]} numberOfLines={isGridView ? 2 : 1}>
          {card.title}
        </Text>
        
        {!isGridView && card.description && (
          <Text style={styles.cardDescription} numberOfLines={2}>
            {card.description}
          </Text>
        )}
        
        <View style={styles.cardMeta}>
          {card.duration && (
            <Text style={styles.cardDuration}>{formatDuration(card.duration)}</Text>
          )}
          {card.contentType && (
            <Text style={styles.cardType}>{card.contentType}</Text>
          )}
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() => toggleFavorite(card.id)}
        >
          <Text style={styles.favoriteIcon}>
            {favorites.has(card.id) ? '❤️' : '🤍'}
          </Text>
        </TouchableOpacity>

        {playlists.length > 0 && (
          <TouchableOpacity
            style={styles.playlistButton}
            onPress={() => {
              Alert.alert(
                'Add to Playlist',
                'Select a playlist:',
                [
                  ...playlists.map(playlist => ({
                    text: playlist.name,
                    onPress: () => addToPlaylist(card.id, playlist.id),
                  })),
                  { text: 'Cancel' }
                ]
              );
            }}
          >
            <Text style={styles.playlistIcon}>📚</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Content Browser</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={refreshContent}>
          <Text style={styles.refreshButtonText}>
            {isRefreshing ? '↻' : '🔄'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Player Selection */}
      <View style={styles.playerSelector}>
        <Text style={styles.selectorLabel}>Play on:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {players.map(player => (
            <TouchableOpacity
              key={player.id}
              style={[
                styles.playerButton,
                selectedPlayer === player.id && styles.playerButtonActive
              ]}
              onPress={() => setSelectedPlayer(player.id)}
            >
              <Text style={[
                styles.playerButtonText,
                selectedPlayer === player.id && styles.playerButtonTextActive
              ]}>
                {player.name} {player.isOnline ? '🟢' : '🔴'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Search and Filters */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search content..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
            {categories.map(category => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  selectedCategory === category && styles.categoryButtonActive
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[
                  styles.categoryButtonText,
                  selectedCategory === category && styles.categoryButtonTextActive
                ]}>
                  {category === 'all' ? 'All' : category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.controlRow}>
          <View style={styles.viewControls}>
            <TouchableOpacity
              style={[styles.viewButton, viewMode === 'grid' && styles.viewButtonActive]}
              onPress={() => setViewMode('grid')}
            >
              <Text>▦</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewButton, viewMode === 'list' && styles.viewButtonActive]}
              onPress={() => setViewMode('list')}
            >
              <Text>☰</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.favoriteToggle}>
            <Text style={styles.favoriteToggleText}>❤️ Only</Text>
            <Switch
              value={showFavoritesOnly}
              onValueChange={setShowFavoritesOnly}
              trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
            />
          </View>
        </View>
      </View>

      {/* Playlists Section */}
      <View style={styles.playlistsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Playlists ({playlists.length})</Text>
          <TouchableOpacity
            style={styles.addPlaylistButton}
            onPress={() => setShowPlaylistForm(!showPlaylistForm)}
          >
            <Text style={styles.addPlaylistButtonText}>
              {showPlaylistForm ? '✕' : '+'}
            </Text>
          </TouchableOpacity>
        </View>

        {showPlaylistForm && (
          <View style={styles.playlistForm}>
            <TextInput
              style={styles.formInput}
              placeholder="Playlist name"
              value={newPlaylist.name}
              onChangeText={(text) => setNewPlaylist({...newPlaylist, name: text})}
            />
            <TextInput
              style={styles.formInput}
              placeholder="Description (optional)"
              value={newPlaylist.description}
              onChangeText={(text) => setNewPlaylist({...newPlaylist, description: text})}
            />
            <View style={styles.formRow}>
              <Text>Auto-play next:</Text>
              <Switch
                value={newPlaylist.autoPlay}
                onValueChange={(value) => setNewPlaylist({...newPlaylist, autoPlay: value})}
              />
            </View>
            <View style={styles.formRow}>
              <Text>Shuffle mode:</Text>
              <Switch
                value={newPlaylist.shuffleMode}
                onValueChange={(value) => setNewPlaylist({...newPlaylist, shuffleMode: value})}
              />
            </View>
            <TouchableOpacity style={styles.createPlaylistButton} onPress={createPlaylist}>
              <Text style={styles.createPlaylistButtonText}>Create Playlist</Text>
            </TouchableOpacity>
          </View>
        )}

        {playlists.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {playlists.map(playlist => (
              <TouchableOpacity
                key={playlist.id}
                style={styles.playlistCard}
                onPress={() => playPlaylist(playlist)}
              >
                <Text style={styles.playlistName}>{playlist.name}</Text>
                <Text style={styles.playlistInfo}>
                  {playlist.cards.length} cards
                </Text>
                {playlist.shuffleMode && <Text style={styles.playlistShuffle}>🔀</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Content Grid/List */}
      <View style={styles.contentContainer}>
        <Text style={styles.contentCount}>
          {filteredContent.length} {filteredContent.length === 1 ? 'item' : 'items'}
          {showFavoritesOnly && ' (favorites)'}
        </Text>
        
        <FlatList
          data={filteredContent}
          renderItem={({ item }) => <ContentCard card={item} isGridView={viewMode === 'grid'} />}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === 'grid' ? 2 : 1}
          key={viewMode} // Force re-render when view mode changes
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentList}
        />
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {},
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {},
  refreshButtonText: {
    fontSize: 18,
  },
  playerSelector: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  selectorLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  playerButton: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  playerButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  playerButtonText: {
    fontSize: 14,
    color: '#333',
  },
  playerButtonTextActive: {
    color: '#FFFFFF',
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInput: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 10,
  },
  filterRow: {
    marginBottom: 10,
  },
  categoriesScroll: {
    flexGrow: 0,
  },
  categoryButton: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryButtonText: {
    fontSize: 12,
    color: '#333',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewControls: {
    flexDirection: 'row',
  },
  viewButton: {
    backgroundColor: '#F8F9FA',
    padding: 8,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  viewButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  favoriteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoriteToggleText: {
    fontSize: 14,
    marginRight: 8,
  },
  playlistsSection: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  addPlaylistButton: {
    backgroundColor: '#007AFF',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPlaylistButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  playlistForm: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  createPlaylistButton: {
    backgroundColor: '#28A745',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  createPlaylistButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  playlistCard: {
    backgroundColor: '#E8F5E8',
    padding: 12,
    borderRadius: 8,
    marginRight: 10,
    minWidth: 120,
  },
  playlistName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  playlistInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  playlistShuffle: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  contentContainer: {
    flex: 1,
    padding: 15,
  },
  contentCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  contentList: {
    paddingBottom: 20,
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gridCard: {
    flex: 1,
    marginHorizontal: 5,
  },
  listCard: {
    flexDirection: 'row',
    padding: 12,
  },
  cardImage: {
    borderRadius: 8,
  },
  gridImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  listImage: {
    width: 60,
    height: 60,
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  gridCardInfo: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  gridCardTitle: {
    fontSize: 14,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDuration: {
    fontSize: 12,
    color: '#999',
  },
  cardType: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoriteButton: {
    padding: 8,
  },
  favoriteIcon: {
    fontSize: 16,
  },
  playlistButton: {
    padding: 8,
  },
  playlistIcon: {
    fontSize: 16,
  },
});
