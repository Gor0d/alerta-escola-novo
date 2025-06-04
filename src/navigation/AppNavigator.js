// src/navigation/AppNavigator.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

// Screens existentes
import OnboardingScreen from '../screens/OnboardingScreen';
import AuthScreen from '../screens/AuthScreen';
import ParentDashboard from '../screens/ParentDashboard';
import TeacherDashboard from '../screens/TeacherDashboard';
import ClassDetailsScreen from '../screens/ClassDetailsScreen';
import NotificationScreen from '../screens/NotificationScreen';

// Novas screens
import NoticeBoardScreen from '../screens/NoticeBoardScreen';
import CanteenManagementScreen from '../screens/CanteenManagementScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // Stack de autenticação
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Auth" component={AuthScreen} />
          </>
        ) : (
          // Stack principal baseado no role do usuário
          <>
            {profile?.role === 'parent' && (
              <>
                <Stack.Screen name="ParentDashboard" component={ParentDashboard} />
                <Stack.Screen 
                  name="Notifications" 
                  component={NotificationScreen}
                  options={{ headerShown: false }}
                />
                {/* Novas telas para pais */}
                <Stack.Screen 
                  name="NoticeBoardScreen" 
                  component={NoticeBoardScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen 
                  name="CanteenManagementScreen" 
                  component={CanteenManagementScreen}
                  options={{ headerShown: false }}
                />
              </>
            )}
            {profile?.role === 'teacher' && (
              <>
                <Stack.Screen name="TeacherDashboard" component={TeacherDashboard} />
                <Stack.Screen name="ClassDetails" component={ClassDetailsScreen} />
                <Stack.Screen 
                  name="Notifications" 
                  component={NotificationScreen}
                  options={{ headerShown: false }}
                />
                {/* Novas telas para professores */}
                <Stack.Screen 
                  name="NoticeBoardScreen" 
                  component={NoticeBoardScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen 
                  name="CanteenManagementScreen" 
                  component={CanteenManagementScreen}
                  options={{ headerShown: false }}
                />
              </>
            )}
            {!profile?.role && (
              <Stack.Screen name="Auth" component={AuthScreen} />
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}