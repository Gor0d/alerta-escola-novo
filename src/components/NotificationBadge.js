import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNotifications } from '../contexts/NotificationContext';

export const NotificationBadge = ({ style }) => {
  const { unreadCount } = useNotifications();

  if (unreadCount === 0) return null;

  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.badgeText}>
        {unreadCount > 99 ? '99+' : unreadCount}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

// ==========================================
// 3. NotificationScreen.js - Tela de notificações
// ==========================================

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';

export default function NotificationScreen({ navigation }) {
  const { notifications, unreadCount, fetchNotifications, markAsRead, respondToPickup } = useNotifications();
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = (notification) => {
    if (!notification.read_at) {
      markAsRead(notification.id);
    }

    // Se for professor e a notificação ainda está pendente, mostrar opções
    if (profile?.role === 'teacher' && notification.status === 'pending') {
      Alert.alert(
        'Responder Solicitação',
        `${notification.parent_profiles?.name} solicitou buscar ${notification.students?.name}`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Rejeitar',
            style: 'destructive',
            onPress: () => respondToPickup(notification.id, 'rejected')
          },
          {
            text: 'Autorizar',
            onPress: () => respondToPickup(notification.id, 'confirmed')
          }
        ]
      );
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 60) {
      return `${diffMinutes}min atrás`;
    } else if (diffHours < 24) {
      return `${diffHours}h atrás`;
    } else {
      return date.toLocaleDateString('pt-BR');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return { name: 'time-outline', color: '#f59e0b' };
      case 'confirmed': return { name: 'checkmark-circle', color: '#10b981' };
      case 'rejected': return { name: 'close-circle', color: '#ef4444' };
      default: return { name: 'help-circle-outline', color: '#6b7280' };
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Aguardando resposta';
      case 'confirmed': return 'Autorizada';
      case 'rejected': return 'Negada';
      default: return 'Desconhecido';
    }
  };

  const renderNotification = ({ item }) => {
    const statusIcon = getStatusIcon(item.status);
    const isUnread = !item.read_at;
    
    return (
      <TouchableOpacity
        style={[notificationStyles.notificationCard, isUnread && notificationStyles.unreadCard]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={notificationStyles.notificationHeader}>
          <View style={notificationStyles.iconContainer}>
            <Ionicons name="car" size={24} color="#4f46e5" />
          </View>
          
          <View style={notificationStyles.notificationContent}>
            <Text style={notificationStyles.notificationTitle}>
              Solicitação de Busca
            </Text>
            
            <Text style={notificationStyles.notificationText}>
              {profile?.role === 'teacher' 
                ? `${item.parent_profiles?.name} quer buscar ${item.students?.name}`
                : `Busca de ${item.students?.name}`
              }
            </Text>
            
            <Text style={notificationStyles.notificationTime}>
              {formatTime(item.created_at)}
            </Text>
          </View>
          
          <View style={notificationStyles.statusContainer}>
            <Ionicons 
              name={statusIcon.name} 
              size={20} 
              color={statusIcon.color} 
            />
            <Text style={[notificationStyles.statusText, { color: statusIcon.color }]}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>

        {item.reason && (
          <Text style={notificationStyles.reasonText}>
            Motivo: {item.reason}
          </Text>
        )}

        {isUnread && <View style={notificationStyles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={notificationStyles.container}>
      <View style={notificationStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={notificationStyles.headerTitle}>Notificações</Text>
        {unreadCount > 0 && (
          <View style={notificationStyles.headerBadge}>
            <Text style={notificationStyles.headerBadgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={notificationStyles.listContainer}
        ListEmptyComponent={
          <View style={notificationStyles.emptyState}>
            <Ionicons name="notifications-outline" size={64} color="#9ca3af" />
            <Text style={notificationStyles.emptyTitle}>Nenhuma notificação</Text>
            <Text style={notificationStyles.emptyText}>
              As notificações de busca aparecerão aqui
            </Text>
          </View>
        }
      />
    </View>
  );
}

const notificationStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4f46e5',
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 15,
  },
  headerBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  headerBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 20,
  },
  notificationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    position: 'relative',
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4f46e5',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ede9fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  notificationText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  reasonText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 8,
    paddingLeft: 60,
  },
  unreadDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6b7280',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
});