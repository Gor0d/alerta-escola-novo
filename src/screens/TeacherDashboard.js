import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  Platform,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext'; // NOVO
import { NotificationBadge } from '../components/NotificationBadge'; // NOVO
import { supabase } from '../services/supabase';
import { theme } from '../styles/theme';

export default function TeacherDashboard({ navigation }) {
  const { signOut, profile, user } = useAuth();
  const { unreadCount, notifications: contextNotifications, respondToPickup } = useNotifications(); // NOVO
  const insets = useSafeAreaInsets();
  const [classes, setClasses] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [schoolYear, setSchoolYear] = useState('2025');

  useEffect(() => {
    fetchData();
  }, []);

  // NOVO: Sincronizar notificações do contexto
  useEffect(() => {
    if (contextNotifications) {
      // Filtrar apenas notificações pendentes para mostrar no dashboard
      const pendingNotifications = contextNotifications.filter(n => n.status === 'pending');
      setNotifications(pendingNotifications);
    }
  }, [contextNotifications]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchClasses(),
        // Removido fetchNotifications - agora usa o contexto
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchClasses = async () => {
    try {
      console.log('Buscando turmas para o professor:', user.id);
      
      // Query super simples - apenas turmas
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro na query classes:', error);
        throw error;
      }

      console.log('Classes encontradas:', data);

      // Para cada turma, contar alunos de forma simples
      const classesWithStudentCount = await Promise.all(
        (data || []).map(async (classItem) => {
          // Contar apenas quantos enrollments existem
          const { count, error: countError } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', classItem.id);

          if (countError) {
            console.error('Erro ao contar alunos:', countError);
            return { ...classItem, enrollments: [] };
          }

          console.log(`Turma ${classItem.name} tem ${count} alunos`);

          // Simular array de enrollments para manter compatibilidade
          const mockEnrollments = Array.from({ length: count || 0 }, (_, i) => ({ id: i }));
          
          return { ...classItem, enrollments: mockEnrollments };
        })
      );

      console.log('Classes with student count:', classesWithStudentCount);
      setClasses(classesWithStudentCount);
    } catch (error) {
      console.error('Erro ao buscar turmas:', error);
      Alert.alert('Erro', 'Não foi possível carregar suas turmas');
      setClasses([]); // Set empty array on error
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleAddClass = async () => {
    if (!newClassName.trim()) {
      Alert.alert('Erro', 'O nome da turma é obrigatório');
      return;
    }

    try {
      console.log('Criando turma:', {
        name: newClassName.trim(),
        teacher_id: user.id,
        school_year: schoolYear
      });

      const { data, error } = await supabase
        .from('classes')
        .insert([{
          name: newClassName.trim(),
          teacher_id: user.id,
          school_year: schoolYear,
          school_unit: profile?.school_unit
        }])
        .select();

      if (error) {
        console.error('Erro ao criar turma:', error);
        throw error;
      }

      console.log('Turma criada:', data);

      if (data && data.length > 0) {
        // Adicionar à lista local com enrollments vazio
        const newClass = { ...data[0], enrollments: [] };
        setClasses([newClass, ...classes]);
        setNewClassName('');
        setModalVisible(false);
        Alert.alert('Sucesso', 'Turma criada com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao criar turma:', error);
      Alert.alert('Erro', `Não foi possível criar a turma: ${error.message}`);
    }
  };

  const handleDeleteClass = async (classToDelete) => {
    const studentCount = classToDelete.enrollments?.length || 0;
    
    // Primeira confirmação
    Alert.alert(
      'Excluir Turma',
      `Tem certeza que deseja excluir a turma "${classToDelete.name}"?` +
      (studentCount > 0 ? `\n\nEsta turma possui ${studentCount} aluno${studentCount > 1 ? 's' : ''} matriculado${studentCount > 1 ? 's' : ''}.` : ''),
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () => {
            // Segunda confirmação com o nome da turma
            Alert.alert(
              'CONFIRMAÇÃO FINAL',
              `Digite o nome da turma para confirmar a exclusão:\n\n"${classToDelete.name}"\n\nEsta ação não pode ser desfeita!`,
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'EXCLUIR',
                  style: 'destructive',
                  onPress: () => confirmDeleteClass(classToDelete)
                }
              ]
            );
          }
        }
      ]
    );
  };

  const confirmDeleteClass = async (classToDelete) => {
    try {
      console.log('Excluindo turma:', classToDelete.id);

      // Versão mais robusta - fazer uma query para cada tabela separadamente
      
      // 1. Primeiro, excluir registros de presença (attendances)
      console.log('Excluindo presenças...');
      const { error: attendancesError } = await supabase
        .from('attendances')
        .delete()
        .eq('class_id', classToDelete.id);

      if (attendancesError) {
        console.error('Erro ao excluir presenças:', attendancesError);
        throw new Error(`Erro ao excluir presenças: ${attendancesError.message}`);
      }

      // 2. Buscar IDs dos estudantes da turma para excluir notificações
      console.log('Buscando estudantes da turma...');
      const { data: enrollments, error: enrollmentsSelectError } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('class_id', classToDelete.id);

      if (enrollmentsSelectError) {
        console.error('Erro ao buscar matrículas:', enrollmentsSelectError);
        // Continuar mesmo se não encontrar matrículas
      }

      // 3. Excluir notificações dos estudantes desta turma
      if (enrollments && enrollments.length > 0) {
        console.log('Excluindo notificações...');
        const studentIds = enrollments.map(e => e.student_id);
        
        const { error: notificationsError } = await supabase
          .from('pickup_notifications')
          .delete()
          .in('student_id', studentIds);

        if (notificationsError) {
          console.log('Aviso ao excluir notificações:', notificationsError);
          // Continuar mesmo se não conseguir excluir notificações
        }
      }

      // 4. Excluir matrículas (enrollments)
      console.log('Excluindo matrículas...');
      const { error: enrollmentsError } = await supabase
        .from('enrollments')
        .delete()
        .eq('class_id', classToDelete.id);

      if (enrollmentsError) {
        console.error('Erro ao excluir matrículas:', enrollmentsError);
        throw new Error(`Erro ao excluir matrículas: ${enrollmentsError.message}`);
      }

      // 5. Finalmente, excluir a turma
      console.log('Excluindo turma...');
      const { error: classError } = await supabase
        .from('classes')
        .delete()
        .eq('id', classToDelete.id)
        .eq('teacher_id', user.id);

      if (classError) {
        console.error('Erro ao excluir turma:', classError);
        throw new Error(`Erro ao excluir turma: ${classError.message}`);
      }

      console.log('Turma excluída com sucesso!');

      // Remover da lista local
      setClasses(classes.filter(c => c.id !== classToDelete.id));
      
      Alert.alert(
        'Turma Excluída ✅',
        `A turma "${classToDelete.name}" foi excluída com sucesso!\n\nTodos os dados relacionados foram removidos.`
      );

    } catch (error) {
      console.error('Erro completo ao excluir turma:', error);
      Alert.alert(
        'Erro ao Excluir Turma ❌',
        `Não foi possível excluir a turma "${classToDelete.name}".\n\nDetalhes técnicos:\n${error.message}\n\nTente novamente em alguns minutos.`
      );
    }
  };

  // FUNÇÕES ATUALIZADAS: Usar hook de notificações
  const confirmPickup = async (notificationId) => {
    try {
      await respondToPickup(notificationId, true, 'Autorizado pelo professor');
      // A atualização da lista será feita automaticamente pelo contexto
    } catch (error) {
      console.error('Erro ao confirmar busca:', error);
      Alert.alert('Erro', 'Não foi possível confirmar a busca. Tente novamente.');
    }
  };

  const rejectPickup = async (notificationId) => {
    try {
      await respondToPickup(notificationId, false, 'Negado pelo professor');
      // A atualização da lista será feita automaticamente pelo contexto
    } catch (error) {
      console.error('Erro ao recusar busca:', error);
      Alert.alert('Erro', 'Não foi possível recusar a busca. Tente novamente.');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Sair', 
          onPress: async () => {
            await signOut();
          },
          style: 'destructive' 
        }
      ]
    );
  };

  // FUNÇÃO RENDERCLASSCARD COMPLETA CORRIGIDA
  const renderClassCard = (classItem) => {
    const studentCount = classItem.enrollments?.length || 0;

    return (
      <TouchableOpacity 
        key={classItem.id} 
        style={styles.classCard}
        onPress={() => {
          console.log('Navegando para ClassDetails com:', {
            classId: classItem.id,
            className: classItem.name
          });
          navigation.navigate('ClassDetails', {
            classId: classItem.id,
            className: classItem.name
          });
        }}
      >
        <View style={styles.classHeader}>
          <View style={styles.classIcon}>
            <Ionicons name="school" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.classInfo}>
            <Text style={styles.className}>{classItem.name}</Text>
            <Text style={styles.classYear}>Ano: {classItem.school_year}</Text>
            {classItem.school_unit && (
              <Text style={styles.schoolUnit}>Unidade: {classItem.school_unit}</Text>
            )}
          </View>
          <View style={styles.studentCount}>
            <Text style={styles.studentCountNumber}>{studentCount}</Text>
            <Text style={styles.studentCountLabel}>
              {studentCount === 1 ? 'aluno' : 'alunos'}
            </Text>
          </View>
        </View>

        <View style={styles.classActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation(); // Evita navegação dupla
              console.log('Chamada clicada para turma:', classItem.name);
              navigation.navigate('ClassDetails', {
                classId: classItem.id,
                className: classItem.name
              });
            }}
          >
            <Ionicons name="list" size={20} color={theme.colors.primary} />
            <Text style={styles.actionButtonText}>Ver Chamada</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              Alert.alert('Em breve', 'Funcionalidade de mensagens será implementada!');
            }}
          >
            <Ionicons name="chatbubbles" size={20} color={theme.colors.text.secondary} />
            <Text style={styles.actionButtonText}>Mensagens</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]}
            onPress={(e) => {
              e.stopPropagation();
              handleDeleteClass(classItem);
            }}
          >
            <Ionicons name="trash" size={20} color={theme.colors.error} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderNotificationCard = (notification) => {
    const formatTime = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    return (
      <View key={notification.id} style={styles.notificationCard}>
        <View style={styles.notificationHeader}>
          <Ionicons name="car" size={20} color={theme.colors.warning} />
          <Text style={styles.notificationTitle}>Solicitação de Busca</Text>
          <Text style={styles.notificationTime}>
            {formatTime(notification.created_at)}
          </Text>
        </View>

        <Text style={styles.notificationText}>
          <Text style={styles.notificationBold}>
            {notification.parent_profiles?.name || 'Responsável'}
          </Text>
          {' '}solicitou a busca de{' '}
          <Text style={styles.notificationBold}>
            {notification.students?.name || 'Aluno'}
          </Text>
        </Text>

        {notification.reason && (
          <Text style={styles.notificationReason}>
            Motivo: {notification.reason}
          </Text>
        )}

        <View style={styles.notificationActions}>
          <TouchableOpacity 
            style={styles.confirmButton}
            onPress={() => confirmPickup(notification.id)}
          >
            <Text style={styles.confirmButtonText}>Confirmar</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.rejectButton}
            onPress={() => rejectPickup(notification.id)}
          >
            <Text style={styles.rejectButtonText}>Recusar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const totalStudents = classes.reduce((total, c) => total + (c.enrollments?.length || 0), 0);

  // DEBUG: Log dos dados para ajudar a identificar problemas
  console.log('=== TEACHER DASHBOARD DEBUG ===');
  console.log('User ID:', user?.id);
  console.log('Profile:', profile);
  console.log('Classes:', classes);
  console.log('Loading:', loading);

  return (
    <View style={styles.container}>
      {/* Status Bar - Configuração para o gradiente funcionar */}
      <StatusBar 
        barStyle="light-content" 
        backgroundColor={theme.colors.primary}
        translucent={false}
      />
      
      {/* Header com Safe Area customizada */}
      <View style={[styles.header, { 
        paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 24) + 12 
      }]}>
        <View style={styles.headerContent}>
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting} numberOfLines={1} adjustsFontSizeToFit>
              Prof. {profile?.name}! 👩‍🏫
            </Text>
            <Text style={styles.subGreeting}>Gerencie suas turmas</Text>
          </View>
          
          {/* NOVO: Botões do header */}
          <View style={styles.headerActions}>
            {/* Botão de notificações com badge */}
            <TouchableOpacity 
              style={styles.notificationButton} 
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={24} color="white" />
              <NotificationBadge />
            </TouchableOpacity>
            
            {/* Botão de logout existente */}
            <TouchableOpacity style={styles.profileButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* NOVO: Resumo de notificações pendentes */}
      {unreadCount > 0 && (
        <View style={styles.notificationSummary}>
          <Ionicons name="alert-circle" size={20} color="#f59e0b" />
          <Text style={styles.notificationSummaryText}>
            Você tem {unreadCount} solicitação{unreadCount > 1 ? 'ões' : ''} de busca pendente{unreadCount > 1 ? 's' : ''}
          </Text>
          <TouchableOpacity 
            style={styles.viewNotificationsButton}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.viewNotificationsText}>Ver</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Conteúdo */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Resumo rápido */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Ionicons name="school" size={24} color={theme.colors.primary} />
            <Text style={styles.summaryNumber}>{classes.length}</Text>
            <Text style={styles.summaryLabel}>Turmas</Text>
          </View>

          <View style={styles.summaryCard}>
            <Ionicons name="people" size={24} color={theme.colors.success} />
            <Text style={styles.summaryNumber}>{totalStudents}</Text>
            <Text style={styles.summaryLabel}>Alunos</Text>
          </View>

          <View style={styles.summaryCard}>
            <Ionicons name="notifications" size={24} color={theme.colors.warning} />
            <Text style={styles.summaryNumber}>{unreadCount}</Text>
            <Text style={styles.summaryLabel}>Pendentes</Text>
          </View>
        </View>

        {/* Notificações pendentes */}
        {notifications.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Notificações Pendentes</Text>
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => navigation.navigate('Notifications')}
              >
                <Text style={styles.viewAllText}>Ver Todas</Text>
              </TouchableOpacity>
            </View>
            {/* Mostrar apenas as 3 primeiras */}
            {notifications.slice(0, 3).map(renderNotificationCard)}
          </View>
        )}

        {/* Minhas turmas */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Minhas Turmas</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setModalVisible(true)}
            >
              <Ionicons name="add" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {loading && classes.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Carregando...</Text>
            </View>
          ) : classes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="school-outline" size={64} color={theme.colors.text.light} />
              <Text style={styles.emptyStateTitle}>Nenhuma turma criada</Text>
              <Text style={styles.emptyStateText}>
                Crie sua primeira turma para começar
              </Text>
              <TouchableOpacity
                style={styles.createFirstClassButton}
                onPress={() => setModalVisible(true)}
              >
                <Text style={styles.createFirstClassText}>Criar Primeira Turma</Text>
              </TouchableOpacity>
            </View>
          ) : (
            classes.map(renderClassCard)
          )}
        </View>

        {/* Espaço extra no final para scroll confortável */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Modal para adicionar turma */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nova Turma</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nome da Turma</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 5º Ano A"
                value={newClassName}
                onChangeText={setNewClassName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Ano Letivo</Text>
              <TextInput
                style={styles.input}
                placeholder="2025"
                value={schoolYear}
                onChangeText={setSchoolYear}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setModalVisible(false);
                  setNewClassName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleAddClass}
              >
                <Text style={styles.createButtonText}>Criar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    // Sombra para destacar do conteúdo
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingContainer: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  greeting: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    // Garantir que o texto seja legível
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subGreeting: {
    color: 'white',
    opacity: 0.9,
    marginTop: 4,
    fontSize: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  // NOVO: Estilos para os botões do header
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    // Sombra para destaque
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    // Pequena sombra para destaque
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  // NOVO: Resumo de notificações
  notificationSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  notificationSummaryText: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: 14,
    color: '#92400e',
    fontWeight: '500',
  },
  viewNotificationsButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
  },
  viewNotificationsText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginTop: theme.spacing.sm,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  // NOVO: Botão "Ver Todas"
  viewAllButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  viewAllText: {
    color: theme.colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  classCard: {
    backgroundColor: 'white',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  classHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  classIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  classYear: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  schoolUnit: {
    fontSize: 12,
    color: theme.colors.text.light,
    marginTop: 2,
  },
  studentCount: {
    alignItems: 'center',
  },
  studentCountNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  studentCountLabel: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  classActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)', // Fundo vermelho claro
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: theme.colors.text.secondary,
    fontSize: 14,
  },
  deleteButtonText: {
    color: theme.colors.error,
    fontWeight: '600',
  },
  notificationCard: {
    backgroundColor: 'white',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.warning,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  notificationTime: {
    fontSize: 12,
    color: theme.colors.text.light,
  },
  notificationText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  notificationBold: {
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  notificationReason: {
    fontSize: 12,
    color: theme.colors.text.light,
    fontStyle: 'italic',
    marginBottom: theme.spacing.md,
  },
  notificationActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: theme.colors.success,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: theme.colors.error,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  loadingText: {
    color: theme.colors.text.secondary,
  },
  emptyState: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.md,
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.colors.text.light,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    lineHeight: 20,
    marginBottom: theme.spacing.lg,
  },
  createFirstClassButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  createFirstClassText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  cancelButton: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: theme.colors.text.secondary,
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  createButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  bottomSpacing: {
    height: theme.spacing.xl,
  },
});