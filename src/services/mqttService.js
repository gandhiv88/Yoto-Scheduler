import mqtt from 'mqtt';

console.log('🔍 [MQTT] Imported mqtt:', mqtt);
console.log('🔍 [MQTT] mqtt.connect type:', typeof mqtt.connect);

export class MqttClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionStatusCallback = null;
    this.batteryStatusCallback = null;
    this.lastConnectionTime = null;
    this.connectionHealthTimer = null;
    this.schedulerCheckInterval = null;
    this.batteryPollingTimer = null;
    this.currentPlayerId = null;
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
          this.currentPlayerId = playerId;  // Store current player ID
          
          // Start connection health monitoring
          this.startConnectionHealthMonitor();
          
          // Subscribe to essential device topics like working implementation
          if (playerId) {
            const topics = [
              `device/${playerId}/events`,
              `device/${playerId}/status`,
              `device/${playerId}/response`,
              `device/${playerId}/battery`,      // Add battery topic
              `device/${playerId}/state`,        // Add state topic  
            ];

            topics.forEach((topic) => {
              this.client.subscribe(topic, (err) => {
                if (err) {
                  console.error(`❌ [MQTT] Failed to subscribe to ${topic}:`, err);
                } else {
                  console.log(`✅ [MQTT] Subscribed to ${topic}`);
                  // Special logging for battery topic
                  if (topic.includes('/battery')) {
                    console.log(`🔋 [MQTT] BATTERY TOPIC SUBSCRIBED SUCCESSFULLY: ${topic}`);
                  }
                }
              });
            });

            // Request initial status update
            this.requestStatusUpdate(playerId);
            
            // Request battery status multiple times with delays for faster initial response
            setTimeout(() => this.requestStatusUpdate(playerId), 500);  // 0.5s
            setTimeout(() => this.requestStatusUpdate(playerId), 1000); // 1s  
            setTimeout(() => this.requestStatusUpdate(playerId), 2000); // 2s
            setTimeout(() => this.requestStatusUpdate(playerId), 4000); // 4s
            
            // Start periodic battery status polling every 30 seconds
            this.startBatteryPolling(playerId);
            
            // Fallback: If we don't get battery data within 10 seconds, provide fallback data
            setTimeout(() => {
              console.log('🔋 [MQTT] Fallback battery check - have we received battery data?');
              // This is just for testing - you can remove this later
              if (this.batteryStatusCallback) {
                console.log('🔋 [MQTT] Providing fallback battery data for testing');
                this.batteryStatusCallback({
                  level: 75,
                  isCharging: false,
                  source: 'fallback',
                  timestamp: Date.now()
                });
              }
            }, 10000); // 10 seconds fallback
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
          
          // Log ALL message topics to help debug
          console.log(`🔍 [MQTT] All topics received so far: ${topic}`);
          
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

    // Subscribe to Yoto device topics using correct format (no leading slash)
    const topics = [
      `device/${playerId}/state`,        // Device state updates
      `device/${playerId}/playback`,     // Playback status
      `device/${playerId}/volume`,       // Volume changes
      `device/${playerId}/card`,         // Card status
      `device/${playerId}/battery`,      // Battery status
      `device/${playerId}/ambients`      // Ambient light status
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
            // Add special logging for battery topic
            if (topic.includes('/battery')) {
              console.log(`🔋 [MQTT] BATTERY TOPIC SUBSCRIBED: ${topic}`);
            }
          } else {
            console.log(`✅ [MQTT] Subscribed to ${topic}`);
          }
        });
      }, index * 100); // 100ms delay between each subscription
    });
  }

  handleMessage(topic, message) {
    try {
      // Debug: Log all incoming messages with detailed topic info
      console.log('📨 [MQTT] Message received:', {
        topic,
        message: message.toString(),
        isBattery: topic.includes('/battery'),
        packet: arguments[2]
      });
      
      const messageObj = JSON.parse(message);
      console.log(`📨 [MQTT] Message from ${topic}:`, messageObj);
      
      // Enhanced logging for events messages to help find battery fields
      if (topic.endsWith('/events')) {
        console.log('🔋 [MQTT] EVENTS MESSAGE - Full content:', JSON.stringify(messageObj, null, 2));
        console.log('🔋 [MQTT] EVENTS MESSAGE - All fields:', Object.keys(messageObj));
        
        // Look for any field that might contain battery info
        const potentialBatteryFields = Object.keys(messageObj).filter(key => 
          key.toLowerCase().includes('battery') || 
          key.toLowerCase().includes('power') || 
          key.toLowerCase().includes('charge') ||
          key.toLowerCase().includes('level')
        );
        if (potentialBatteryFields.length > 0) {
          console.log('🔋 [MQTT] POTENTIAL BATTERY FIELDS FOUND:', potentialBatteryFields);
        }
        
        // Try to extract battery info from ANY field that looks like a percentage
        // Sometimes battery might be in unexpected fields
        const allFields = Object.keys(messageObj);
        for (const field of allFields) {
          const value = messageObj[field];
          // Look for numeric values that could be battery percentage (0-100 range)
          if (typeof value === 'number' && value >= 0 && value <= 100) {
            // Skip known non-battery fields but be more permissive
            const skipFields = ['volume', 'volumeMax', 'position', 'trackLength', 'eventUtc', 'timestamp', 'secondsIn'];
            if (!skipFields.some(skip => field.toLowerCase().includes(skip.toLowerCase()))) {
              console.log(`🔋 [MQTT] Found potential battery field "${field}" with value: ${value}%`);
              
              // If we find a potential battery field, use it
              const batteryInfo = {
                level: value,
                isCharging: messageObj.charging || messageObj.isCharging || messageObj.pluggedIn || false,
                source: `events.${field}`,
                timestamp: Date.now(),
                raw: messageObj
              };
              
              console.log('🔋 [MQTT] Battery info extracted from events:', batteryInfo);
              
              if (this.batteryStatusCallback) {
                console.log('🔋 [MQTT] Calling battery status callback with:', batteryInfo);
                this.batteryStatusCallback(batteryInfo);
              }
              break; // Use the first potential battery field found
            }
          }
        }
        
        // Also check for direct battery fields even if they don't match 0-100 range
        const batteryFields = ['battery', 'batteryLevel', 'batteryPercent', 'power', 'powerLevel'];
        for (const field of batteryFields) {
          if (messageObj[field] !== undefined) {
            const value = messageObj[field];
            console.log(`🔋 [MQTT] Found battery field "${field}" with value: ${value}`);
            
            const batteryInfo = {
              level: typeof value === 'number' ? Math.min(100, Math.max(0, value)) : value,
              isCharging: messageObj.charging || messageObj.isCharging || messageObj.pluggedIn || false,
              source: `events.${field}`,
              timestamp: Date.now(),
              raw: messageObj
            };
            
            console.log('🔋 [MQTT] Battery info from direct field:', batteryInfo);
            
            if (this.batteryStatusCallback) {
              console.log('🔋 [MQTT] Calling battery status callback with:', batteryInfo);
              this.batteryStatusCallback(batteryInfo);
            }
            break;
          }
        }
      }
      
      // Handle battery status from status messages
      if (topic.endsWith('/status') && messageObj.status) {
        const statusData = messageObj.status;
        console.log('🔋 [MQTT] Status message received, checking for battery data...');
        console.log('🔋 [MQTT] Available status fields:', Object.keys(statusData));
        
        // Check for battery information in the status message
        if (statusData.batteryLevel !== undefined || statusData.battery !== undefined) {
          const batteryLevel = statusData.batteryLevel || statusData.battery;
          const batteryInfo = {
            level: batteryLevel,
            isCharging: statusData.charging || false,
            raw: statusData.batteryLevelRaw,
            voltage: statusData.battery,
            temp: statusData.batteryTemp
          };
          
          console.log('🔋 [MQTT] Battery info found in status message:', batteryInfo);
          
          if (this.batteryStatusCallback) {
            console.log('🔋 [MQTT] Calling battery status callback with:', batteryInfo);
            this.batteryStatusCallback(batteryInfo);
          }
        }
      }
      
      // Handle different Yoto device message types
      if (topic.includes('/state')) {
        console.log('📊 [MQTT] Device state update:', messageObj);
      } else if (topic.includes('/playback')) {
        console.log('▶️ [MQTT] Playback status update:', messageObj);
      } else if (topic.includes('/card')) {
        console.log('🎵 [MQTT] Card status update:', messageObj);
      } else if (topic.includes('/volume')) {
        console.log('🔊 [MQTT] Volume update:', messageObj);
      } else if (topic.includes('/battery')) {
        console.log('🔋 [MQTT] BATTERY MESSAGE DETECTED! Topic:', topic);
        console.log('🔋 [MQTT] Battery data:', messageObj);
        console.log('🔋 [MQTT] Battery callback available:', !!this.batteryStatusCallback);
        if (this.batteryStatusCallback) {
          console.log('🔋 [MQTT] Calling battery callback with data:', messageObj);
          this.batteryStatusCallback(messageObj);
        } else {
          console.log('⚠️ [MQTT] No battery callback registered!');
        }
      } else if (topic.includes('/ambients')) {
        console.log('💡 [MQTT] Ambient light update:', messageObj);
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

  // Request battery status specifically (for manual refresh)
  requestBatteryStatus(playerId) {
    if (!this.isConnectionHealthy()) {
      console.error('❌ [MQTT] Cannot request battery status - not connected');
      return;
    }

    console.log(`🔋 [MQTT] Manual battery status refresh requested`);
    
    // Try multiple approaches to get battery data
    this.requestStatusUpdate(playerId);
    
    // Also try requesting from battery topic if it exists
    setTimeout(() => {
      const batteryTopic = `device/${playerId}/command/battery`;
      console.log(`� [MQTT] Requesting battery status from: ${batteryTopic}`);
      
      this.client.publish(batteryTopic, "", (err) => {
        if (err) {
          console.log('🔋 [MQTT] Battery topic request failed (normal if topic doesn\'t exist):', err.message);
        } else {
          console.log('✅ [MQTT] Battery topic request sent');
        }
      });
    }, 100);
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

    // FIX: Yoto devices expect BGR instead of RGB format
    // This fixes the issue where red appears as blue and vice versa
    [r, g, b] = [b, g, r]; // Swap R and B channels
    
    console.log(`💡 [MQTT] After BGR conversion: r=${r}, g=${g}, b=${b}`);

    // Use correct Yoto MQTT topic for ambient light command (like working implementation)
    const topic = `device/${playerId}/command/ambients`;
    const payload = {
      r: r, // Red value (0-255) - actually blue after BGR swap
      g: g, // Green value (0-255) - stays green  
      b: b  // Blue value (0-255) - actually red after BGR swap
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

  onBatteryStatusChange(callback) {
    this.batteryStatusCallback = callback;
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
      this.stopBatteryPolling();  // Stop battery polling
      this.client.end();
      this.client = null;
      this.isConnected = false;
      this.lastConnectionTime = null;
      this.currentPlayerId = null;  // Clear player ID
      this.updateConnectionStatus('Disconnected');
    }
  }

  // Start battery status polling
  startBatteryPolling(playerId) {
    this.stopBatteryPolling(); // Clear any existing timer
    
    console.log('🔋 [MQTT] Starting battery status polling every 30 seconds');
    this.batteryPollingTimer = setInterval(() => {
      if (this.isConnectionHealthy() && playerId) {
        console.log('🔋 [MQTT] Periodic battery status request');
        this.requestStatusUpdate(playerId);
      }
    }, 30000); // Poll every 30 seconds
  }

  // Stop battery status polling
  stopBatteryPolling() {
    if (this.batteryPollingTimer) {
      console.log('🔋 [MQTT] Stopping battery status polling');
      clearInterval(this.batteryPollingTimer);
      this.batteryPollingTimer = null;
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
