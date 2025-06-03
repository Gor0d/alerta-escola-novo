import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/contexts/AuthContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import ErrorBoundary from './src/components/ErrorBoundary'; // NOVO
import AppNavigator from './src/navigation/AppNavigator';
import 'react-native-url-polyfill/auto';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <AppNavigator />
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}