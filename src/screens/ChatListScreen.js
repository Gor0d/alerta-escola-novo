// src/screens/ChatListScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { theme } from '../styles/theme';

export default function ChatListScreen({ route, navigation }) {
  const { userRole } = route.params || {};
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchConversations();
      setupRealtimeSubscription();
    }
  }, [currentUser]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setCurrentUser({ ...user, ...profile });
      }
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
    }
  };

  const fetchConversations = async () => {
    try {
      setLoading(true);
      
      if (!currentUser) return;

      console.log(`📱 Buscando conversas para ${currentUser.role}: ${currentUser.name}`);

      let query = supabase
        .from('conversations')
        .select(`
          *,
          teacher:teacher_id(id, name, email),
          parent:parent_id(id, name, email),
          student:students(id, name),
          messages!inner(
            id,
            content,
            created_at,
            read,
            sender_id
          )
        `)
        .order('last_message_at', { ascending: false });

      // Filtrar por papel do usuário
      if (currentUser.role === 'teacher') {
        query = query.eq('teacher_id', currentUser.id);
      } else if (currentUser.role === 'parent') {
        query = query.eq('parent_id', currentUser.id);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      // Processar conversas para pegar a última mensagem
      const processedConversations = data?.map(conversation => {
        // Ordenar mensagens por data e pegar a mais recente
        const sortedMessages = conversation.messages.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        
        const lastMessage = sortedMessages[0];
        
        // Contar mensagens não lidas (que não são do usuário atual)
        const unreadCount = conversation.messages.filter(
          msg => !msg.read && msg.sender_id !== currentUser.id
        ).length;

        return {
          ...conversation,
          lastMessage: lastMessage,
          unreadCount: unreadCount,
          // Definir quem é o outro participante
          otherParticipant: currentUser.role === 'teacher' 
            ? conversation.parent 
            : conversation.teacher
        };
      }) || [];

      console.log(`📋 ${processedConversations.length} conversas encontradas`);
      setConversations(processedConversations);

    } catch (error) {
      console.error('Erro ao buscar conversas:', error);
      Alert.alert('Erro', 'Não foi possível carregar as conversas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const setupRealtimeSubscription = () => {
    console.log('📡 Configurando subscription para conversas...');
    
    // Subscription para novas mensagens
    const messageSubscription = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('📨 Nova mensagem recebida:', payload);
          // Recarregar conversas quando houver nova mensagem
          fetchConversations();
        }
      )
      .subscribe();

    // Subscription para conversas
    const conversationSubscription = supabase
      .channel('conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        (payload) => {
          console.log('💬 Conversa atualizada:', payload);
          fetchConversations();
        }
      )
      .subscribe();

    // Cleanup na saída da tela
    return () => {
      messageSubscription.unsubscribe();
      conversationSubscription.unsubscribe();
    };
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const handleConversationPress = (conversation) => {
    console.log(`💬 Abrindo conversa com ${conversation.otherParticipant?.name}`);
    
    navigation.navigate('ChatScreen', {
      conversationId: conversation.id,
      otherParticipant: conversation.otherParticipant,
      student: conversation.student,
      userRole: currentUser?.role
    });
  };

  const handleStartNewChat = () => {
    navigation.navigate('StartChatScreen', {
      userRole: currentUser?.role,
      currentUser: currentUser
    });
  };

  const formatLastMessageTime = (dateString) => {
    const messageDate = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.abs(now - messageDate) / 36e5;

    if (diffInHours < 1) {
      return 'Agora';
    } else if (diffInHours < 24) {
      return messageDate.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 168) { // 7 dias
      return messageDate.toLocaleDateString('pt-BR', { 
        weekday: 'short' 
      });
    } else {
      return messageDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit'
      });
    }
  };

  const renderConversationCard = ({ item }) => (
    <TouchableOpacity
      style={[styles.conversationCard, theme.shadows.small, { backgroundColor: theme.colors.card }]}
      onPress={() => handleConversationPress(item)}
    >
      <View style={styles.conversationHeader}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
          <Ionicons 
            name={currentUser?.role === 'teacher' ? 'people' : 'school'} 
            size={24} 
            color={theme.colors.text.inverse} 
          />
        </View>

        {/* Informações da conversa */}
        <View style={styles.conversationInfo}>
          <View style={styles.conversationTitleRow}>
            <Text style={[styles.participantName, { color: theme.colors.text.primary }]}>
              {item.otherParticipant?.name || 'Usuário'}
            </Text>
            {item.unreadCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: theme.colors.error }]}>
                <Text style={[styles.unreadCount, { color: theme.colors.text.inverse }]}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
          
          <Text style={[styles.studentName, { color: theme.colors.primary }]}>
            Sobre: {item.student?.name}
          </Text>
          
          {item.lastMessage && (
            <Text 
              style={[
                styles.lastMessage, 
                { 
                  color: item.unreadCount > 0 ? theme.colors.text.primary : theme.colors.text.secondary,
                  fontWeight: item.unreadCount > 0 ? '600' : 'normal'
                }
              ]}
              numberOfLines={2}
            >
              {item.lastMessage.sender_id === currentUser?.id ? 'Você: ' : ''}
              {item.lastMessage.content}
            </Text>
          )}
        </View>

        {/* Timestamp */}
        {item.lastMessage && (
          <View style={styles.timestampContainer}>
            <Text style={[styles.timestamp, { color: theme.colors.text.light }]}>
              {formatLastMessageTime(item.lastMessage.created_at)}
            </Text>
            {item.unreadCount === 0 && (
              <Ionicons 
                name="checkmark-done" 
                size={16} 
                color={theme.colors.success} 
                style={styles.readIcon}
              />
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={64} color={theme.colors.text.light} />
      <Text style={[styles.emptyStateText, { color: theme.colors.text.secondary }]}>
        Nenhuma conversa ainda
      </Text>
      <Text style={[styles.emptyStateSubtext, { color: theme.colors.text.light }]}>
        {currentUser?.role === 'teacher' 
          ? 'Aguarde mensagens dos responsáveis ou inicie uma conversa'
          : 'Inicie uma conversa com os professores dos seus filhos'
        }
      </Text>
      <TouchableOpacity
        style={[styles.startChatButton, { backgroundColor: theme.colors.primary }]}
        onPress={handleStartNewChat}
      >
        <Ionicons name="add" size={20} color={theme.colors.text.inverse} />
        <Text style={[styles.startChatButtonText, { color: theme.colors.text.inverse }]}>
          Iniciar Conversa
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.inverse} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: theme.colors.text.inverse }]}>
            Conversas
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.text.inverse }]}>
            {theme.school.shortName}
          </Text>
        </View>
        <TouchableOpacity onPress={handleStartNewChat}>
          <Ionicons name="add" size={24} color={theme.colors.text.inverse} />
        </TouchableOpacity>
      </View>

      {/* Lista de conversas */}
      {loading && conversations.length === 0 ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversationCard}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
            />
          }
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: theme.spacing.lg,
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: theme.spacing.lg,
  },
  headerTitle: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: theme.typography.h2.fontWeight,
  },
  headerSubtitle: {
    fontSize: theme.typography.caption.fontSize,
    opacity: 0.9,
    marginTop: 2,
  },
  listContainer: {
    padding: theme.spacing.md,
  },
  conversationCard: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  participantName: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
    flex: 1,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: theme.spacing.sm,
  },
  unreadCount: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  studentName: {
    fontSize: theme.typography.caption.fontSize,
    fontWeight: '500',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: theme.typography.caption.fontSize,
    lineHeight: 18,
  },
  timestampContainer: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    marginLeft: theme.spacing.sm,
  },
  timestamp: {
    fontSize: theme.typography.small.fontSize,
    marginBottom: 4,
  },
  readIcon: {
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: 100,
  },
  emptyStateText: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
    marginTop: theme.spacing.lg,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: theme.typography.caption.fontSize,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  startChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.xl,
    ...theme.shadows.medium,
  },
  startChatButtonText: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
  },
  loader: {
    marginTop: 100,
  },
});