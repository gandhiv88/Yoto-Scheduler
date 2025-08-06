import { getValidAccessToken } from '../utils/tokenUtils';

export class YotoAPI {
  static BASE_URL = 'https://api.yotoplay.com';
  static CLIENT_ID = 'your_client_id_here'; // Replace with your actual client ID

  /**
   * Set the client ID for authentication
   */
  static setClientId(clientId) {
    YotoAPI.CLIENT_ID = clientId;
  }

  /**
   * Get current client ID
   */
  static getClientId() {
    return YotoAPI.CLIENT_ID;
  }

  static async makeRequest(endpoint, options = {}) {
    try {
      // Get valid access token automatically (handles refresh if needed)
      const token = await getValidAccessToken(this.CLIENT_ID);
      
      if (!token) {
        throw new Error('NO_VALID_TOKEN');
      }

      const url = `${this.BASE_URL}${endpoint}`;
      const defaultOptions = {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      };

      const response = await fetch(url, { ...defaultOptions, ...options });
      
      if (!response.ok) {
        // Handle 403 specifically for devices endpoint
        if (response.status === 403 && endpoint === '/device-v2/devices/mine') {
          throw new Error('NO_PLAYERS_ASSOCIATED');
        }
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request to ${endpoint} failed:`, error);
      throw error;
    }
  }

  static async getProfile() {
    try {
      console.log('Fetching user profile...');
      const profile = await this.makeRequest('/v1/me');
      console.log('Profile fetched successfully');
      return profile;
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      throw error;
    }
  }

  static async getPlayers() {
    try {
      console.log('🔍 [API] Fetching devices from Yoto API...');
      const response = await this.makeRequest('/device-v2/devices/mine');
      
      // Handle response structure: { "devices": [...] }
      const devices = response.devices || [];
      
      if (!Array.isArray(devices)) {
        throw new Error('Invalid response format from devices API');
      }
      
      console.log(`✅ [API] Fetched ${devices.length} devices from Yoto API`);
      
      if (devices.length === 0) {
        throw new Error('NO_PLAYERS_FOUND');
      }
      
      // Map device data to player format based on actual API response
      const players = devices.map(device => ({
        id: device.deviceId,
        name: device.name || device.description || 'Unknown Device',
        model: device.deviceType || device.deviceFamily || 'Yoto Player',
        firmwareVersion: device.releaseChannel,
        isOnline: device.online || false,
        deviceGroup: device.deviceGroup,
        // These fields might not be in the basic response, will be fetched separately
        batteryLevel: undefined,
        volume: undefined
      }));
      
      return players;
    } catch (error) {
      console.error('❌ [API] Failed to fetch devices:', error);
      throw error;
    }
  }

  static async getPlayer(playerId) {
    try {
      console.log(`Fetching device ${playerId}...`);
      const player = await this.makeRequest(`/device-v2/devices/${playerId}`);
      console.log('Device fetched successfully');
      return player;
    } catch (error) {
      console.error(`Failed to fetch device ${playerId}:`, error);
      throw error;
    }
  }

  static async getCards() {
    try {
      console.log('🔍 [API] Fetching cards from Yoto API...');
      const response = await this.makeRequest('/v1/cards');
      const cards = response.cards || response.data || response;
      
      if (!cards || !Array.isArray(cards)) {
        throw new Error('Invalid response format from cards API');
      }
      
      console.log(`✅ [API] Fetched ${cards.length} cards from Yoto API`);
      
      if (cards.length === 0) {
        throw new Error('NO_CARDS_FOUND');
      }
      
      return cards;
    } catch (error) {
      console.error('❌ [API] Failed to fetch cards:', error);
      throw error;
    }
  }

  static async getUserContent() {
    try {
      console.log('🔍 [API] Fetching user content from Yoto API...');
      const response = await this.makeRequest('/content/mine');
      
      // Handle different possible response structures
      const content = response.content || response.cards || response.data || response;
      
      if (!content || !Array.isArray(content)) {
        throw new Error('Invalid response format from content API');
      }
      
      console.log(`✅ [API] Fetched ${content.length} content items from Yoto API`);
      
      if (content.length === 0) {
        console.log('⚠️ [API] No content found for user');
        return [];
      }
      
      // Map content to a consistent format
      const mappedContent = content.map(item => ({
        id: item.id || item.cardId,
        title: item.title || item.name,
        description: item.description,
        imageUrl: item.imageUrl || item.coverImage,
        contentType: item.contentType || item.type,
        uri: item.uri || item.playUri,
        duration: item.duration,
        chapters: item.chapters || [],
        tracks: item.tracks || [],
        metadata: item.metadata || {}
      }));
      
      return mappedContent;
    } catch (error) {
      console.error('❌ [API] Failed to fetch user content:', error);
      throw error;
    }
  }

  static async getCard(cardId) {
    try {
      console.log(`Fetching card ${cardId}...`);
      const card = await this.makeRequest(`/v1/cards/${cardId}`);
      console.log('Card fetched successfully');
      return card;
    } catch (error) {
      console.error(`Failed to fetch card ${cardId}:`, error);
      throw error;
    }
  }

  static async getPlayerStatus(playerId) {
    try {
      console.log(`Fetching status for device ${playerId}...`);
      const status = await this.makeRequest(`/device-v2/devices/${playerId}/status`);
      console.log('Device status fetched successfully');
      return status;
    } catch (error) {
      console.error(`Failed to fetch device status for ${playerId}:`, error);
      throw error;
    }
  }

  static async setPlayerVolume(playerId, volume) {
    try {
      console.log(`Setting volume to ${volume} for device ${playerId}...`);
      const result = await this.makeRequest(`/device-v2/devices/${playerId}/volume`, {
        method: 'PUT',
        body: JSON.stringify({ volume }),
      });
      console.log('Volume set successfully');
      return result;
    } catch (error) {
      console.error(`Failed to set volume for device ${playerId}:`, error);
      throw error;
    }
  }

  static async playCard(playerId, cardId) {
    try {
      console.log(`Playing card ${cardId} on device ${playerId}...`);
      const result = await this.makeRequest(`/device-v2/devices/${playerId}/play`, {
        method: 'POST',
        body: JSON.stringify({ cardId }),
      });
      console.log('Card play command sent successfully');
      return result;
    } catch (error) {
      console.error(`Failed to play card ${cardId} on device ${playerId}:`, error);
      throw error;
    }
  }

  static async controlPlayback(playerId, action) {
    try {
      console.log(`Sending ${action} command to device ${playerId}...`);
      const result = await this.makeRequest(`/device-v2/devices/${playerId}/control`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      console.log(`${action} command sent successfully`);
      return result;
    } catch (error) {
      console.error(`Failed to send ${action} command to device ${playerId}:`, error);
      throw error;
    }
  }

  static async sendMqttCommand(deviceId, command) {
    try {
      console.log(`🚀 [API] Sending MQTT command to device ${deviceId}:`, command);
      
      // Get valid access token automatically
      const token = await getValidAccessToken(this.CLIENT_ID);
      if (!token) {
        throw new Error('NO_VALID_TOKEN');
      }
      
      console.log(`🔐 [API] Using token: YES (length: ${token.length})`);
      console.log(`🔍 [API] Full JWT token:`, token);
      console.log(`🌐 [API] Full URL: https://api.yotoplay.com/${deviceId}/command/status`);
      console.log(`📦 [API] Request body:`, JSON.stringify(command));
      
      // Log complete curl command for testing online
      console.log(`🧪 [API] Complete curl command for testing:`);
      console.log(`curl -X POST \\`);
      console.log(`  "https://api.yotoplay.com/${deviceId}/command/status" \\`);
      console.log(`  -H "Authorization: Bearer ${token}" \\`);
      console.log(`  -H "Accept: application/json" \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '${JSON.stringify(command)}'`);
      
      // Log fetch command for testing in browser/Postman
      console.log(`🌐 [API] JavaScript fetch for testing:`);
      console.log(`fetch('https://api.yotoplay.com/${deviceId}/command/status', {`);
      console.log(`  method: 'POST',`);
      console.log(`  headers: {`);
      console.log(`    'Authorization': 'Bearer ${token}',`);
      console.log(`    'Accept': 'application/json',`);
      console.log(`    'Content-Type': 'application/json'`);
      console.log(`  },`);
      console.log(`  body: '${JSON.stringify(command)}'`);
      console.log(`})`);
      console.log(`.then(response => response.json())`);
      console.log(`.then(data => console.log(data))`);
      console.log(`.catch(err => console.error(err));`);
      
      // Use the exact endpoint format from API docs: {deviceId}/command/status
      const result = await this.makeRequest(`/${deviceId}/command/status`, {
        method: 'POST',
        body: JSON.stringify(command),
      });
      console.log('✅ [API] MQTT command sent successfully');
      return result;
    } catch (error) {
      console.error(`❌ [API] Failed to send MQTT command to device ${deviceId}:`, error);
      throw error;
    }
  }

  static async setAmbientLightViaMqtt(deviceId, r, g, b) {
    try {
      console.log(`🌈 [API] Setting ambient light to RGB(${r}, ${g}, ${b}) for device ${deviceId} via MQTT API...`);
      
      // Use the sendMqttCommand method with the correct MQTT payload format
      // Based on MQTT docs: /device/{id}/command/ambients/set expects {"r": <integer>, "g": <integer>, "b": <integer>}
      const mqttPayload = { r, g, b };
      
      const result = await this.sendMqttCommand(deviceId, mqttPayload);
      console.log('✅ [API] Ambient light MQTT command sent successfully');
      return result;
    } catch (error) {
      console.error(`❌ [API] Failed to set ambient light via MQTT for device ${deviceId}:`, error);
      throw error;
    }
  }

  // Utility method to test API connectivity
  static async testConnection() {
    try {
      console.log('Testing API connection...');
      await this.makeRequest('/v1/me');
      console.log('API connection test successful');
      return { success: true };
    } catch (error) {
      console.error('API connection test failed:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
}
