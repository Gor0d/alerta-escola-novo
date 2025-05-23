import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { theme } from '../styles/theme';

export default function ParentDashboard({ navigation }) {
  const { signOut, profile, user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
  try {
    setLoading(true);
    
    // Query corrigida - buscar estudantes com suas matrículas e turmas
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('parent_id', user.id)
      .eq('active', true);

    if (studentsError) throw studentsError;

    // Para cada estudante, buscar suas matrículas e turmas
    const studentsWithEnrollments = await Promise.all(
      (studentsData || []).map(async (student) => {
        const { data: enrollments, error: enrollmentError } = await supabase
          .from('enrollments')
          .select(`
            id,
            status,
            classes (
              id,
              name,
              teacher_id,
              profiles (
                name
              )
            )
          `)
          .eq('student_id', student.id);

        if (enrollmentError) {
          console.error('Erro ao buscar matrículas:', enrollmentError);
          return { ...student, enrollments: [] };
        }

        return { ...student, enrollments: enrollments || [] };
      })
    );

    console.log('Students with enrollments:', studentsWithEnrollments);
    setStudents(studentsWithEnrollments);
  } catch (error) {
    console.error('Erro ao buscar estudantes:', error);
    Alert.alert('Erro', 'Não foi possível carregar os dados dos estudantes');
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents();
  };

  const sendPickupNotification = async (student) => {
    // Encontrar a turma ativa do aluno
    const activeEnrollment = student.enrollments?.find(e => e.status === 'active');
    
    if (!activeEnrollment) {
      Alert.alert('Erro', 'Aluno não está matriculado em nenhuma turma ativa');
      return;
    }

    Alert.alert(
      'Notificar Busca',
      `Deseja notificar o professor que irá buscar ${student.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('pickup_notifications')
                .insert({
                  student_id: student.id,
                  parent_id: user.id,
                  teacher_id: activeEnrollment.classes.teacher_id,
                  pickup_time: new Date().toISOString(),
                  reason: 'Busca solicitada pelo responsável'
                });

              if (error) throw error;

              Alert.alert('Sucesso', 'Notificação enviada para o professor!');
            } catch (error) {
              console.error('Erro ao enviar notificação:', error);
              Alert.alert('Erro', 'Não foi possível enviar a notificação');
            }
          }
        }
      ]
    );
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

  const renderStudentCard = (student) => {
    const activeEnrollment = student.enrollments?.find(e => e.status === 'active');
    const className = activeEnrollment?.classes?.name || 'Sem turma';
    const teacherName = activeEnrollment?.classes?.profiles?.name || 'Professor não definido';

    return (
      <View key={student.id} style={styles.childCard}>
        <View style={styles.childHeader}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.childInfo}>
            <Text style={styles.childName}>{student.name}</Text>
            <Text style={styles.className}>Turma: {className}</Text>
            <Text style={styles.teacherName}>Prof: {teacherName}</Text>
          </View>
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, styles.presentBadge]}>
              <Text style={styles.statusText}>Presente</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => sendPickupNotification(student)}
          >
            <Ionicons name="car" size={20} color={theme.colors.primary} />
            <Text style={styles.actionButtonText}>Notificar Busca</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="calendar" size={20} color={theme.colors.text.secondary} />
            <Text style={styles.actionButtonText}>Ver Presença</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Olá, {profile?.name}! 👋</Text>
            <Text style={styles.subGreeting}>Acompanhe seus filhos</Text>
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
            <Ionicons name="people" size={24} color={theme.colors.primary} />
            <Text style={styles.summaryNumber}>{students.length}</Text>
            <Text style={styles.summaryLabel}>Filhos</Text>
          </View>

          <View style={styles.summaryCard}>
            <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
            <Text style={styles.summaryNumber}>
              {students.filter(s => s.enrollments?.some(e => e.status === 'active')).length}
            </Text>
            <Text style={styles.summaryLabel}>Presentes</Text>
          </View>

          <View style={styles.summaryCard}>
            <Ionicons name="notifications" size={24} color={theme.colors.warning} />
            <Text style={styles.summaryNumber}>0</Text>
            <Text style={styles.summaryLabel}>Alertas</Text>
          </View>
        </View>

        {/* Lista de filhos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meus Filhos</Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Carregando...</Text>
            </View>
          ) : students.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={theme.colors.text.light} />
              <Text style={styles.emptyStateTitle}>Nenhum filho cadastrado</Text>
              <Text style={styles.emptyStateText}>
                Entre em contato com a escola para cadastrar seus filhos
              </Text>
            </View>
          ) : (
            students.map(renderStudentCard)
          )}
        </View>

        {/* Ações rápidas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ações Rápidas</Text>
          
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickActionCard}>
              <Ionicons name="chatbubbles" size={32} color={theme.colors.primary} />
              <Text style={styles.quickActionText}>Chat com Professor</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionCard}>
              <Ionicons name="calendar" size={32} color={theme.colors.secondary} />
              <Text style={styles.quickActionText}>Histórico</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionCard}>
              <Ionicons name="settings" size={32} color={theme.colors.text.secondary} />
              <Text style={styles.quickActionText}>Configurações</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
    ...theme.shadows.small,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  childCard: {
    backgroundColor: 'white',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.small,
  },
  childHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  className: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  teacherName: {
    fontSize: 12,
    color: theme.colors.text.light,
    marginTop: 2,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  presentBadge: {
    backgroundColor: theme.colors.success,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  cardActions: {
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
  quickActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    ...theme.shadows.small,
  },
  quickActionText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
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
});