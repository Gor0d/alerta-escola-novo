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
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { theme } from '../styles/theme';

export default function TeacherDashboard({ navigation }) {
  const { signOut, profile, user } = useAuth();
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

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchClasses(),
        fetchNotifications()
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
      // Query super simples - apenas turmas
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

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

          // Simular array de enrollments para manter compatibilidade
          const mockEnrollments = Array.from({ length: count || 0 }, (_, i) => ({ id: i }));
          
          return { ...classItem, enrollments: mockEnrollments };
        })
      );

      console.log('Classes with student count:', classesWithStudentCount);
      console.log('Number of classes:', classesWithStudentCount.length);
      setClasses(classesWithStudentCount);
    } catch (error) {
      console.error('Erro ao buscar turmas:', error);
      Alert.alert('Erro', 'Não foi possível carregar suas turmas');
    }
  };

  const fetchNotifications = async () => {
    try {
      // Query simples para notificações
      const { data, error } = await supabase
        .from('pickup_notifications')
        .select('*')
        .eq('teacher_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const fetchLinkRequests = async () => {
  try {
    const { data, error } = await supabase
      .from('link_requests')
      .select(`
        *,
        students (name),
        profiles!link_requests_parent_id_fkey (name, email)
      `)
      .eq('teacher_id', user.id)
      .eq('status', 'pending');

    if (error) throw error;
    setLinkRequests(data || []);
  } catch (error) {
    console.error('Erro ao buscar solicitações:', error);
  }
};

const handleLinkRequest = async (requestId, studentId, parentId, approve) => {
  try {
    if (approve) {
      // Aprovar: atualizar o parent_id do aluno
      await supabase
        .from('students')
        .update({ parent_id: parentId })
        .eq('id', studentId);
    }

    // Atualizar status da solicitação
    await supabase
      .from('link_requests')
      .update({ 
        status: approve ? 'approved' : 'rejected',
        responded_at: new Date().toISOString()
      })
      .eq('id', requestId);

    Alert.alert('Sucesso', approve ? 'Vínculo aprovado!' : 'Solicitação rejeitada');
    fetchLinkRequests();
  } catch (error) {
    console.error('Erro ao processar solicitação:', error);
    Alert.alert('Erro', 'Não foi possível processar a solicitação');
  }
};

      // Para cada notificação, buscar dados do estudante e pai separadamente
      const notificationsWithDetails = await Promise.all(
        (data || []).map(async (notification) => {
          // Buscar dados do estudante
          const { data: student } = await supabase
            .from('students')
            .select('name')
            .eq('id', notification.student_id)
            .single();

          // Buscar dados do pai
          const { data: parent } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', notification.parent_id)
            .single();

          return {
            ...notification,
            students: student || { name: 'Aluno não encontrado' },
            profiles: parent || { name: 'Responsável não encontrado' }
          };
        })
      );

      console.log('Notifications with details:', notificationsWithDetails);
      setNotifications(notificationsWithDetails);
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
      // Não mostrar erro para notificações, pode não ter dados
      setNotifications([]);
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
      const { data, error } = await supabase
        .from('classes')
        .insert([{
          name: newClassName.trim(),
          teacher_id: user.id,
          school_year: schoolYear
        }])
        .select();

      if (error) throw error;

      if (data) {
        // Adicionar à lista local com enrollments vazio
        const newClass = { ...data[0], enrollments: [] };
        setClasses([newClass, ...classes]);
        setNewClassName('');
        setModalVisible(false);
        Alert.alert('Sucesso', 'Turma criada com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao criar turma:', error);
      Alert.alert('Erro', 'Não foi possível criar a turma');
    }
  };

  const confirmPickup = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('pickup_notifications')
        .update({ status: 'confirmed' })
        .eq('id', notificationId);

      if (error) throw error;

      // Remover da lista local
      setNotifications(notifications.filter(n => n.id !== notificationId));
      Alert.alert('Sucesso', 'Busca confirmada!');
    } catch (error) {
      console.error('Erro ao confirmar busca:', error);
      Alert.alert('Erro', 'Não foi possível confirmar a busca');
    }
  };

  const rejectPickup = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('pickup_notifications')
        .update({ status: 'cancelled' })
        .eq('id', notificationId);

      if (error) throw error;

      // Remover da lista local
      setNotifications(notifications.filter(n => n.id !== notificationId));
      Alert.alert('Busca recusada', 'A solicitação foi recusada.');
    } catch (error) {
      console.error('Erro ao recusar busca:', error);
      Alert.alert('Erro', 'Não foi possível recusar a busca');
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

  const renderClassCard = (classItem) => {
    const studentCount = classItem.enrollments?.length || 0;

    return (
      <TouchableOpacity 
        key={classItem.id} 
        style={styles.classCard}
        onPress={() => navigation.navigate('ClassDetails', {
          classId: classItem.id,
          className: classItem.name
        })}
      >
        <View style={styles.classHeader}>
          <View style={styles.classIcon}>
            <Ionicons name="school" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.classInfo}>
            <Text style={styles.className}>{classItem.name}</Text>
            <Text style={styles.classYear}>Ano: {classItem.school_year}</Text>
            {classItem.school_unit && (
              <Text style={styles.schoolUnit}>{classItem.school_unit}</Text>
            )}
          </View>
          <View style={styles.studentCount}>
            <Text style={styles.studentCountNumber}>{studentCount}</Text>
            <Text style={styles.studentCountLabel}>alunos</Text>
          </View>
        </View>

        <View style={styles.classActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="people" size={16} color={theme.colors.primary} />
            <Text style={styles.actionButtonText}>Ver Alunos</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
            <Text style={styles.actionButtonText}>Chamada</Text>
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
            {notification.profiles?.name || 'Responsável'}
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Prof. {profile?.name}! 👩‍🏫</Text>
            <Text style={styles.subGreeting}>Gerencie suas turmas</Text>
          </View>
          <TouchableOpacity style={styles.profileButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Conteúdo */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
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
            <Text style={styles.summaryNumber}>{notifications.length}</Text>
            <Text style={styles.summaryLabel}>Pendentes</Text>
          </View>
        </View>

        {/* Notificações pendentes */}
        {notifications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notificações Pendentes</Text>
            {notifications.map(renderNotificationCard)}
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
            </View>
          ) : (
            <View>
              {classes.map(renderClassCard)}
            </View>
          )}
        </View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  subGreeting: {
    color: 'white',
    opacity: 0.9,
    marginTop: 4,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
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
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  actionButtonText: {
    color: theme.colors.text.secondary,
    fontSize: 14,
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
});