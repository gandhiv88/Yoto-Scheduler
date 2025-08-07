# Yoto Scheduler 🎵

A comprehensive React Native Expo application for controlling and scheduling Yoto players via MQTT. This app transforms your mobile device into a powerful remote control and scheduler for your Yoto players, providing seamless audio card management and playback automation.

## 🎯 What This App Does

Yoto Scheduler bridges the gap between your Yoto players and modern scheduling needs. Instead of manually inserting cards and managing playback, this app provides:

- **Remote Control** - Control your Yoto players from anywhere in your home
- **Smart Scheduling** - Schedule audio cards to play at specific times automatically
- **Real-time Feedback** - See battery status, connection health, and playback state
- **Ambient Light Control** - Control the RGB ambient lights on your Yoto players
- **Multiple Player Support** - Manage multiple Yoto players from one app
- **Offline-First Design** - Works even when internet connectivity is intermittent

## ✨ Key Features

### 🔐 **Secure Authentication**
- OAuth 2.0 integration with Yoto's official authentication system
- Secure token storage using Expo SecureStore
- Automatic token refresh and session management

### 🎮 **Device Control**
- Real-time MQTT communication with AWS IoT infrastructure
- Play, pause, resume, and stop audio card playback
- Volume control and ambient light management
- Battery monitoring and connection diagnostics

### 📅 **Advanced Scheduling**
- Schedule audio cards to play at specific times
- Persistent scheduling that survives app restarts
- Visual schedule management with easy editing
- Background scheduling execution

### 🔄 **Real-time Monitoring**
- Live connection status updates
- Battery level monitoring with charging status
- Connection health checks and automatic reconnection
- Detailed logging for troubleshooting

### 🌈 **Ambient Light Control**
- Full RGB color control for Yoto player ambient lights
- Brightness adjustment with color temperature
- Pre-set color schemes and custom color picker
- Night light mode for bedtime routinesler

A React Native Expo application for controlling and scheduling Yoto players via MQTT. This app provides direct control over Yoto devices and allows you to schedule audio card playback, eliminating the need to switch between multiple applications.

## Features

- **OAuth Authentication** - Secure login with Yoto's authentication system
- **Device Discovery** - Automatically finds and connects to available Yoto players
- **MQTT Control** - Real-time communication with Yoto devices for instant response
- **Card Management** - Browse and select from your available audio cards
- **Playback Control** - Play, pause, and stop functionality
- **Smart Scheduling** - Schedule audio card playback at specific times
- **Connection Monitoring** - Real-time connection status and error handling

## 🛠 Technical Stack

- **React Native with Expo SDK 53** - Cross-platform mobile development framework
- **MQTT over WebSocket** - Real-time bidirectional communication with AWS IoT
- **TypeScript** - Type safety and enhanced developer experience
- **Expo SecureStore** - Encrypted storage for authentication tokens
- **OAuth 2.0 with PKCE** - Secure authentication flow
- **AsyncStorage** - Persistent storage for app data and schedules
- **React Hooks** - Modern state management and lifecycle handling

## 📡 MQTT Architecture

The app uses a sophisticated MQTT implementation over secure WebSocket connection:

- **Broker**: `aqrphjqbp3u2z-ats.iot.eu-west-2.amazonaws.com:443`
- **Protocol**: WebSocket Secure (WSS) with MQTT v4
- **Authentication**: JWT-based AWS IoT custom authorizer
- **Client ID Format**: `SAMPLE{playerId}` for compatibility
- **Topics**: Device-specific command and status topics
- **QoS**: Quality of Service level 1 for reliable delivery
- **Connection Management**: Automatic reconnection with exponential backoff

## 📁 Project Architecture

