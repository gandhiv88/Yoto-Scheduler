# Copilot Instructions for Yoto MQTT React Native App

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Context
This is a React Native Expo app for controlling Yoto players via MQTT. The app integrates with Yoto's official API and MQTT broker for real-time device control.

## Key Technologies
- **React Native Expo** - Cross-platform mobile development
- **MQTT Client** - Real-time communication with Yoto devices
- **OAuth 2.0** - Yoto authentication flow
- **AWS IoT WebSocket** - MQTT over secure WebSocket connection

## MQTT Connection Details
- **Broker**: `aqrphjqbp3u2z-ats.iot.eu-west-2.amazonaws.com:443`
- **Protocol**: WebSocket Secure (WSS) with MQTT
- **Auth**: Custom JWT authorizer with player-specific username format
- **Client ID Format**: `SAMPLE{playerId}`
- **Username Format**: `{playerId}?x-amz-customauthorizer-name=PublicJWTAuthorizer`

## Code Style Preferences
- Use functional components with hooks
- Implement proper error handling for network operations
- Follow React Native best practices for cross-platform compatibility
- Use TypeScript for type safety where beneficial
- Implement proper loading states and user feedback

## Key Features to Implement
1. **Authentication** - OAuth flow with Yoto servers
2. **Device Discovery** - Fetch and display available Yoto players
3. **Card Management** - Browse and select audio cards
4. **MQTT Control** - Real-time play/pause/stop functionality
5. **Connection Testing** - Debug tools for MQTT connectivity
6. **Scheduling** - Time-based card playback scheduling

## Security Considerations
- Store authentication tokens securely using Expo SecureStore
- Validate all MQTT messages and API responses
- Implement proper session management and token refresh
- Handle network connectivity gracefully
