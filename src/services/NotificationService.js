import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import { supabase } from './supabase';

// Configuração de comportamento das notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.notificationListener = null;
    this.responseListener = null;
    this.isInitialized = false;
  }

  // Inicializar o serviço de notificações
  async initialize() {
    try {
      if (this.isInitialized) return;

      // Registrar dispositivo e obter token
      const token = await this.registerForPushNotificationsAsync();
      
      if (token) {
        // Salvar token no Supabase
        await this.saveTokenToDatabase(token);
        
        // Configurar listeners
        this.setupNotificationListeners();
        
        this.isInitialized = true;
        console.log('✅ NotificationService inicializado com sucesso');
        return token;
      }
      
      throw new Error('Não foi possível obter token de notificação');
    } catch (error) {
      console.error('❌ Erro ao inicializar NotificationService:', error);
      throw error;
    }
  }

  // Registrar dispositivo para notificações push
  async registerForPushNotificationsAsync() {
    try {
      if (!Device.isDevice) {
        console.warn('⚠️ Notificações push só funcionam em dispositivos físicos');
        return null;
      }

      // Verificar permissões existentes
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Solicitar permissão se necessário
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert(
          'Permissão Negada',
          'Para receber notificações importantes da escola, é necessário permitir notificações.'
        );
        return null;
      }

      // Obter token do dispositivo
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId || 'seu-project-id',
      });

      console.log('📱 Token de notificação obtido:', token.data);

      // Configurações específicas do Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('escola-alerts', {
          name: 'Alertas da Escola',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0066CC',
          sound: 'notification-sound.wav',
        });

        await Notifications.setNotificationChannelAsync('chat-messages', {
          name: 'Mensagens do Chat',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0066CC',
        });
      }

      return token.data;
    } catch (error) {
      console.error('❌ Erro ao registrar notificações:', error);
      return null;
    }
  }

  // Salvar token no banco de dados
  async saveTokenToDatabase(token) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Verificar se já existe um token para este usuário
      const { data: existingTokens, error: fetchError } = await supabase
        .from('push_tokens')
        .select('id')
        .eq('user_id', user.id)
        .eq('token', token);

      if (fetchError) throw fetchError;

      // Se não existe, inserir novo token
      if (!existingTokens || existingTokens.length === 0) {
        const { error: insertError } = await supabase
          .from('push_tokens')
          .insert({
            user_id: user.id,
            token: token,
            platform: Platform.OS,
            device_info: {
              brand: Device.brand,
              modelName: Device.modelName,
              osName: Device.osName,
              osVersion: Device.osVersion,
            },
            is_active: true,
          });

        if (insertError) throw insertError;
        console.log('✅ Token salvo no banco de dados');
      } else {
        console.log('ℹ️ Token já existe no banco de dados');
      }

      // Salvar token localmente
      await AsyncStorage.setItem('expo_push_token', token);
    } catch (error) {
      console.error('❌ Erro ao salvar token no banco:', error);
    }
  }

  // Configurar listeners para notificações
  setupNotificationListeners() {
    // Listener para notificações recebidas enquanto app está aberto
    this.notificationListener = Notifications.addNotificationReceivedListener(
      this.handleNotificationReceived.bind(this)
    );

    // Listener para quando usuário interage com a notificação
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse.bind(this)
    );
  }

  // Manipular notificação recebida
  async handleNotificationReceived(notification) {
    console.log('📨 Notificação recebida:', notification);
    
    const { data } = notification.request.content;
    
    // Atualizar badge se necessário
    if (data?.updateBadge) {
      await this.updateBadgeCount();
    }

    // Emitir evento customizado se necessário
    if (data?.type === 'chat_message') {
      // Pode ser usado para atualizar UI do chat em tempo real
      console.log('💬 Nova mensagem de chat recebida');
    }
  }

  // Manipular resposta à notificação (quando usuário toca)
  async handleNotificationResponse(response) {
    console.log('👆 Usuário interagiu com notificação:', response);
    
    const { data } = response.notification.request.content;
    
    // Navegação baseada no tipo de notificação
    if (data?.type === 'chat_message' && data?.conversationId) {
      // Navegar para o chat específico
      console.log('🚀 Navegando para chat:', data.conversationId);
      // Implementar navegação aqui
    } else if (data?.type === 'pickup_request' && data?.studentId) {
      // Navegar para tela de confirmação de busca
      console.log('🚗 Navegando para confirmação de busca:', data.studentId);
    } else if (data?.type === 'school_alert') {
      // Navegar para tela de avisos
      console.log('📢 Navegando para avisos da escola');
    }
  }

  // Enviar notificação local (para testes)
  async sendLocalNotification(title, body, data = {}) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'notification-sound.wav',
        },
        trigger: null, // Enviar imediatamente
      });
    } catch (error) {
      console.error('❌ Erro ao enviar notificação local:', error);
    }
  }

  // Atualizar badge count
  async updateBadgeCount() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Contar mensagens não lidas
        const { count, error } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', user.id)
          .eq('read', false);

        if (!error && count !== null) {
          await Notifications.setBadgeCountAsync(count);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar badge:', error);
    }
  }

  // Limpar badge
  async clearBadge() {
    try {
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error('❌ Erro ao limpar badge:', error);
    }
  }

  // Cancelar notificação específica
  async cancelNotification(notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('❌ Erro ao cancelar notificação:', error);
    }
  }

  // Cancelar todas as notificações
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('❌ Erro ao cancelar todas notificações:', error);
    }
  }

  // Cleanup ao desmontar
  cleanup() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
    this.isInitialized = false;
  }

  // Obter histórico de notificações
  async getNotificationHistory() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar histórico de notificações:', error);
      return [];
    }
  }

  // Marcar notificação como lida
  async markNotificationAsRead(notificationId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
      
      // Atualizar badge
      await this.updateBadgeCount();
    } catch (error) {
      console.error('❌ Erro ao marcar notificação como lida:', error);
    }
  }
}

// Exportar instância única (Singleton)
export const notificationService = new NotificationService();
export default notificationService;