```
src/
├── components/           # Reusable UI components
│   ├── AmbientLightControl.tsx    # RGB light control interface
│   ├── BatteryStatus.js           # Battery monitoring display
│   ├── ErrorBoundary.tsx          # Error handling wrapper
│   ├── SchedulerScreen.js         # Scheduling management UI
│   └── SnackBar.js               # User notifications
├── services/            # Core business logic
│   ├── mqttService.js            # MQTT client and connection management
│   ├── authService.js            # OAuth authentication flow
│   ├── apiService.js             # Yoto API integration
│   └── simpleSchedulerService.js # Scheduling engine
├── config/             # Configuration management
│   └── env.js                    # Environment variables and settings
├── contexts/           # React context providers
│   └── SnackBarContext.tsx       # Global notification system
├── hooks/              # Custom React hooks
│   ├── usePlayerConnection.js     # MQTT connection management
│   └── useScheduler.js           # Scheduling logic
├── types/              # TypeScript type definitions
│   └── index.ts                  # App-wide type definitions
└── utils/              # Utility functions
    └── tokenUtils.js             # Token management helpers
```

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or newer) - [Download here](https://nodejs.org/)
- **npm** or **yarn** - Package manager
- **Expo CLI** - `npm install -g @expo/cli`
- **Git** - For version control

### 📱 Development Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/gandhiv88/Yoto-Scheduler.git
   cd yoto_app_scheduler_js
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment** (Optional):
   Create a `.env` file for custom configuration:
   ```env
   YOTO_CLIENT_ID=your_custom_client_id
   YOTO_REDIRECT_URI=your_custom_redirect_uri
   LOG_LEVEL=debug
   ```

4. **Start Development Server**:
   ```bash
   npx expo start
   ```

## 📱 Running on Devices

### 🍎 **iOS Deployment**

#### **Method 1: Expo Go (Fastest for Development)**
1. Install **Expo Go** from the App Store
2. Run `npx expo start` in your terminal
3. Scan the QR code with your iPhone camera or Expo Go app
4. The app will load directly on your device

#### **Method 2: iOS Simulator**
1. Install Xcode from the Mac App Store
2. Run `npx expo start`
3. Press `i` to open in iOS Simulator
4. Select your preferred iPhone model

#### **Method 3: Production Build**
1. Install EAS CLI: `npm install -g eas-cli`
2. Configure EAS: `eas build:configure`
3. Build for iOS: `eas build --platform ios`
4. Install the `.ipa` file via TestFlight or direct installation

### 🤖 **Android Deployment**

#### **Method 1: Expo Go (Fastest for Development)**
1. Install **Expo Go** from Google Play Store
2. Run `npx expo start` in your terminal
3. Scan the QR code with the Expo Go app
4. The app will load directly on your device

#### **Method 2: Android Studio Emulator**
1. Install Android Studio
2. Set up an Android Virtual Device (AVD)
3. Run `npx expo start`
4. Press `a` to open in Android Emulator

#### **Method 3: Direct APK Installation**
1. Build APK: `eas build --platform android --profile preview`
2. Download the `.apk` file
3. Enable "Install from Unknown Sources" on your Android device
4. Install the APK directly

#### **Method 4: Production Build**
1. Build AAB: `eas build --platform android`
2. Upload to Google Play Console for distribution

### 🔧 **Development Tips**

- **USB Debugging**: Enable USB debugging on Android for faster development
- **Metro Bundler**: The development server runs on `http://localhost:8081`
- **Hot Reloading**: Changes to code will automatically refresh the app
- **Device Logs**: Use `npx expo logs` to view device logs in real-time

## 🎮 How to Use the App

### **First Time Setup**
1. **Login**: Tap "Login" to authenticate with your Yoto account
2. **Select Player**: Choose your Yoto player from the discovered devices
3. **Grant Permissions**: Allow the app to control your player

### **Basic Controls**
- **Play a Card**: Browse your library and tap any card to start playback
- **Playback Control**: Use play/pause/stop buttons for immediate control
- **Ambient Lights**: Adjust colors and brightness with the light control panel
- **Battery Monitor**: Check battery level and charging status in real-time

### **Scheduling Audio Cards**
1. **Open Scheduler**: Tap the "Schedule" tab
2. **Add Schedule**: Tap "+" to create a new scheduled playback
3. **Select Card**: Choose which audio card to play
4. **Set Time**: Pick the time for automatic playback
5. **Save**: Your schedule runs automatically even when the app is closed

### **Advanced Features**
- **Multiple Players**: Switch between different Yoto players
- **Connection Diagnostics**: Monitor MQTT connection health
- **Error Recovery**: Automatic reconnection and error handling

## 🔧 Configuration

### **Environment Variables**
The app supports customization through environment variables:

```javascript
// src/config/env.js
const ENV_CONFIG = {
  YOTO_CLIENT_ID: 'your_client_id',
  YOTO_REDIRECT_URI: 'your_redirect_uri',
  MQTT_BROKER: 'aqrphjqbp3u2z-ats.iot.eu-west-2.amazonaws.com',
  LOG_LEVEL: 'debug' // 'error', 'warn', 'info', 'debug'
};
```

### **OAuth Configuration**
If you need custom OAuth settings, update `app.config.js`:

```javascript
extra: {
  yotoClientId: process.env.YOTO_CLIENT_ID || "default_client_id",
  yotoRedirectUri: process.env.YOTO_REDIRECT_URI || "default_redirect_uri",
}
```

## 🚧 Troubleshooting

### **Common Issues**

#### **"Failed to Connect to Player"**
- Ensure your Yoto player is online and connected to WiFi
- Check that you're on the same network as your player
- Try refreshing the player list

#### **"Authentication Failed"**
- Clear app data and login again
- Ensure you're using the correct Yoto account credentials
- Check internet connectivity

#### **"MQTT Connection Timeout"**
- Verify network connectivity
- Check firewall settings (port 443 must be open)
- Ensure WebSocket connections are allowed

#### **Scheduling Not Working**
- Verify the app has background permissions
- Check that your device's clock is accurate
- Ensure the scheduled time is in the future

### **Debug Information**
Enable debug logging by setting `LOG_LEVEL: 'debug'` in `src/config/env.js` for detailed console output.

## 🔄 Development Notes

This project addresses connectivity issues found in Flutter-based MQTT implementations for Yoto players. The JavaScript/React Native MQTT client provides superior reliability with Yoto's AWS IoT infrastructure.

### **Key Technical Achievements**
- **Stable MQTT Connection**: Reliable WebSocket-based MQTT with proper error handling
- **Battery Optimization**: Efficient polling and connection management
- **Cross-Platform Compatibility**: Single codebase for iOS and Android
- **Production-Ready**: Error boundaries, proper logging, and graceful degradation

### **Security Considerations**
- OAuth 2.0 with PKCE for secure authentication
- Encrypted token storage using Expo SecureStore
- Environment-based configuration for sensitive data
- Proper certificate validation for MQTT connections

## 🎯 Future Enhancements

### **Planned Features**
- **🔮 Advanced Scheduling**: Recurring schedules, conditional triggers, and time zone support
- **👥 Multi-User Support**: Family accounts with individual preferences
- **🎵 Playlist Management**: Create and manage custom audio card playlists
- **🗣 Voice Control**: Integration with Siri/Google Assistant
- **📊 Usage Analytics**: Playback history and usage statistics
- **🌙 Sleep Timer**: Automatic stop after specified duration
- **🔔 Smart Notifications**: Playback notifications and schedule reminders

### **Technical Improvements**
- **Offline Mode**: Enhanced offline functionality with sync
- **Performance**: Optimized rendering and memory usage
- **UI/UX**: Material Design 3 and iOS design system compliance
- **Testing**: Comprehensive unit and integration test coverage

## 👥 Contributing

We welcome contributions from the community! Here's how you can help:

### **Getting Started**
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

### **Areas for Contribution**
- **🎨 UI/UX Improvements**: Better designs and user experience
- **🐛 Bug Fixes**: Issue resolution and stability improvements  
- **📚 Documentation**: Code documentation and user guides
- **🧪 Testing**: Unit tests, integration tests, and test automation
- **♿ Accessibility**: Screen reader support and accessibility features
- **🌍 Internationalization**: Multi-language support

### **Development Guidelines**
- Follow React Native best practices
- Maintain TypeScript type safety
- Write meaningful commit messages
- Update documentation for new features
- Test on both iOS and Android platforms

## 👨‍💻 Author

**Gandhi Valliappan**
- **GitHub**: [@gandhiv88](https://github.com/gandhiv88)
- **Project Repository**: [Yoto-Scheduler](https://github.com/gandhiv88/Yoto-Scheduler)
- **LinkedIn**: [Gandhi Valliappan](https://linkedin.com/in/gandhiv88)

### **About the Developer**
Gandhi is a passionate mobile developer specializing in React Native and cross-platform applications. This project was born from the need for a reliable Yoto player control solution that addresses real-world connectivity challenges faced by families using Yoto devices.

**Expertise Areas:**
- React Native & Expo Development
- MQTT & IoT Device Communication  
- OAuth & Secure Authentication
- Cross-Platform Mobile Development
- AWS IoT & Cloud Integration

## 📄 License & Legal

### **License**
This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### **Disclaimer**
This application is an **unofficial** third-party client for Yoto players. It is not affiliated with, endorsed by, or sponsored by Yoto. 

- **Educational Purpose**: This project is primarily for educational and personal use
- **API Usage**: Please respect Yoto's terms of service and API usage guidelines  
- **No Warranty**: The software is provided "as is" without warranty of any kind
- **User Responsibility**: Users are responsible for complying with all applicable terms of service

### **Yoto Trademark**
Yoto® is a registered trademark of Yoto Ltd. This project uses the Yoto name and references for identification purposes only.

## 🙏 Acknowledgments

- **Yoto Team**: For creating amazing products that inspire creative solutions
- **Expo Team**: For the excellent React Native development platform
- **MQTT.js Contributors**: For the reliable MQTT client library
- **React Native Community**: For the extensive ecosystem and support
- **Open Source Community**: For the tools and libraries that make this project possible

---

## 📊 Project Stats

![GitHub stars](https://img.shields.io/github/stars/gandhiv88/Yoto-Scheduler?style=social)
![GitHub forks](https://img.shields.io/github/forks/gandhiv88/Yoto-Scheduler?style=social)
![GitHub issues](https://img.shields.io/github/issues/gandhiv88/Yoto-Scheduler)
![GitHub license](https://img.shields.io/github/license/gandhiv88/Yoto-Scheduler)

**Made with ❤️ for the Yoto community**
