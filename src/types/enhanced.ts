// Enhanced component interfaces for compatibility
export interface EnhancedMqttClient {
  isConnected: boolean;
  connectionStatus?: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  playCard: (playerId: string, cardId: string) => Promise<void>;
  pausePlayback: (playerId: string) => Promise<void>;
  stopPlayback: (playerId: string) => Promise<void>;
  setAmbientLight: (playerId: string, brightness: number, color?: string) => Promise<void>;
  turnOffAmbientLight: (playerId: string) => Promise<void>;
  setNightLight: (playerId: string, enabled: boolean, brightness?: number) => Promise<void>;
  testConnection?: () => Promise<boolean>;
  getConnectionStats?: () => any;
  onPlaybackStarted?: (callback: (playerId: string, cardId: string, cardTitle: string) => void) => void;
  onPlaybackStopped?: (callback: (playerId: string) => void) => void;
}

export interface EnhancedContent {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  contentType?: string;
  uri?: string;
  duration?: number; // in seconds, converted from YotoCard string
  chapters?: any[];
  tracks?: any[];
  metadata?: any;
}

export interface EnhancedApiService {
  testConnection: () => Promise<{ success: boolean; error?: string }>;
  getRequestStats?: () => any;
}

// Helper function to convert YotoCard to EnhancedContent
export const convertYotoCardToContent = (card: any): EnhancedContent => {
  let duration: number | undefined;
  
  // Convert string duration to number if present
  if (card.duration) {
    if (typeof card.duration === 'string') {
      // Try to parse duration string (e.g., "5:30" -> 330 seconds)
      const parts = card.duration.split(':');
      if (parts.length === 2) {
        const minutes = parseInt(parts[0], 10);
        const seconds = parseInt(parts[1], 10);
        duration = minutes * 60 + seconds;
      } else {
        // Try to parse as number
        const parsed = parseFloat(card.duration);
        if (!isNaN(parsed)) {
          duration = parsed;
        }
      }
    } else if (typeof card.duration === 'number') {
      duration = card.duration;
    }
  }

  return {
    id: card.id,
    title: card.title,
    description: card.description,
    imageUrl: card.imageUrl || card.image,
    contentType: card.contentType || card.type,
    uri: card.uri || card.url,
    duration,
    chapters: card.chapters || [],
    tracks: card.tracks || [],
    metadata: card.metadata || {},
  };
};
