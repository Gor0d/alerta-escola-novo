import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Keyboard,
  Dimensions,
  StatusBar,
  Animated,
  Easing
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { theme } from '../styles/theme';
import { useAuth } from '../contexts/AuthContext';

// NOVO: Componente de mensagem animada
const AnimatedMessage = ({ item, isOwnMessage, style }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Animação de entrada suave
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: fadeAnim,
          transform: [
            { 
              translateY: slideAnim,
            },
            { 
              scale: scaleAnim,
            },
          ],
        },
      ]}
    >
      <View
        style={[
          styles.messageWrapper,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        <Text style={[
          styles.messageText,
          isOwnMessage ? styles.ownMessageText : styles.otherMessageText
        ]}>
          {item.content}
        </Text>
        <Text style={[
          styles.messageTime,
          isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
        ]}>
          {new Date(item.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </Animated.View>
  );
};

export default function ChatScreen({ route, navigation }) {
  const { conversationId, userId, otherParticipant } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef();
  
  // NOVO: Ref para controlar animações de scroll
  const scrollAnimRef = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('🔍 DEBUG ChatScreen:');
    console.log('- conversationId:', conversationId);
    console.log('- userId (params):', userId);
    console.log('- user.id (auth):', user?.id);
    console.log('- otherParticipant:', otherParticipant);
  }, []);

  useEffect(() => {
    fetchMessages();
    markMessagesAsRead();

    const subscription = supabase
      .channel(`chat-messages-${conversationId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newMsg = payload.new;
          console.log('📨 Nova mensagem recebida:', newMsg);
          
          if (newMsg.conversation_id === conversationId) {
            // MODIFICADO: Adicionar mensagem e animar scroll
            setMessages((prevMessages) => {
              const updatedMessages = [...prevMessages, newMsg];
              // Animar scroll para o final após adicionar mensagem
              setTimeout(() => {
                animatedScrollToBottom();
              }, 50);
              return updatedMessages;
            });
            
            if (newMsg.sender_id !== (user?.id || userId)) {
              markMessageAsRead(newMsg.id);
              // NOVO: Vibração leve para mensagem recebida (opcional)
              // Vibration.vibrate(50);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Chat subscription status:', status);
      });

    return () => {
      console.log('🧹 Limpando subscription do chat...');
      supabase.removeChannel(subscription);
    };
  }, [conversationId]);

  const fetchMessages = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(name, role)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      console.log('💬 Mensagens carregadas:', data?.length || 0);
      console.log('👤 Usuário atual (auth):', user?.id);
      console.log('👤 Usuário atual (params):', userId);
      
      const processedMessages = data?.map(msg => ({
        ...msg,
        senderName: msg.sender?.name || 'Usuário',
        isOwnMessage: msg.sender_id === (user?.id || userId)
      })) || [];

      console.log('🔄 Primeiras 3 mensagens processadas:', 
        processedMessages.slice(0, 3).map(m => ({
          content: m.content,
          sender_id: m.sender_id,
          isOwnMessage: m.isOwnMessage,
          currentUserId: user?.id || userId
        }))
      );

      setMessages(processedMessages);
      
      // NOVO: Scroll inicial sem animação para carregar mensagens existentes
      setTimeout(() => {
        scrollToBottom(false);
      }, 100);
      
    } catch (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      Alert.alert('Erro', 'Não foi possível carregar as mensagens');
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user?.id || userId);

      if (error) throw error;
    } catch (error) {
      console.error('❌ Erro ao marcar mensagens como lidas:', error);
    }
  };

  const markMessageAsRead = async (messageId) => {
    try {
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('id', messageId);
    } catch (error) {
      console.error('❌ Erro ao marcar mensagem como lida:', error);
    }
  };

  const sendMessage = async () => {
    if (newMessage.trim() === '') return;

    setSending(true);
    
    try {
      console.log('📤 Enviando mensagem:', {
        content: newMessage.trim(),
        sender_id: user?.id || userId,
        conversation_id: conversationId
      });

      // NOVO: Criar mensagem temporária para feedback imediato
      const tempMessage = {
        id: 'temp-' + Date.now(),
        conversation_id: conversationId,
        sender_id: user?.id || userId,
        content: newMessage.trim(),
        created_at: new Date().toISOString(),
        isOwnMessage: true,
        senderName: user?.name || 'Você',
        isTemporary: true
      };

      // NOVO: Adicionar mensagem temporária imediatamente
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      Keyboard.dismiss();

      // NOVO: Animar scroll para a nova mensagem
      setTimeout(() => {
        animatedScrollToBottom();
      }, 50);

      const { data, error } = await supabase.from('messages').insert([
        {
          conversation_id: conversationId,
          sender_id: user?.id || userId,
          content: tempMessage.content,
          type: 'text',
          read: false
        },
      ]).select();

      if (error) throw error;

      // NOVO: Substituir mensagem temporária pela real
      if (data && data[0]) {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === tempMessage.id 
              ? { ...data[0], isOwnMessage: true, senderName: user?.name || 'Você' }
              : msg
          )
        );
      }

      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      console.log('✅ Mensagem enviada com sucesso');
      
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      
      // NOVO: Remover mensagem temporária em caso de erro
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      setNewMessage(tempMessage.content); // Restaurar texto
      
      Alert.alert('Erro', 'Não foi possível enviar a mensagem');
    } finally {
      setSending(false);
    }
  };

  // NOVO: Função para scroll animado
  const animatedScrollToBottom = () => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  // MODIFICADO: Função de scroll com opção de animação
  const scrollToBottom = (animated = true) => {
    setTimeout(() => {
      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated });
      }
    }, 100);
  };

  // MODIFICADO: Renderizar mensagem com animação
  const renderMessage = ({ item, index }) => {
    const isOwnMessage = item.isOwnMessage !== undefined 
      ? item.isOwnMessage 
      : item.sender_id === (user?.id || userId);
    
    return (
      <AnimatedMessage 
        item={item}
        isOwnMessage={isOwnMessage}
        style={{ marginVertical: 4 }}
      />
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor={theme.colors.primary}
        translucent={false}
      />
      
      <View style={[styles.header, { 
        paddingTop: Math.max(insets.top + 8, Platform.OS === 'ios' ? 50 : 30)
      }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>
            {otherParticipant?.name ?? 'Chat'}
          </Text>
          {otherParticipant?.role && (
            <Text style={styles.headerSubtitle}>
              {otherParticipant.role === 'teacher' ? 'Professor' : 'Responsável'}
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.headerAction}>
          <Ionicons name="information-circle-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.messagesContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Carregando mensagens...</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
              // NOVO: Configurações para melhor performance de animação
              removeClippedSubviews={Platform.OS === 'android'}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              initialNumToRender={20}
              windowSize={10}
            />
          )}
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Digite sua mensagem..."
            placeholderTextColor="#999"
            value={newMessage}
            onChangeText={setNewMessage}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
            multiline
            maxLength={500}
            editable={!sending}
          />
          
          {/* MODIFICADO: Botão de envio com animação de pulso */}
          <Animated.View>
            <TouchableOpacity 
              onPress={sendMessage} 
              disabled={sending || !newMessage.trim()}
              style={[
                styles.sendButton,
                (!newMessage.trim() || sending) && styles.sendButtonDisabled
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const screenWidth = Dimensions.get('window').width;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  headerAction: {
    marginLeft: 16,
    padding: 4,
  },
  keyboardContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  messagesContent: {
    paddingVertical: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: theme.colors.text.secondary,
    fontSize: 16,
  },
  messageWrapper: {
    marginVertical: 4,
    maxWidth: screenWidth * 0.75,
    borderRadius: 18,
    padding: 12,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: '#666',
    textAlign: 'left',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    fontSize: 16,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#c0c0c0',
  },
});