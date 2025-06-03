import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNotifications } from '../contexts/NotificationContext';

export const NotificationBadge = ({ style, size = 'normal' }) => {
  const { unreadCount } = useNotifications();

  // Não renderizar nada se não houver notificações
  if (!unreadCount || unreadCount === 0) return null;

  const badgeSize = size === 'small' ? styles.badgeSmall : styles.badge;
  const textSize = size === 'small' ? styles.badgeTextSmall : styles.badgeText;

  return (
    <View style={[badgeSize, style]}>
      <Text style={textSize}>
        {unreadCount > 99 ? '99+' : String(unreadCount)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  badgeSmall: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'white',
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  badgeTextSmall: {
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default NotificationBadge;