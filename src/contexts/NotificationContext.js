import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert, AppState } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
// ADICIONAR ESTE IMPORT:
import notificationService from '../services/NotificationService';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications deve ser usado dentro de NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user, profile } = useAuth();
  
  // Estados existentes (pickup notifications)
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // NOVOS ESTADOS (push notifications)
  const [pushNotifications, setPushNotifications] = useState([]);
  const [pushUnreadCount, setPushUnreadCount] = useState(0);
  const [pushInitialized, setPushInitialized] = useState(false);

  // ========================================
  // INICIALIZAÇÃO DO PUSH NOTIFICATIONS
  // ========================================
  useEffect(() => {
    if (user && !pushInitialized) {
      initializePushNotifications();
    }
  }, [user, pushInitialized]);

  // Listener para mudanças no estado do app
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  const initializePushNotifications = async () => {
    try {
      console.log('🔔 Inicializando Push Notifications...');
      
      // Inicializar serviço de notificações push
      const token = await notificationService.initialize();
      
      if (token) {
        console.log('✅ Push Notifications inicializadas com sucesso');
        
        // Enviar notificação de boas-vindas (apenas uma vez)
        setTimeout(() => {
          notificationService.sendLocalNotification(
            'Centro Educacional Universo do Saber',
            `Olá ${profile?.name}! Sistema de notificações ativado! 🎉📱`,
            { type: 'system', welcome: true }
          );
        }, 2000);
      }
      
      // Carregar histórico de push notifications
      await fetchPushNotifications();
      
      // Configurar subscription para novas push notifications
      setupPushNotificationSubscription();
      
      setPushInitialized(true);
    } catch (error) {
      console.error('❌ Erro ao inicializar Push Notifications:', error);
    }
  };

  const fetchPushNotifications = async () => {
    try {
      const data = await notificationService.getNotificationHistory();
      setPushNotifications(data);
      
      // Contar não lidas
      const unread = data.filter(n => !n.read).length;
      setPushUnreadCount(unread);
      
      console.log(`📨 ${data.length} push notifications carregadas (${unread} não lidas)`);
    } catch (error) {
      console.error('❌ Erro ao buscar push notifications:', error);
    }
  };

  const setupPushNotificationSubscription = () => {
    if (!user) return;

    const subscription = supabase
      .channel('push-notifications-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('📨 Nova push notification via real-time:', payload.new);
          setPushNotifications(prev => [payload.new, ...prev]);
          setPushUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => subscription.unsubscribe();
  };

  const handleAppStateChange = (nextAppState) => {
    if (nextAppState === 'active' && user) {
      console.log('📱 App ativo - atualizando notificações');
      fetchNotifications(); // Pickup notifications
      fetchPushNotifications(); // Push notifications
    }
  };

  // ========================================
  // FUNÇÕES EXISTENTES (pickup notifications)
  // ========================================
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    console.log(`🔔 Iniciando notificações para ${profile?.role}: ${profile?.name}`);
    fetchNotifications();

    // Real-time subscription simplificado
    let channel = null;
    
    if (user && profile) {
      channel = supabase
        .channel(`notifications_${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pickup_notifications' }, (payload) => {
          console.log('📡 Real-time update:', payload);
          fetchNotifications(); // Recarrega tudo para simplicidade
        })
        .subscribe((status) => {
          console.log(`📡 Subscription status: ${status}`);
        });
    }

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [user, profile]);

  const fetchNotifications = async () => {
    if (!user || !profile) return;

    try {
      console.log(`📥 Buscando notificações para ${profile.role}...`);
      
      let query = supabase
        .from('pickup_notifications')
        .select(`
          *,
          students(name),
          parent_profiles:profiles!pickup_notifications_parent_id_fkey(name),
          teacher_profiles:profiles!pickup_notifications_teacher_id_fkey(name)
        `)
        .order('created_at', { ascending: false });

      // Filtrar por papel do usuário (simplificado)
      if (profile.role === 'teacher') {
        query = query.eq('teacher_id', user.id);
      } else if (profile.role === 'parent') {
        query = query.eq('parent_id', user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Erro ao buscar notificações:', error);
        return;
      }

      console.log(`✅ ${data?.length || 0} notificações carregadas`);
      setNotifications(data || []);
      
      // Contar não lidas
      const unread = data?.filter(n => !n.updated_at && !n.confirmed_at && !n.completed_at).length || 0;
      setUnreadCount(unread);
      console.log(`📬 ${unread} notificações não lidas`);

    } catch (error) {
      console.error('❌ Erro ao buscar notificações:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      console.log(`📖 Marcando como lida: ${notificationId}`);
      
      const { error } = await supabase
        .from('pickup_notifications')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      // Atualizar estado local
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, updated_at: new Date().toISOString() } : n)
      );
      
      setUnreadCount(prev => Math.max(0, prev - 1));
      console.log('✅ Marcada como lida');

    } catch (error) {
      console.error('❌ Erro ao marcar como lida:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      console.log('📖 Marcando TODAS como lidas...');
      
      let query = supabase
        .from('pickup_notifications')
        .update({ updated_at: new Date().toISOString() })
        .is('updated_at', null);

      // Filtrar por usuário
      if (profile?.role === 'teacher') {
        query = query.eq('teacher_id', user.id);
      } else if (profile?.role === 'parent') {
        query = query.eq('parent_id', user.id);
      }

      const { error } = await query;
      if (error) throw error;

      // Atualizar estado local
      setNotifications(prev => 
        prev.map(notification => ({
          ...notification,
          updated_at: notification.updated_at || new Date().toISOString()
        }))
      );

      setUnreadCount(0);
      console.log('✅ TODAS marcadas como lidas');

    } catch (error) {
      console.error('❌ Erro ao marcar todas como lidas:', error);
      throw new Error('Não foi possível marcar as notificações como lidas');
    }
  };

  const clearAllNotifications = async () => {
    try {
      console.log('🗑️ Removendo TODAS as notificações...');
      
      let query = supabase.from('pickup_notifications').delete();

      // Filtrar por usuário
      if (profile?.role === 'teacher') {
        query = query.eq('teacher_id', user.id);
      } else if (profile?.role === 'parent') {
        query = query.eq('parent_id', user.id);
      }

      const { error } = await query;
      if (error) throw error;

      // Limpar estado local
      setNotifications([]);
      setUnreadCount(0);
      console.log('✅ TODAS as notificações removidas');

    } catch (error) {
      console.error('❌ Erro ao limpar notificações:', error);
      throw new Error('Não foi possível limpar as notificações');
    }
  };

  const respondToPickup = async (notificationId, isConfirmed, notes = '') => {
    try {
      console.log(`📝 Respondendo: ${isConfirmed ? 'AUTORIZAR' : 'REJEITAR'}`);
      
      const updateData = {
        status: isConfirmed ? 'confirmed' : 'rejected',
        updated_at: new Date().toISOString(),
        notes: notes
      };

      if (isConfirmed) {
        updateData.confirmed_at = new Date().toISOString();
      } else {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('pickup_notifications')
        .update(updateData)
        .eq('id', notificationId);

      if (error) throw error;

      // Atualizar localmente
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, ...updateData } : n)
      );

      Alert.alert(
        'Resposta Enviada! 📱',
        isConfirmed 
          ? 'Busca autorizada! O responsável foi notificado.'
          : 'Busca negada. O responsável foi notificado.'
      );

    } catch (error) {
      console.error('❌ Erro ao responder:', error);
      Alert.alert('Erro', 'Não foi possível enviar a resposta');
    }
  };

  const sendPickupNotification = async (studentId, teacherId, reason = 'Busca solicitada') => {
    try {
      console.log('📤 Enviando nova notificação...');
      
      const notificationData = {
        student_id: studentId,
        parent_id: user.id,
        teacher_id: teacherId,
        pickup_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // +1 hora
        reason: reason,
        status: 'pending'
      };

      const { data, error } = await supabase
        .from('pickup_notifications')
        .insert(notificationData)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Notificação enviada:', data);
      
      // Recarregar notificações
      fetchNotifications();
      
      return true;

    } catch (error) {
      console.error('❌ Erro ao enviar:', error);
      throw error;
    }
  };

  // Função de teste para criar notificações rapidamente
  const createTestNotification = async () => {
    try {
      // Buscar IDs disponíveis
      const { data: students } = await supabase.from('students').select('id').limit(1);
      const { data: teachers } = await supabase.from('profiles').select('id').eq('role', 'teacher').limit(1);
      
      if (students?.length && teachers?.length) {
        await sendPickupNotification(
          students[0].id,
          teachers[0].id,
          'Notificação de teste criada automaticamente'
        );
        Alert.alert('Sucesso', 'Notificação de teste criada!');
      } else {
        Alert.alert('Erro', 'Não foi possível encontrar estudantes ou professores');
      }
    } catch (error) {
      console.error('❌ Erro no teste:', error);
      Alert.alert('Erro', 'Falha ao criar notificação de teste');
    }
  };

  // ========================================
  // NOVAS FUNÇÕES (push notifications)
  // ========================================
  const markPushAsRead = async (notificationId) => {
    try {
      await notificationService.markNotificationAsRead(notificationId);
      
      setPushNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, read: true, read_at: new Date().toISOString() }
            : notification
        )
      );
      
      setPushUnreadCount(prev => Math.max(0, prev - 1));
      console.log('✅ Push notification marcada como lida:', notificationId);
    } catch (error) {
      console.error('❌ Erro ao marcar push notification como lida:', error);
    }
  };

  const markAllPushAsRead = async () => {
    try {
      if (!user) return;
      
      // Marcar todas como lidas no banco
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;
      
      // Atualizar estado local
      setPushNotifications(prev =>
        prev.map(notification => ({
          ...notification,
          read: true,
          read_at: new Date().toISOString()
        }))
      );
      
      setPushUnreadCount(0);
      await notificationService.clearBadge();
      
      console.log('✅ Todas as push notifications marcadas como lidas');
    } catch (error) {
      console.error('❌ Erro ao marcar todas push notifications como lidas:', error);
    }
  };

  const sendTestPushNotification = async () => {
    try {
      await notificationService.sendLocalNotification(
        'Teste - Universo do Saber',
        `Olá ${profile?.name}! Esta é uma notificação de teste! Sistema funcionando perfeitamente. 🎉`,
        { type: 'test', timestamp: new Date().toISOString() }
      );
      console.log('🧪 Push notification de teste enviada');
    } catch (error) {
      console.error('❌ Erro ao enviar push notification de teste:', error);
    }
  };

  // Cleanup quando usuário faz logout
  useEffect(() => {
    if (!user && pushInitialized) {
      console.log('👋 Usuário fez logout - limpando push notifications');
      setPushNotifications([]);
      setPushUnreadCount(0);
      setPushInitialized(false);
      notificationService.cleanup();
    }
  }, [user, pushInitialized]);

  // ========================================
  // CONTADORES COMBINADOS
  // ========================================
  const totalUnreadCount = unreadCount + pushUnreadCount;

  const value = {
    // ===== PICKUP NOTIFICATIONS (existentes) =====
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
    respondToPickup,
    sendPickupNotification,
    createTestNotification,
    
    // ===== PUSH NOTIFICATIONS (novos) =====
    pushNotifications,
    pushUnreadCount,
    pushInitialized,
    fetchPushNotifications,
    markPushAsRead,
    markAllPushAsRead,
    sendTestPushNotification,
    
    // ===== COMBINADOS =====
    totalUnreadCount, // Total de notificações não lidas (pickup + push)
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};