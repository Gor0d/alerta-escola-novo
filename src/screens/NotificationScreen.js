import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  StatusBar,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';

export default function NotificationScreen({ navigation }) {
  const { 
    notifications, 
    unreadCount, 
    fetchNotifications, 
    markAsRead, 
    respondToPickup, 
    clearAllNotifications, 
    markAllAsRead 
  } = useNotifications();
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = (notification) => {
    if (!notification.updated_at && !notification.confirmed_at && !notification.completed_at) {
      markAsRead(notification.id);
    }

    if (profile?.role === 'teacher' && notification.status === 'pending') {
      const parentName = notification.parent_profiles?.name || 'Responsável';
      const studentName = notification.students?.name || 'Aluno';
      
      Alert.alert(
        '🚗 Responder Solicitação',
        `${parentName} quer buscar ${studentName}\n\n${notification.reason ? `Motivo: ${notification.reason}` : ''}`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: '❌ Rejeitar',
            style: 'destructive',
            onPress: () => respondToPickup(notification.id, false, 'Negado pelo professor')
          },
          {
            text: '✅ Autorizar',
            onPress: () => respondToPickup(notification.id, true, 'Autorizado pelo professor')
          }
        ]
      );
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Limpar Notificações',
      'Remover todas as notificações?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar Tudo',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllNotifications();
              Alert.alert('Sucesso', 'Notificações removidas');
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível limpar');
            }
          },
        },
      ]
    );
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      Alert.alert('Sucesso', 'Todas marcadas como lidas');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível marcar');
    }
  };

  const showMenu = () => {
    const actions = [];
    
    if (unreadCount > 0) {
      actions.push({ text: 'Marcar todas como lidas', onPress: handleMarkAllRead });
    }
    
    if (notifications.length > 0) {
      actions.push({ text: 'Limpar todas', style: 'destructive', onPress: handleClearAll });
    }
    
    actions.push({ text: 'Cancelar', style: 'cancel' });
    
    Alert.alert('Ações', 'Escolha uma opção:', actions);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffMinutes < 1) return 'Agora mesmo';
    if (diffMinutes < 60) return `${diffMinutes}min atrás`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h atrás`;
    
    return date.toLocaleDateString('pt-BR');
  };

  const getStatusInfo = (notification) => {
    if (notification.confirmed_at) {
      return { icon: 'checkmark-circle', color: '#10b981', text: 'Autorizada', bgColor: '#ecfdf5' };
    } else if (notification.completed_at) {
      return { icon: 'close-circle', color: '#ef4444', text: 'Negada', bgColor: '#fef2f2' };
    } else {
      return { icon: 'time-outline', color: '#f59e0b', text: 'Pendente', bgColor: '#fffbeb' };
    }
  };

  const isUnread = (notification) => {
    return !notification.updated_at && !notification.confirmed_at && !notification.completed_at;
  };

  const renderNotification = ({ item }) => {
    const statusInfo = getStatusInfo(item);
    const unread = isUnread(item);
    
    return (
      <TouchableOpacity
        style={[styles.card, unread && styles.unreadCard]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.cardContent}>
          <View style={[styles.icon, { backgroundColor: statusInfo.bgColor }]}>
            <Ionicons name="car" size={24} color="#0066CC" />
          </View>
          
          <View style={styles.content}>
            <Text style={styles.title}>
              {profile?.role === 'teacher' ? 'Solicitação de Busca' : 'Notificação de Busca'}
            </Text>
            
            <Text style={styles.text}>
              {profile?.role === 'teacher' 
                ? `${item.parent_profiles?.name || 'Responsável'} quer buscar ${item.students?.name || 'aluno'}`
                : `Busca de ${item.students?.name || 'seu filho'}`
              }
            </Text>
            
            {item.reason && (
              <Text style={styles.reason}>Motivo: {item.reason}</Text>
            )}
            
            <Text style={styles.time}>{formatTime(item.created_at)}</Text>
          </View>
          
          <View style={styles.status}>
            <View style={[styles.statusIcon, { backgroundColor: statusInfo.bgColor }]}>
              <Ionicons name={statusInfo.icon} size={16} color={statusInfo.color} />
            </View>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.text}
            </Text>
          </View>
        </View>

        {unread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Status Bar - Mesma configuração do TeacherDashboard */}
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="#0066CC"
        translucent={false}
      />
      
      {/* Header responsivo com Safe Area - Igual ao TeacherDashboard */}
      <View style={[styles.header, { 
        paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 24) + 12 
      }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle}>Notificações</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          
          {notifications.length > 0 ? (
            <TouchableOpacity onPress={showMenu} style={styles.menuBtn}>
              <Ionicons name="ellipsis-vertical" size={20} color="white" />
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>
      </View>

      {/* Resumo de notificações - se houver */}
      {notifications.length > 0 && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            {unreadCount > 0 
              ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''} de ${notifications.length} total`
              : `${notifications.length} notificaç${notifications.length > 1 ? 'ões' : 'ão'} - todas lidas`
            }
          </Text>
        </View>
      )}

      {/* Lista */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#0066CC']}
          />
        }
        contentContainerStyle={[
          styles.list,
          notifications.length === 0 && styles.emptyList
        ]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-outline" size={64} color="#94A3B8" />
            <Text style={styles.emptyTitle}>Nenhuma notificação</Text>
            <Text style={styles.emptyText}>
              {profile?.role === 'teacher' 
                ? 'Solicitações de busca aparecerão aqui'
                : 'Suas notificações aparecerão aqui'
              }
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Botões flutuantes */}
      {notifications.length > 0 && (
        <View style={styles.floating}>
          {unreadCount > 0 && (
            <TouchableOpacity style={[styles.floatBtn, styles.readBtn]} onPress={handleMarkAllRead}>
              <Ionicons name="checkmark-done" size={20} color="white" />
              <Text style={styles.floatText}>Marcar lidas</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={[styles.floatBtn, styles.clearBtn]} onPress={handleClearAll}>
            <Ionicons name="trash-outline" size={20} color="white" />
            <Text style={styles.floatText}>Limpar todas</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  // Header responsivo - IGUAL ao TeacherDashboard
  header: {
    backgroundColor: '#0066CC',
    paddingBottom: 16,
    paddingHorizontal: 20,
    // Sombra para destacar do conteúdo
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    // Sombra para destaque
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 15,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
    // Garantir que o texto seja legível
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  placeholder: {
    width: 44,
    height: 44,
  },
  summaryBar: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  summaryText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  list: {
    padding: 20,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#0066CC',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  text: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  reason: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  time: {
    fontSize: 12,
    color: '#94A3B8',
  },
  status: {
    alignItems: 'center',
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  unreadDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#64748B',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  floating: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    gap: 10,
  },
  floatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  readBtn: {
    backgroundColor: '#10B981',
  },
  clearBtn: {
    backgroundColor: '#EF4444',
  },
  floatText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 14,
  },
});