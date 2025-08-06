import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const AuthWebViewTest: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>WebView Test Component Loaded Successfully!</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  text: {
    fontSize: 18,
    color: '#333',
  },
});
