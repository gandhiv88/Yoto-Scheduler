import mqtt from 'mqtt';

console.log('🔍 [MQTT] Imported mqtt:', mqtt);
console.log('🔍 [MQTT] mqtt.connect type:', typeof mqtt.connect);

export class MqttClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionStatusCallback = null;
    this.lastConnectionTime = null;
    this.connectionHealthTimer = null;
    this.schedulerCheckInterval = null;
  }

  async connect(playerId, token) {
    try {
      // Initialize MQTT client with WebSocket configuration using correct Yoto format
      const clientId = `SAMPLE${playerId}`;  // Use SAMPLE prefix like working implementation
      const username = `${playerId}?x-amz-customauthorizer-name=PublicJWTAuthorizer`;
      
      // MQTT WebSocket URL for AWS IoT (without /mqtt path)
      const brokerUrl = `wss://aqrphjqbp3u2z-ats.iot.eu-west-2.amazonaws.com`;
      
      // Validate token format
      console.log('🔐 [MQTT] Token validation:', {
        hasToken: !!token,
        tokenLength: token?.length,
        tokenPrefix: token?.substring(0, 20) + '...',
        isJWT: token?.split('.').length === 3
      });
      
      // MQTT connection options using exact format from working code
      const options = {
        keepalive: 300,               // Reduced to 5 minutes like working code
        port: 443,
        protocol: "wss",
        username: username,
        password: token,
        reconnectPeriod: 0,           // Disable automatic reconnect (we'll handle manually)
        clientId: clientId,
        ALPNProtocols: ["x-amzn-mqtt-ca"], // CRITICAL: AWS IoT ALPN protocol
      };

      console.log('🔧 [MQTT] Connection Options:', {
        brokerUrl,
        clientId: options.clientId,
        username: options.username,
        passwordLength: token.length
      });

      console.log('🔍 [MQTT] About to call mqtt.connect with:', brokerUrl, 'and options:', Object.keys(options));

      // Create MQTT client
      this.client = mqtt.connect(brokerUrl, options);

      console.log('🔍 [MQTT] Created client:', this.client);
      console.log('🔍 [MQTT] Client type:', typeof this.client);
      console.log('🔍 [MQTT] Client.on type:', typeof this.client?.on);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error('❌ [MQTT] Connection timeout');
          this.updateConnectionStatus('Connection Timeout');
          reject(new Error('Connection timeout'));
        }, 30000);

        this.client.on('connect', (connack) => {
          clearTimeout(timeout);
          console.log('✅ [MQTT] Connected successfully:', connack);
          console.log('🔍 [MQTT] Connection acknowledgment details:', {
            sessionPresent: connack.sessionPresent,
            returnCode: connack.returnCode,
            cmd: connack.cmd
          });
          
          this.isConnected = true;
          this.lastConnectionTime = Date.now();
          this.updateConnectionStatus('Connected');
          
          // Start connection health monitoring
          this.startConnectionHealthMonitor();
          
          // Subscribe to essential device topics like working implementation
          if (playerId) {
            const topics = [
              `device/${playerId}/events`,
              `device/${playerId}/status`,
              `device/${playerId}/response`,
            ];

            topics.forEach((topic) => {
              this.client.subscribe(topic, (err) => {
                if (err) {
                  console.error(`❌ [MQTT] Failed to subscribe to ${topic}:`, err);
                } else {
                  console.log(`✅ [MQTT] Subscribed to ${topic}`);
                }
              });
            });

            // Request initial status update
            this.requestStatusUpdate(playerId);
          }
          
          resolve(true);
        });

        this.client.on('error', (error) => {
          clearTimeout(timeout);
          console.error('❌ [MQTT] Connection error:', error);
          console.error('❌ [MQTT] Error details:', {
            message: error.message,
            code: error.code,
            errno: error.errno,
            stack: error.stack
          });
          this.isConnected = false;
          this.updateConnectionStatus(`Error: ${error.message}`);
          reject(error);
        });

        this.client.on('close', () => {
          console.log('🔌 [MQTT] Connection closed');
          this.isConnected = false;
          this.updateConnectionStatus('Disconnected');
          this.stopConnectionHealthMonitor();
          
          // Disable automatic reconnect to prevent loop
          if (this.client) {
            this.client.options.reconnectPeriod = 0;
          }
        });

        this.client.on('reconnect', () => {
          console.log('🔄 [MQTT] Reconnecting...');
          this.updateConnectionStatus('Reconnecting');
        });

        this.client.on('offline', (error) => {
          console.log('📴 [MQTT] Client offline:', error);
          console.log('📴 [MQTT] Offline reason:', {
            clientConnected: this.client?.connected,
            clientConnecting: this.client?.reconnecting,
            clientOptions: this.client?.options
          });
          this.isConnected = false;
          this.updateConnectionStatus('Offline');
          
          // Stop reconnection attempts when going offline
          if (this.client) {
            this.client.options.reconnectPeriod = 0;
          }
        });

        this.client.on('disconnect', (packet) => {
          console.log('🚪 [MQTT] Disconnect packet received:', packet);
          this.isConnected = false;
          this.updateConnectionStatus('Disconnected');
        });

        this.client.on('message', (topic, message, packet) => {
          console.log('📨 [MQTT] Message received:', {
            topic,
            message: message.toString(),
            packet
          });
          this.handleMessage(topic, message.toString());
        });

        // Start connection
        console.log('🚀 [MQTT] Initiating connection...');
        this.updateConnectionStatus('Connecting');
      });

    } catch (error) {
      console.error('❌ [MQTT] Setup error:', error);
      this.updateConnectionStatus(`Setup Error: ${error.message}`);
      throw error;
    }
  }

  subscribeToPlayerTopics(playerId) {
    if (!this.client || !this.isConnected) {
      console.log('⚠️ [MQTT] Cannot subscribe - client not connected');
      return;
    }

    // Subscribe to Yoto device topics using correct format
    const topics = [
      `/device/${playerId}/state`,        // Device state updates
      `/device/${playerId}/playback`,     // Playback status
      `/device/${playerId}/volume`,       // Volume changes
      `/device/${playerId}/card`,         // Card status
      `/device/${playerId}/battery`,      // Battery status
      `/device/${playerId}/ambients`      // Ambient light status
    ];

    console.log(`🔔 [MQTT] Attempting to subscribe to ${topics.length} topics...`);

    topics.forEach((topic, index) => {
      // Add small delay between subscriptions
      setTimeout(() => {
        if (!this.client || !this.isConnected) {
          console.log(`⚠️ [MQTT] Skipping subscription to ${topic} - connection lost`);
          return;
        }

        this.client.subscribe(topic, { qos: 1 }, (err, granted) => {
          if (err) {
            console.error(`❌ [MQTT] Failed to subscribe to ${topic}:`, err);
          } else if (granted) {
            console.log(`✅ [MQTT] Subscribed to ${topic}`, granted);
          } else {
            console.log(`✅ [MQTT] Subscribed to ${topic}`);
          }
        });
      }, index * 100); // 100ms delay between each subscription
    });
  }

  handleMessage(topic, message) {
    try {
      const data = JSON.parse(message);
      console.log(`📨 [MQTT] Message from ${topic}:`, data);
      
      // Handle different Yoto device message types
      if (topic.includes('/state')) {
        console.log('📊 [MQTT] Device state update:', data);
      } else if (topic.includes('/playback')) {
        console.log('▶️ [MQTT] Playback status update:', data);
      } else if (topic.includes('/card')) {
        console.log('🎵 [MQTT] Card status update:', data);
      } else if (topic.includes('/volume')) {
        console.log('🔊 [MQTT] Volume update:', data);
      } else if (topic.includes('/battery')) {
        console.log('🔋 [MQTT] Battery update:', data);
      } else if (topic.includes('/ambients')) {
        console.log('💡 [MQTT] Ambient light update:', data);
      }
    } catch (error) {
      console.error('❌ [MQTT] Error parsing message:', error);
      console.log('📄 [MQTT] Raw message:', message);
    }
  }

  async playCard(playerId, cardUri, options = {}) {
    if (!this.isConnectionHealthy()) {
      console.error('❌ [MQTT] Connection not healthy for playCard operation');
      throw new Error('MQTT client not connected');
    }

    // Use correct Yoto MQTT topic format: /device/{id}/command/card/start
    const topic = `device/${playerId}/command/card/start`;
    
    // Build payload according to Yoto specification
    const payload = {
      uri: cardUri // Required field: Card URI (e.g., https://yoto.io/<cardID> or just cardID)
    };

    // Add optional parameters if provided
    if (options.chapterKey) {
      payload.chapterKey = options.chapterKey; // Chapter to start playback from
    }
    if (options.trackKey) {
      payload.trackKey = options.trackKey; // Track to start playback from
    }
    if (typeof options.secondsIn === 'number') {
      payload.secondsIn = options.secondsIn; // Playback start offset (in seconds)
    }
    if (typeof options.cutOff === 'number') {
      payload.cutOff = options.cutOff; // Playback stop offset (in seconds)
    }
    if (typeof options.anyButtonStop === 'boolean') {
      payload.anyButtonStop = options.anyButtonStop; // Whether button press stops playback
    }

    const message = JSON.stringify(payload);

    console.log(`🎵 [MQTT] Publishing card start command to: ${topic}`);
    console.log(`🎵 [MQTT] Full payload:`, payload);
    console.log(`🎵 [MQTT] Card URI format:`, {
      original: cardUri,
      isFullUrl: cardUri.includes('https://'),
      isYotoUrl: cardUri.includes('yoto.io'),
      length: cardUri.length
    });

    return new Promise((resolve, reject) => {
      this.client.publish(topic, message, { qos: 1 }, (error) => {
        if (error) {
          console.error('❌ [MQTT] Failed to publish card start command:', error);
          reject(error);
        } else {
          console.log(`✅ [MQTT] Published card start command for URI: ${cardUri}`);
          resolve();
        }
      });
    });
  }

  // Request status update from device (like working implementation)
  requestStatusUpdate(playerId) {
    if (!this.isConnectionHealthy()) {
      console.error('❌ [MQTT] Cannot request status - not connected');
      return;
    }

    const topic = `device/${playerId}/command/events`;
    
    console.log(`📊 [MQTT] Requesting status update from: ${topic}`);

    this.client.publish(topic, "", (err) => {
      if (err) {
        console.error('❌ [MQTT] Error requesting status update:', err);
      } else {
        console.log('✅ [MQTT] Status update requested');
      }
    });
  }

  async pausePlayback(playerId) {
    if (!this.isConnectionHealthy()) {
      console.error('❌ [MQTT] Connection not healthy for pause operation');
      throw new Error('MQTT client not connected');
    }

    // Use correct Yoto MQTT topic for pause command
    const topic = `device/${playerId}/command/card/pause`;
    const payload = {};
    const message = JSON.stringify(payload);

    console.log(`⏸️ [MQTT] Publishing card pause command to: ${topic}`);

    return new Promise((resolve, reject) => {
      this.client.publish(topic, message, { qos: 1 }, (error) => {
        if (error) {
          console.error('❌ [MQTT] Failed to publish pause command:', error);
          reject(error);
        } else {
          console.log('✅ [MQTT] Published card pause command');
          resolve();
        }
      });
    });
  }

  async resumePlayback(playerId) {
    if (!this.isConnectionHealthy()) {
      console.error('❌ [MQTT] Connection not healthy for resume operation');
      throw new Error('MQTT client not connected');
    }

    // Use correct Yoto MQTT topic for resume command
    const topic = `device/${playerId}/command/card/resume`;
    const payload = {};
    const message = JSON.stringify(payload);

    console.log(`▶️ [MQTT] Publishing card resume command to: ${topic}`);

    return new Promise((resolve, reject) => {
      this.client.publish(topic, message, { qos: 1 }, (error) => {
        if (error) {
          console.error('❌ [MQTT] Failed to publish resume command:', error);
          reject(error);
        } else {
          console.log('✅ [MQTT] Published card resume command');
          resolve();
        }
      });
    });
  }

  async stopPlayback(playerId) {
    if (!this.isConnectionHealthy()) {
      console.error('❌ [MQTT] Connection not healthy for stop operation');
      throw new Error('MQTT client not connected');
    }

    // Use correct Yoto MQTT topic for stop command
    const topic = `device/${playerId}/command/card/stop`;
    const payload = {};
    const message = JSON.stringify(payload);

    console.log(`⏹️ [MQTT] Publishing card stop command to: ${topic}`);

    return new Promise((resolve, reject) => {
      this.client.publish(topic, message, { qos: 1 }, (error) => {
        if (error) {
          console.error('❌ [MQTT] Failed to publish stop command:', error);
          reject(error);
        } else {
          console.log('✅ [MQTT] Published card stop command');
          resolve();
        }
      });
    });
  }

  // Helper function to convert hex color to RGB values
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 }; // Default to white if parsing fails
  }

  // Updated setAmbientLight method to handle both formats
  async setAmbientLight(playerId, brightnessOrR, colorOrG, bParam) {
    if (!this.isConnectionHealthy()) {
      console.error('❌ [MQTT] Connection not healthy for ambient light operation');
      throw new Error('MQTT client not connected or unhealthy');
    }

    let r, g, b;

    // Check if called with brightness/color format (from AmbientLightControl)
    if (typeof brightnessOrR === 'number' && typeof colorOrG === 'string' && bParam === undefined) {
      // Format: setAmbientLight(playerId, brightness, hexColor)
      const brightness = brightnessOrR;
      const hexColor = colorOrG;
      
      console.log(`💡 [MQTT] Converting brightness/color format: ${brightness}%, ${hexColor}`);
      
      // Convert hex color to RGB
      const rgb = this.hexToRgb(hexColor);
      
      // Apply brightness scaling (0-100% to 0-255)
      const brightnessScale = Math.max(0, Math.min(100, brightness)) / 100;
      r = Math.round(rgb.r * brightnessScale);
      g = Math.round(rgb.g * brightnessScale);
      b = Math.round(rgb.b * brightnessScale);
      
      console.log(`💡 [MQTT] Converted to RGB: r=${r}, g=${g}, b=${b} (brightness: ${brightness}%)`);
    } else if (typeof brightnessOrR === 'number' && typeof colorOrG === 'number' && typeof bParam === 'number') {
      // Format: setAmbientLight(playerId, r, g, b) - legacy format
      r = brightnessOrR;
      g = colorOrG;
      b = bParam;
      
      console.log(`💡 [MQTT] Using direct RGB format: r=${r}, g=${g}, b=${b}`);
    } else {
      throw new Error('Invalid parameters. Use either setAmbientLight(playerId, brightness, hexColor) or setAmbientLight(playerId, r, g, b)');
    }

    // Ensure RGB values are within valid range (0-255)
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));

    // Use correct Yoto MQTT topic for ambient light command (like working implementation)
    const topic = `device/${playerId}/command/ambients`;
    const payload = {
      r: r, // Red value (0-255)
      g: g, // Green value (0-255) 
      b: b  // Blue value (0-255)
    };

    const message = JSON.stringify(payload);

    console.log(`💡 [MQTT] Publishing ambient light command to: ${topic}`);
    console.log(`💡 [MQTT] Final RGB payload:`, payload);
    console.log(`💡 [MQTT] Client connection state:`, {
      clientExists: !!this.client,
      isConnected: this.isConnected,
      clientConnected: this.client?.connected,
      connectionAge: this.lastConnectionTime ? Date.now() - this.lastConnectionTime : 'N/A'
    });

    return new Promise((resolve, reject) => {
      this.client.publish(topic, message, { qos: 1 }, (error) => {
        if (error) {
          console.error('❌ [MQTT] Failed to publish ambient light command:', error);
          console.error('❌ [MQTT] Error details:', {
            errorMessage: error.message,
            errorCode: error.code,
            errorType: typeof error,
            topic: topic,
            payload: payload
          });
          
          // Enhanced error messages for 403/auth issues
          if (error.message && error.message.includes('403')) {
            reject(new Error('Authentication failed (403). The MQTT connection token may be expired. Please reconnect to the player.'));
          } else if (error.message && error.message.includes('Not authorized')) {
            reject(new Error('Not authorized to control this device. Please check player permissions.'));
          } else {
            reject(error);
          }
        } else {
          console.log(`✅ [MQTT] Published ambient light command successfully: r=${r}, g=${g}, b=${b}`);
          resolve();
        }
      });
    });
  }

  async turnOffAmbientLight(playerId) {
    // Turn off by setting all RGB values to 0
    return this.setAmbientLight(playerId, 0, 0, 0);
  }

  async setNightLight(playerId, enabled, brightness = 20) {
    if (!this.isConnected || !this.client) {
      throw new Error('MQTT client not connected');
    }

    // Use correct Yoto MQTT topic for night light command
    const topic = `device/${playerId}/command/night-light/${enabled ? 'enable' : 'disable'}`;
    const payload = enabled ? { brightness: brightness } : {};

    const message = JSON.stringify(payload);

    return new Promise((resolve, reject) => {
      this.client.publish(topic, message, { qos: 1 }, (error) => {
        if (error) {
          console.error('❌ [MQTT] Failed to publish night light command:', error);
          reject(error);
        } else {
          console.log(`🌙 [MQTT] Published night light command: enabled=${enabled}, brightness=${brightness}`);
          resolve();
        }
      });
    });
  }

  onConnectionStatusChange(callback) {
    this.connectionStatusCallback = callback;
  }

  updateConnectionStatus(status) {
    console.log('Connection status changed:', status);
    if (this.connectionStatusCallback) {
      this.connectionStatusCallback(status);
    }
  }

  disconnect() {
    if (this.client) {
      console.log('Disconnecting MQTT client');
      this.stopConnectionHealthMonitor();
      this.client.end();
      this.client = null;
      this.isConnected = false;
      this.lastConnectionTime = null;
      this.updateConnectionStatus('Disconnected');
    }
  }

  // Check if connection is healthy
  isConnectionHealthy() {
    const isHealthy = this.client && this.isConnected && this.client.connected;
    console.log('🏥 [MQTT] Connection health check:', {
      hasClient: !!this.client,
      isConnected: this.isConnected,
      clientConnected: this.client?.connected,
      overall: isHealthy,
      connectionAge: this.lastConnectionTime ? Date.now() - this.lastConnectionTime : 0
    });
    return isHealthy;
  }

  // Start connection health monitoring
  startConnectionHealthMonitor() {
    // Clear existing timer
    this.stopConnectionHealthMonitor();
    
    // Check connection health every 30 seconds
    this.connectionHealthTimer = setInterval(() => {
      if (!this.isConnectionHealthy()) {
        console.log('⚠️ [MQTT] Connection health check failed, connection may be stale');
        this.updateConnectionStatus('Connection Health Check Failed');
      } else {
        console.log('✅ [MQTT] Connection health check passed');
      }
    }, 30000); // 30 seconds
  }

  // Stop connection health monitoring
  stopConnectionHealthMonitor() {
    if (this.connectionHealthTimer) {
      clearInterval(this.connectionHealthTimer);
      this.connectionHealthTimer = null;
    }
  }

  // Helper method to get current token (you'll need to implement based on your auth system)
  async getCurrentToken() {
    // This should be implemented to get the current authentication token
    // For now, return null and let the calling code handle token passing
    console.log('⚠️ [MQTT] getCurrentToken not implemented, token should be passed from calling code');
    return null;
  }

  // Auto-reconnect if needed before performing actions
  async ensureConnection(playerId, token) {
    const MAX_CONNECTION_AGE = 8 * 60 * 1000; // 8 minutes
    const connectionAge = this.lastConnectionTime ? Date.now() - this.lastConnectionTime : Infinity;
    
    if (!this.isConnectionHealthy() || connectionAge > MAX_CONNECTION_AGE) {
      console.log('🔄 [MQTT] Connection needs refresh, reconnecting...');
      this.disconnect(); // Clean disconnect first
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      return await this.connect(playerId, token);
    }
    
    return true;
  }

  // Simple connection test without subscriptions
  async testBasicConnection(playerId, token) {
    console.log('🧪 [MQTT] Testing basic MQTT connection (no subscriptions)...');
    
    try {
      // Temporarily store current client
      const oldClient = this.client;
      const oldConnected = this.isConnected;
      
      // Reset state for test
      this.client = null;
      this.isConnected = false;
      
      const connected = await this.connect(playerId, token);
      
      if (connected && this.isConnectionHealthy()) {
        console.log('✅ [MQTT] Basic connection test successful');
        
        // Test a simple publish only
        const testTopic = `/test/connection`;
        const testMessage = JSON.stringify({ 
          test: true, 
          timestamp: Date.now(),
          playerId: playerId
        });
        
        return new Promise((resolve) => {
          this.client.publish(testTopic, testMessage, { qos: 0 }, (error) => {
            if (error) {
              console.error('❌ [MQTT] Test publish failed:', error);
              resolve(false);
            } else {
              console.log('✅ [MQTT] Test publish successful');
              resolve(true);
            }
          });
        });
      } else {
        console.log('❌ [MQTT] Basic connection test failed');
        return false;
      }
    } catch (error) {
      console.error('❌ [MQTT] Basic connection test error:', error);
      return false;
    }
  }
}
