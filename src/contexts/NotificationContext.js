// ==========================================
// 1. NotificationContext.js - Context para gerenciar notificações
// ==========================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
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
    if (!user) return;

    // Buscar notificações existentes
    fetchNotifications();

    // Configurar subscription para notificações em tempo real
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pickup_notifications',
          filter: `teacher_id=eq.${user.id}`, // Para professores
        },
        handleNewPickupNotification
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pickup_notifications',
          filter: `parent_id=eq.${user.id}`, // Para pais
        },
        handlePickupUpdate
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('pickup_notifications')
        .select(`
          *,
          students(name),
          parent_profiles:profiles!pickup_notifications_parent_id_fkey(name),
          teacher_profiles:profiles!pickup_notifications_teacher_id_fkey(name)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      // Filtrar baseado no papel do usuário
      if (profile?.role === 'teacher') {
        query = query.eq('teacher_id', user.id);
      } else if (profile?.role === 'parent') {
        query = query.eq('parent_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.read_at).length || 0);
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
    }
  };

  const handleNewPickupNotification = (payload) => {
    console.log('=== NOVA NOTIFICAÇÃO DE BUSCA RECEBIDA ===');
    console.log('Payload:', payload);

    if (profile?.role !== 'teacher') return;

    const newNotification = payload.new;
    
    // Buscar dados completos da notificação
    fetchNotificationDetails(newNotification.id).then((fullNotification) => {
      if (fullNotification) {
        // Adicionar à lista
        setNotifications(prev => [fullNotification, ...prev]);
        setUnreadCount(prev => prev + 1);

        // Mostrar pop-up
        showPickupNotificationPopup(fullNotification);
      }
    });
  };

  const handlePickupUpdate = (payload) => {
    console.log('=== ATUALIZAÇÃO DE NOTIFICAÇÃO DE BUSCA ===');
    console.log('Payload:', payload);

    if (profile?.role !== 'parent') return;

    const updatedNotification = payload.new;
    
    // Atualizar na lista
    setNotifications(prev => 
      prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
    );

    // Se foi confirmada/rejeitada, mostrar pop-up para o pai
    if (updatedNotification.status === 'confirmed' || updatedNotification.status === 'rejected') {
      fetchNotificationDetails(updatedNotification.id).then((fullNotification) => {
        if (fullNotification) {
          showPickupResponsePopup(fullNotification);
        }
      });
    }
  };

  const fetchNotificationDetails = async (notificationId) => {
    try {
      const { data, error } = await supabase
        .from('pickup_notifications')
        .select(`
          *,
          students(name),
          parent_profiles:profiles!pickup_notifications_parent_id_fkey(name),
          teacher_profiles:profiles!pickup_notifications_teacher_id_fkey(name)
        `)
        .eq('id', notificationId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao buscar detalhes da notificação:', error);
      return null;
    }
  };

  const showPickupNotificationPopup = (notification) => {
    const parentName = notification.parent_profiles?.name || 'Responsável';
    const studentName = notification.students?.name || 'Aluno';
    
    Alert.alert(
      '🚗 Nova Solicitação de Busca',
      `${parentName} solicitou buscar ${studentName}.\n\nMotivo: ${notification.reason || 'Busca normal'}\n\nDeseja autorizar?`,
      [
        {
          text: '❌ Rejeitar',
          style: 'destructive',
          onPress: () => respondToPickup(notification.id, 'rejected')
        },
        {
          text: '✅ Autorizar',
          onPress: () => respondToPickup(notification.id, 'confirmed')
        }
      ],
      { cancelable: false }
    );
  };

  const showPickupResponsePopup = (notification) => {
    const teacherName = notification.teacher_profiles?.name || 'Professor';
    const studentName = notification.students?.name || 'Seu filho';
    
    if (notification.status === 'confirmed') {
      Alert.alert(
        '✅ Busca Autorizada',
        `${teacherName} autorizou a busca de ${studentName}.\n\nVocê pode ir buscar seu filho agora!`,
        [{ text: 'Entendi', style: 'default' }]
      );
    } else if (notification.status === 'rejected') {
      Alert.alert(
        '❌ Busca Negada',
        `${teacherName} não autorizou a busca de ${studentName} no momento.\n\nEntre em contato com a escola para mais informações.`,
        [{ text: 'Entendi', style: 'default' }]
      );
    }
  };

  const respondToPickup = async (notificationId, status) => {
    try {
      const { error } = await supabase
        .from('pickup_notifications')
        .update({
          status: status,
          responded_at: new Date().toISOString(),
          response_notes: status === 'confirmed' ? 'Autorizado pelo professor' : 'Negado pelo professor'
        })
        .eq('id', notificationId);

      if (error) throw error;

      // Atualizar localmente
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, status } : n)
      );

      Alert.alert(
        'Resposta Enviada',
        status === 'confirmed' 
          ? 'Busca autorizada! O responsável foi notificado.'
          : 'Busca negada. O responsável foi notificado.'
      );

    } catch (error) {
      console.error('Erro ao responder notificação:', error);
      Alert.alert('Erro', 'Não foi possível enviar a resposta. Tente novamente.');
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('pickup_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n)
      );
      
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
    }
  };

  const value = {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    respondToPickup
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// ==========================================
// 2. NotificationBadge.js - Badge de contador
// ==========================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNotifications } from '../contexts/NotificationContext';

export const NotificationBadge = ({ style }) => {
  const { unreadCount } = useNotifications();

  if (unreadCount === 0) return null;

  return (
    <View style={[badgeStyles.badge, style]}>
      <Text style={badgeStyles.badgeText}>
        {unreadCount > 99 ? '99+' : unreadCount}
      </Text>
    </View>
  );
};

const badgeStyles = StyleSheet.create({
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