# Yoto Scheduler

A React Native Expo application for controlling and scheduling Yoto players via MQTT. This app provides direct control over Yoto devices and allows you to schedule audio card playback, eliminating the need to switch between multiple applications.

## Features

- **OAuth Authentication** - Secure login with Yoto's authentication system
- **Device Discovery** - Automatically finds and connects to available Yoto players
- **MQTT Control** - Real-time communication with Yoto devices for instant response
- **Card Management** - Browse and select from your available audio cards
- **Playback Control** - Play, pause, and stop functionality
- **Smart Scheduling** - Schedule audio card playback at specific times
- **Connection Monitoring** - Real-time connection status and error handling

## Technical Stack

- **React Native with Expo** - Cross-platform mobile development
- **MQTT over WebSocket** - Real-time communication with AWS IoT
- **TypeScript** - Type safety and better development experience
- **Expo SecureStore** - Secure storage for authentication tokens
- **OAuth 2.0** - Industry-standard authentication flow

## MQTT Architecture

The app uses MQTT over secure WebSocket (WSS) to communicate with Yoto's AWS IoT infrastructure:

- **Broker**: `aqrphjqbp3u2z-ats.iot.eu-west-2.amazonaws.com:443`
- **Protocol**: WebSocket Secure (WSS) with MQTT v4
- **Authentication**: JWT-based custom authorizer
- **Topics**: Player-specific topics for commands and status updates

## Project Structure

```
src/
├── services/
│   ├── mqttService.js      # MQTT client and connection management
│   ├── authService.js      # OAuth authentication flow
│   └── apiService.js       # Yoto API integration
├── types/
│   └── index.ts           # TypeScript type definitions
└── App.tsx                # Main application component
```

## Setup and Installation

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Authentication**:
   - Update `CLIENT_ID` in `src/services/authService.js` with your Yoto OAuth client ID
   - Configure OAuth endpoints if they differ from defaults

3. **Run the App**:
   ```bash
   npx expo start
   ```

## Development Notes

This project was created as an alternative to a Flutter implementation that experienced MQTT connectivity issues. The JavaScript/React Native MQTT client has proven to be more reliable with Yoto's infrastructure.

### Key Implementation Details

- Uses `react-native-mqtt` library for MQTT connectivity
- Implements proper error handling and connection retry logic
- Includes mock data for testing when API endpoints are unavailable
- Follows React Native best practices for cross-platform compatibility

### Testing

The app includes both real API integration and mock data fallbacks, allowing for testing even when Yoto services are unavailable.

## Future Enhancements

- **Advanced Scheduling** - Multiple schedules, recurring patterns, and conditional triggers
- **Multi-Player Support** - Control multiple Yoto devices simultaneously
- **Playlist Management** - Create and manage custom playlists
- **Voice Control** - Integration with device voice assistants
- **Enhanced UI** - Improved user interface with animations and better UX

## Contributing

This project demonstrates a working MQTT implementation for Yoto player control and scheduling. Contributions are welcome, especially for:

- UI/UX improvements
- Additional player controls
- Better error handling and user feedback
- Performance optimizations

## License

This project is for educational and personal use. Please respect Yoto's terms of service and API usage guidelines.
