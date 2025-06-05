// src/navigation/AppNavigator.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

// Screens
import OnboardingScreen from '../screens/OnboardingScreen';
import AuthScreen from '../screens/AuthScreen';
import ParentDashboard from '../screens/ParentDashboard';
import TeacherDashboard from '../screens/TeacherDashboard';
import ClassDetailsScreen from '../screens/ClassDetailsScreen';
import NotificationScreen from '../screens/NotificationScreen';
import NoticeBoardScreen from '../screens/NoticeBoardScreen';
import CanteenManagementScreen from '../screens/CanteenManagementScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import StartChatScreen from '../screens/StartChatScreen';

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
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Auth" component={AuthScreen} />
          </>
        ) : (
          <>
            {profile?.role === 'parent' && (
              <>
                <Stack.Screen name="ParentDashboard" component={ParentDashboard} />
                <Stack.Screen name="Notifications" component={NotificationScreen} />
                <Stack.Screen name="NoticeBoardScreen" component={NoticeBoardScreen} />
                <Stack.Screen name="CanteenManagementScreen" component={CanteenManagementScreen} />
                
                {/* ✅ Nomes corrigidos e padronizados */}
                <Stack.Screen name="ChatListScreen" component={ChatListScreen} />
                <Stack.Screen name="ChatScreen" component={ChatScreen} />
                <Stack.Screen name="StartChatScreen" component={StartChatScreen} />
              </>
            )}
            
            {profile?.role === 'teacher' && (
              <>
                <Stack.Screen name="TeacherDashboard" component={TeacherDashboard} />
                <Stack.Screen name="ClassDetails" component={ClassDetailsScreen} />
                <Stack.Screen name="Notifications" component={NotificationScreen} />
                <Stack.Screen name="NoticeBoardScreen" component={NoticeBoardScreen} />
                <Stack.Screen name="CanteenManagementScreen" component={CanteenManagementScreen} />
                
                {/* ✅ Nomes padronizados */}
                <Stack.Screen name="ChatListScreen" component={ChatListScreen} />
                <Stack.Screen name="ChatScreen" component={ChatScreen} />
                <Stack.Screen name="StartChatScreen" component={StartChatScreen} />
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