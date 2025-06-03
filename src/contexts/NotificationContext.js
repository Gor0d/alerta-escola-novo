import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

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
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

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

  const value = {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
    respondToPickup,
    sendPickupNotification,
    createTestNotification // Função extra para testes
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};