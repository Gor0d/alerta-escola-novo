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
                {/* CORRIGIDO: Tela de notificações para pais - SEM header nativo */}
                <Stack.Screen 
                  name="Notifications" 
                  component={NotificationScreen}
                  options={{
                    headerShown: false  // ← CORREÇÃO: usar header customizado do componente
                  }}
                />
              </>
            )}
            {profile?.role === 'teacher' && (
              <>
                <Stack.Screen name="TeacherDashboard" component={TeacherDashboard} />
                <Stack.Screen name="ClassDetails" component={ClassDetailsScreen} />
                {/* CORRIGIDO: Tela de notificações para professores - SEM header nativo */}
                <Stack.Screen 
                  name="Notifications" 
                  component={NotificationScreen}
                  options={{
                    headerShown: false  // ← CORREÇÃO: usar header customizado do componente
                  }}
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