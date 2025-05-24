import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { theme } from '../styles/theme';

export default function LoadingSpinner({ 
  size = 'large', 
  color = theme.colors.primary, 
  text = 'Carregando...',
  style 
}) {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={color} />
      {text && <Text style={styles.text}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  text: {
    marginTop: theme.spacing.md,
    color: theme.colors.text.secondary,
    fontSize: 16,
  },
});