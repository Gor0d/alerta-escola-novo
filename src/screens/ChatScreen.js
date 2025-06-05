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
  StatusBar
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { theme } from '../styles/theme';
import { useAuth } from '../contexts/AuthContext';

export default function ChatScreen({ route, navigation }) {
  const { conversationId, userId, otherParticipant } = route.params;
  const { user } = useAuth(); // ADICIONADO: usar contexto de auth
  const insets = useSafeAreaInsets(); // ADICIONADO: para ilha dinâmica

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef();

  // ADICIONADO: useEffect para logs de debug
  useEffect(() => {
    console.log('🔍 DEBUG ChatScreen:');
    console.log('- conversationId:', conversationId);
    console.log('- userId (params):', userId);
    console.log('- user.id (auth):', user?.id);
    console.log('- otherParticipant:', otherParticipant);
  }, []);

  useEffect(() => {
    fetchMessages();
    markMessagesAsRead(); // ADICIONADO: marcar mensagens como lidas

    // CORRIGIDO: subscription com canal único e cleanup
    const subscription = supabase
      .channel(`chat-messages-${conversationId}`) // Canal único por conversa
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}` // ADICIONADO: filtro
        },
        (payload) => {
          const newMsg = payload.new;
          console.log('📨 Nova mensagem recebida:', newMsg);
          
          if (newMsg.conversation_id === conversationId) {
            setMessages((prevMessages) => [...prevMessages, newMsg]);
            scrollToBottom();
            
            // ADICIONADO: marcar como lida se não for do usuário atual
            if (newMsg.sender_id !== (user?.id || userId)) {
              markMessageAsRead(newMsg.id);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Chat subscription status:', status);
      });

    // CORRIGIDO: cleanup adequado
    return () => {
      console.log('🧹 Limpando subscription do chat...');
      supabase.removeChannel(subscription);
    };
  }, [conversationId]);

  const fetchMessages = async () => {
    setLoading(true);
    
    try {
      // MELHORADO: buscar mensagens com dados do sender
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
      
      // ADICIONADO: processar mensagens com informações do sender
      const processedMessages = data?.map(msg => ({
        ...msg,
        senderName: msg.sender?.name || 'Usuário',
        isOwnMessage: msg.sender_id === (user?.id || userId) // CORREÇÃO: usar user.id ou userId como fallback
      })) || [];

      // ADICIONADO: log para debug das mensagens
      console.log('🔄 Primeiras 3 mensagens processadas:', 
        processedMessages.slice(0, 3).map(m => ({
          content: m.content,
          sender_id: m.sender_id,
          isOwnMessage: m.isOwnMessage,
          currentUserId: user?.id || userId
        }))
      );

      setMessages(processedMessages);
    } catch (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      Alert.alert('Erro', 'Não foi possível carregar as mensagens');
    } finally {
      setLoading(false);
    }
  };

  // ADICIONADO: função para marcar mensagens como lidas
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

  // ADICIONADO: função para marcar mensagem individual como lida
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

      const { error } = await supabase.from('messages').insert([
        {
          conversation_id: conversationId,
          sender_id: user?.id || userId, // CORRIGIDO: usar user.id ou userId
          content: newMessage.trim(),
          type: 'text', // ADICIONADO: tipo da mensagem
          read: false // ADICIONADO: marcar como não lida
        },
      ]);

      if (error) throw error;

      // ADICIONADO: atualizar timestamp da conversa
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      setNewMessage('');
      Keyboard.dismiss();
      console.log('✅ Mensagem enviada com sucesso');
      
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      Alert.alert('Erro', 'Não foi possível enviar a mensagem');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    // CORRIGIDO: usar a propriedade processada ou calcular novamente
    const isOwnMessage = item.isOwnMessage !== undefined 
      ? item.isOwnMessage 
      : item.sender_id === (user?.id || userId);
    
    return (
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
    );
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor={theme.colors.primary}
        translucent={false}
      />
      
      {/* CORRIGIDO: Header com suporte à ilha dinâmica */}
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
        {/* ADICIONADO: botão de info */}
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
              onContentSizeChange={scrollToBottom}
              showsVerticalScrollIndicator={false}
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