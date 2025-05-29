import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Platform,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { theme } from '../styles/theme';

export default function ParentDashboard({ navigation }) {
  const { signOut, profile, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      console.log('Buscando filhos do responsável:', user.id);
      
      // Buscar filhos do responsável logado
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('parent_id', user.id)
        .eq('active', true);

      if (studentsError) {
        console.error('Erro ao buscar estudantes:', studentsError);
        throw studentsError;
      }

      console.log('Filhos encontrados:', studentsData);

      if (!studentsData || studentsData.length === 0) {
        console.log('Nenhum filho encontrado');
        setStudents([]);
        return;
      }

      const studentsWithDetails = await Promise.all(
        studentsData.map(async (student) => {
          try {
            const { data: enrollment, error: enrollmentError } = await supabase
              .from('enrollments')
              .select('class_id, status')
              .eq('student_id', student.id)
              .eq('status', 'active')
              .single();

            if (enrollmentError) {
              console.log('Erro ao buscar matrícula para', student.name, ':', enrollmentError);
              return {
                ...student,
                className: 'Sem turma',
                teacherName: 'Sem professor',
                teacherId: null,
                attendanceStatus: 'inactive',
                classId: null
              };
            }

            // Buscar dados da turma
            const { data: classData, error: classError } = await supabase
              .from('classes')
              .select('id, name, teacher_id, school_year')
              .eq('id', enrollment.class_id)
              .single();

            if (classError) {
              console.log('Erro ao buscar turma:', classError);
              return {
                ...student,
                className: 'Sem turma',
                teacherName: 'Sem professor',
                teacherId: null,
                attendanceStatus: enrollment.status || 'active',
                classId: null
              };
            }

            // Buscar dados do professor
            const { data: teacherData, error: teacherError } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', classData.teacher_id)
              .single();

            return {
              ...student,
              className: classData.name,
              schoolYear: classData.school_year,
              teacherName: teacherData?.name || 'Professor não encontrado',
              teacherId: classData.teacher_id,
              attendanceStatus: enrollment.status || 'active',
              classId: classData.id
            };

          } catch (error) {
            console.error('Erro ao processar estudante:', error);
            return {
              ...student,
              className: 'Erro ao carregar',
              teacherName: 'Erro ao carregar',
              teacherId: null,
              attendanceStatus: 'inactive',
              classId: null
            };
          }
        })
      );

      console.log('Estudantes com detalhes:', studentsWithDetails);
      setStudents(studentsWithDetails);

    } catch (error) {
      console.error('Erro geral ao buscar estudantes:', error);
      Alert.alert('Erro', `Não foi possível carregar os dados dos filhos: ${error.message}`);
      setStudents([]);
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
    if (!student.teacherId || !student.classId) {
      Alert.alert('Erro', 'Não foi possível enviar notificação. Dados do professor não encontrados.');
      return;
    }

    Alert.alert(
      'Notificar Busca',
      `Deseja notificar o(a) professor(a) ${student.teacherName} que irá buscar ${student.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              setSendingNotification(student.id);
              
              const { error } = await supabase
                .from('pickup_notifications')
                .insert({
                  student_id: student.id,
                  parent_id: user.id,
                  teacher_id: student.teacherId,
                  pickup_time: new Date().toISOString(),
                  reason: 'Busca solicitada pelo responsável',
                  status: 'pending'
                });

              if (error) {
                console.error('Erro ao enviar notificação:', error);
                throw error;
              }

              Alert.alert(
                'Sucesso!', 
                `Notificação enviada para ${student.teacherName}. O professor será avisado que você irá buscar ${student.name}.`
              );
            } catch (error) {
              console.error('Erro ao enviar notificação:', error);
              Alert.alert('Erro', 'Não foi possível enviar a notificação. Tente novamente.');
            } finally {
              setSendingNotification(null);
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return theme.colors.success;
      case 'absent': return theme.colors.error;
      case 'active': return theme.colors.primary;
      default: return theme.colors.text.light;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'present': return 'Presente';
      case 'absent': return 'Ausente';
      case 'active': return 'Ativo';
      default: return 'Inativo';
    }
  };

  const renderStudentCard = (student) => {
    return (
      <View key={student.id} style={styles.childCard}>
        <View style={styles.childHeader}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={28} color={theme.colors.primary} />
          </View>
          <View style={styles.childInfo}>
            <Text style={styles.childName}>{student.name}</Text>
            <Text style={styles.className}>
              <Ionicons name="school" size={14} color={theme.colors.text.secondary} />
              {' '}Turma: {student.className}
            </Text>
            <Text style={styles.teacherName}>
              <Ionicons name="person-circle" size={14} color={theme.colors.text.secondary} />
              {' '}Prof: {student.teacherName}
            </Text>
            {student.schoolYear && (
              <Text style={styles.schoolYear}>
                <Ionicons name="calendar" size={14} color={theme.colors.text.light} />
                {' '}Ano: {student.schoolYear}
              </Text>
            )}
          </View>
          <View style={styles.statusContainer}>
            <View style={[
              styles.statusBadge, 
              { backgroundColor: getStatusColor(student.attendanceStatus) }
            ]}>
              <Text style={styles.statusText}>{getStatusText(student.attendanceStatus)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryAction]}
            onPress={() => sendPickupNotification(student)}
            disabled={sendingNotification === student.id || !student.teacherId}
          >
            {sendingNotification === student.id ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="car" size={18} color="white" />
            )}
            <Text style={styles.primaryActionText}>
              {sendingNotification === student.id ? 'Enviando...' : 'Notificar Busca'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.secondaryAction]}
            onPress={() => {
              Alert.alert('Em breve', 'Histórico de presença será implementado em breve!');
            }}
          >
            <Ionicons name="calendar" size={18} color={theme.colors.text.secondary} />
            <Text style={styles.secondaryActionText}>Ver Histórico</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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
              Olá, {profile?.name}! 👋
            </Text>
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
        showsVerticalScrollIndicator={false}
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
              {students.filter(s => s.attendanceStatus === 'present').length}
            </Text>
            <Text style={styles.summaryLabel}>Presentes</Text>
          </View>

          <View style={styles.summaryCard}>
            <Ionicons name="school" size={24} color={theme.colors.secondary} />
            <Text style={styles.summaryNumber}>
              {students.filter(s => s.classId).length}
            </Text>
            <Text style={styles.summaryLabel}>Matriculados</Text>
          </View>
        </View>

        {/* Lista de filhos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meus Filhos</Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Carregando dados dos filhos...</Text>
            </View>
          ) : students.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={theme.colors.text.light} />
              <Text style={styles.emptyStateTitle}>Nenhum filho cadastrado</Text>
              <Text style={styles.emptyStateText}>
                Entre em contato com a escola para cadastrar seus filhos ou verifique se eles já foram vinculados pelo professor.
              </Text>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={onRefresh}
              >
                <Ionicons name="refresh" size={20} color="white" />
                <Text style={styles.refreshButtonText}>Atualizar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            students.map(renderStudentCard)
          )}
        </View>

        {/* Ações rápidas */}
        {students.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ações Rápidas</Text>
            
            <View style={styles.quickActions}>
              <TouchableOpacity 
                style={styles.quickActionCard}
                onPress={() => {
                  if (students.length === 1) {
                    sendPickupNotification(students[0]);
                  } else {
                    Alert.alert(
                      'Escolher Filho',
                      'Para qual filho você gostaria de enviar notificação de busca?',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        ...students.map(student => ({
                          text: student.name,
                          onPress: () => sendPickupNotification(student)
                        }))
                      ]
                    );
                  }
                }}
              >
                <Ionicons name="car" size={32} color={theme.colors.primary} />
                <Text style={styles.quickActionText}>Notificar Busca</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.quickActionCard}
                onPress={() => onRefresh()}
              >
                <Ionicons name="refresh-circle" size={32} color={theme.colors.success} />
                <Text style={styles.quickActionText}>Atualizar Dados</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.quickActionCard}
                onPress={() => {
                  Alert.alert('Em breve', 'Chat com professores será implementado em breve!');
                }}
              >
                <Ionicons name="chatbubbles" size={32} color={theme.colors.secondary} />
                <Text style={styles.quickActionText}>Chat Professor</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Espaço extra no final para scroll confortável */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
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
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  className: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 2,
  },
  teacherName: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 2,
  },
  schoolYear: {
    fontSize: 12,
    color: theme.colors.text.light,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  },
  primaryAction: {
    backgroundColor: theme.colors.primary,
  },
  secondaryAction: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  primaryActionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryActionText: {
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
    marginTop: theme.spacing.md,
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
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  bottomSpacing: {
    height: theme.spacing.xl,
  },
});