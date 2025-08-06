export interface YotoPlayer {
  id: string;
  name: string;
  model: string;
  firmwareVersion?: string;
  isOnline: boolean;
  batteryLevel?: number;
  volume?: number;
}

export interface YotoCard {
  id: string;
  title: string;
  description?: string;
  duration?: string;
  type?: string;
  contentType?: string;
  artist?: string;
  coverUrl?: string;
  imageUrl?: string;
  uri?: string;           // URI for MQTT playback
  chapters?: any[];       // Chapter information
  tracks?: any[];         // Track information
  metadata?: any;         // Additional metadata
}

export interface AuthResult {
  success: boolean;
  token?: string;
  refreshToken?: string;
  error?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface MqttMessage {
  action: string;
  cardId?: string;
  timestamp: number;
  [key: string]: any;
}

export interface ConnectionStatus {
  status: 'Connected' | 'Disconnected' | 'Connecting' | 'Reconnecting' | 'Offline' | 'Error' | 'Connection Timeout';
  message?: string;
}
