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
import { useNotifications } from '../contexts/NotificationContext'; // NOVO
import { NotificationBadge } from '../components/NotificationBadge'; // NOVO
import { supabase } from '../services/supabase';
import { theme } from '../styles/theme';

export default function ParentDashboard({ navigation }) {
  const { signOut, profile, user } = useAuth();
  const { sendPickupNotification: sendNotification, unreadCount } = useNotifications(); // NOVO
  const insets = useSafeAreaInsets();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(null);

useEffect(() => {
  fetchStudents();
}, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      console.log('=== BUSCANDO FILHOS DO RESPONSÁVEL ===');
      console.log('Parent ID:', user.id);
      
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

      console.log('✅ Filhos encontrados:', studentsData);

      if (!studentsData || studentsData.length === 0) {
        console.log('Nenhum filho encontrado');
        setStudents([]);
        return;
      }

      const studentsWithDetails = await Promise.all(
        studentsData.map(async (student) => {
          try {
            console.log(`=== PROCESSANDO ALUNO: ${student.name} ===`);
            
            // CORREÇÃO: Buscar enrollment sem filtrar por status específico
            // Aceitar qualquer status válido de matrícula
            const { data: enrollment, error: enrollmentError } = await supabase
              .from('enrollments')
              .select('class_id, status')
              .eq('student_id', student.id)
              // REMOVIDO: .eq('status', 'active') 
              // ADICIONADO: Filtro mais amplo para status válidos
              .in('status', ['active', 'present', 'absent', 'enrolled'])
              .single();

            if (enrollmentError) {
              console.log(`❌ Erro ao buscar matrícula para ${student.name}:`, enrollmentError);
              
              // Tentar buscar qualquer enrollment, independente do status
              const { data: anyEnrollment, error: anyError } = await supabase
                .from('enrollments')
                .select('class_id, status')
                .eq('student_id', student.id)
                .limit(1)
                .single();
              
              if (anyError || !anyEnrollment) {
                console.log(`❌ Nenhuma matrícula encontrada para ${student.name}`);
                return {
                  ...student,
                  className: 'Sem turma',
                  teacherName: 'Sem professor',
                  teacherId: null,
                  attendanceStatus: 'inactive',
                  classId: null,
                  canDelete: true // NOVO: Permitir exclusão quando não tem turma
                };
              }
              
              console.log(`⚠️ Matrícula encontrada com status: ${anyEnrollment.status}`);
              // Usar a matrícula encontrada, mesmo com status diferente
              enrollment = anyEnrollment;
            }

            console.log(`✅ Matrícula encontrada para ${student.name}:`, enrollment);

            // Buscar dados da turma
            const { data: classData, error: classError } = await supabase
              .from('classes')
              .select('id, name, teacher_id, school_year')
              .eq('id', enrollment.class_id)
              .single();

            if (classError) {
              console.log(`❌ Erro ao buscar turma:`, classError);
              return {
                ...student,
                className: 'Sem turma',
                teacherName: 'Sem professor',
                teacherId: null,
                attendanceStatus: enrollment.status || 'active',
                classId: null,
                canDelete: true // NOVO: Permitir exclusão quando não tem turma válida
              };
            }

            console.log(`✅ Turma encontrada:`, classData);

            // Buscar dados do professor
            const { data: teacherData, error: teacherError } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', classData.teacher_id)
              .single();

            if (teacherError) {
              console.log(`❌ Erro ao buscar professor:`, teacherError);
            }

            const result = {
              ...student,
              className: classData.name,
              schoolYear: classData.school_year,
              teacherName: teacherData?.name || 'Professor não encontrado',
              teacherId: classData.teacher_id,
              attendanceStatus: enrollment.status || 'active',
              classId: classData.id,
              canDelete: false // NOVO: NÃO permitir exclusão quando tem turma ativa
            };

            console.log(`✅ Dados finais para ${student.name}:`, result);
            return result;

          } catch (error) {
            console.error(`❌ Erro ao processar estudante ${student.name}:`, error);
            return {
              ...student,
              className: 'Erro ao carregar',
              teacherName: 'Erro ao carregar',
              teacherId: null,
              attendanceStatus: 'inactive',
              classId: null,
              canDelete: true // NOVO: Permitir exclusão em caso de erro
            };
          }
        })
      );

      console.log('=== RESULTADO FINAL ===');
      console.log('Estudantes com detalhes:', studentsWithDetails);
      setStudents(studentsWithDetails);

    } catch (error) {
      console.error('❌ Erro geral ao buscar estudantes:', error);
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

  // FUNÇÃO ATUALIZADA: Usar o hook de notificações
  const sendPickupNotification = async (student) => {
    if (!student.teacherId || !student.classId) {
      Alert.alert('Erro', 'Não foi possível enviar notificação. Dados do professor não encontrados.');
      return;
    }

    // NOVO: Input personalizado para motivo
    Alert.prompt(
      'Notificar Busca',
      `Informe o motivo da busca de ${student.name}:`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async (reason) => {
            try {
              setSendingNotification(student.id);
              
              // USAR o hook de notificações
              await sendNotification(
                student.id, 
                student.teacherId, 
                reason || 'Busca solicitada pelo responsável'
              );

              Alert.alert(
                'Notificação Enviada! 📱', 
                `${student.teacherName} foi notificado sobre a busca de ${student.name}.\n\nVocê receberá uma confirmação quando a solicitação for respondida.`
              );
            } catch (error) {
              console.error('Erro ao enviar notificação:', error);
              Alert.alert('Erro', 'Não foi possível enviar a notificação. Tente novamente.');
            } finally {
              setSendingNotification(null);
            }
          }
        }
      ],
      'plain-text',
      'Consulta médica' // Texto padrão
    );
  };

  // NOVA FUNÇÃO: Excluir aluno do perfil do responsável
  const deleteStudent = async (student) => {
    Alert.alert(
      'Remover Filho',
      `Tem certeza que deseja remover ${student.name} do seu perfil?\n\n⚠️ ATENÇÃO: Esta ação não pode ser desfeita! Você precisará entrar em contato com a escola novamente para re-vincular seu filho.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar Remoção',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingStudent(student.id);
              console.log(`=== REMOVENDO ALUNO ${student.name} ===`);
              
              // PRIMEIRO: Limpar todas as dependências do aluno
              
              // 1. Remover notificações de busca relacionadas ao aluno
              const { error: pickupError } = await supabase
                .from('pickup_notifications')
                .delete()
                .eq('student_id', student.id);
              
              if (pickupError) {
                console.log('Aviso: Erro ao limpar notificações de busca:', pickupError);
                // Não bloquear por isso, continuar tentando outras limpezas
              }
              
              // 2. Remover matrículas (enrollments)
              const { error: enrollmentError } = await supabase
                .from('enrollments')
                .delete()
                .eq('student_id', student.id);
              
              if (enrollmentError) {
                console.log('Aviso: Erro ao limpar matrículas:', enrollmentError);
                // Não bloquear por isso, continuar
              }
              
              // FINALMENTE: Deletar o aluno (agora sem dependências)
              const { error: deleteError } = await supabase
                .from('students')
                .delete()
                .eq('id', student.id)
                .eq('parent_id', user.id); // Garantir que só o responsável pode remover

              if (deleteError) {
                console.error('Erro ao deletar aluno:', deleteError);
                throw deleteError;
              }

              console.log(`✅ Aluno ${student.name} removido com sucesso`);
              
              // Atualizar a lista local (remover da UI)
              setStudents(students.filter(s => s.id !== student.id));

              Alert.alert(
                'Removido!', 
                `${student.name} foi removido do seu perfil.\n\nPara vincular novamente, entre em contato com a escola.`
              );

            } catch (error) {
              console.error('Erro ao remover aluno:', error);
              Alert.alert('Erro', 'Não foi possível remover o aluno. Tente novamente.');
            } finally {
              setDeletingStudent(null);
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
      case 'enrolled': return theme.colors.primary;
      case 'inactive': return theme.colors.text.light;
      case 'removed': return theme.colors.warning;
      default: return theme.colors.text.light;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'present': return 'Presente';
      case 'absent': return 'Ausente';
      case 'active': return 'Ativo';
      case 'enrolled': return 'Matriculado';
      case 'inactive': return 'Sem Turma';
      case 'removed': return 'Desvinculado';
      default: return 'Sem Turma';
    }
  };

  const renderStudentCard = (student) => {
    const hasActiveEnrollment = student.classId && student.teacherId;
    const canDelete = student.canDelete && !hasActiveEnrollment;
    
    return (
      <View key={student.id} style={[
        styles.childCard, 
        !hasActiveEnrollment && styles.childCardInactive
      ]}>
        <View style={styles.childHeader}>
          <View style={[
            styles.avatarContainer,
            !hasActiveEnrollment && styles.avatarContainerInactive
          ]}>
            <Ionicons 
              name={hasActiveEnrollment ? "person" : "person-outline"} 
              size={28} 
              color={hasActiveEnrollment ? theme.colors.primary : theme.colors.text.light} 
            />
          </View>
          <View style={styles.childInfo}>
            <Text style={[
              styles.childName,
              !hasActiveEnrollment && styles.childNameInactive
            ]}>
              {student.name}
            </Text>
            <Text style={[
              styles.className,
              !hasActiveEnrollment && styles.inactiveText
            ]}>
              <Ionicons 
                name={hasActiveEnrollment ? "school" : "school-outline"} 
                size={14} 
                color={hasActiveEnrollment ? theme.colors.text.secondary : theme.colors.text.light} 
              />
              {' '}Turma: {student.className}
            </Text>
            <Text style={[
              styles.teacherName,
              !hasActiveEnrollment && styles.inactiveText
            ]}>
              <Ionicons 
                name={hasActiveEnrollment ? "person-circle" : "person-circle-outline"} 
                size={14} 
                color={hasActiveEnrollment ? theme.colors.text.secondary : theme.colors.text.light} 
              />
              {' '}Prof: {student.teacherName}
            </Text>
            {student.schoolYear && hasActiveEnrollment && (
              <Text style={styles.schoolYear}>
                <Ionicons name="calendar" size={14} color={theme.colors.text.light} />
                {' '}Ano: {student.schoolYear}
              </Text>
            )}
            {!hasActiveEnrollment && (
              <Text style={styles.warningText}>
                <Ionicons name="warning" size={14} color={theme.colors.warning} />
                {' '}Entre em contato com a escola para reativar
              </Text>
            )}
            {/* NOVO: Mostrar que pode ser removido */}
            {canDelete && (
              <Text style={styles.deleteHintText}>
                <Ionicons name="trash-outline" size={12} color={theme.colors.error} />
                {' '}Pode ser removido do perfil
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
            {/* NOVO: Botão de excluir (só para alunos sem turma) */}
            {canDelete && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteStudent(student)}
                disabled={deletingStudent === student.id}
              >
                {deletingStudent === student.id ? (
                  <ActivityIndicator size="small" color={theme.colors.error} />
                ) : (
                  <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[
              styles.actionButton, 
              hasActiveEnrollment ? styles.primaryAction : styles.disabledAction
            ]}
            onPress={() => hasActiveEnrollment ? sendPickupNotification(student) : null}
            disabled={!hasActiveEnrollment || sendingNotification === student.id}
          >
            {sendingNotification === student.id ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons 
                name={hasActiveEnrollment ? "car" : "car-outline"} 
                size={18} 
                color={hasActiveEnrollment ? "white" : theme.colors.text.light} 
              />
            )}
            <Text style={[
              hasActiveEnrollment ? styles.primaryActionText : styles.disabledActionText
            ]}>
              {!hasActiveEnrollment ? 'Sem Turma' : 
               sendingNotification === student.id ? 'Enviando...' : 'Notificar Busca'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.actionButton, 
              hasActiveEnrollment ? styles.secondaryAction : 
              canDelete ? styles.deleteAction : styles.disabledAction
            ]}
            onPress={() => {
              if (hasActiveEnrollment) {
                Alert.alert('Em breve', 'Histórico de presença será implementado em breve!');
              } else if (canDelete) {
                deleteStudent(student);
              } else {
                Alert.alert(
                  'Aluno Sem Turma', 
                  `${student.name} não está matriculado em nenhuma turma.\n\nEntre em contato com a escola para reativar a matrícula.`
                );
              }
            }}
            disabled={deletingStudent === student.id}
          >
            {deletingStudent === student.id ? (
              <ActivityIndicator size="small" color={theme.colors.error} />
            ) : (
              <Ionicons 
                name={hasActiveEnrollment ? "calendar" : 
                      canDelete ? "trash" : "information-circle-outline"} 
                size={18} 
                color={hasActiveEnrollment ? theme.colors.text.secondary : 
                       canDelete ? "white" : theme.colors.text.light} 
              />
            )}
            <Text style={[
              hasActiveEnrollment ? styles.secondaryActionText : 
              canDelete ? styles.deleteActionText : styles.disabledActionText
            ]}>
              {hasActiveEnrollment ? 'Ver Histórico' : 
               canDelete ? 'Remover' : 'Info'}
            </Text>
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
          <Ionicons name="notifications" size={20} color="#f59e0b" />
          <Text style={styles.notificationSummaryText}>
            Você tem {unreadCount} notificação{unreadCount > 1 ? 'ões' : ''} não lida{unreadCount > 1 ? 's' : ''}
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
                  const activeStudents = students.filter(s => s.classId);
                  if (activeStudents.length === 0) {
                    Alert.alert('Aviso', 'Nenhum filho está matriculado em turma ativa.');
                    return;
                  }
                  
                  if (activeStudents.length === 1) {
                    sendPickupNotification(activeStudents[0]);
                  } else {
                    Alert.alert(
                      'Escolher Filho',
                      'Para qual filho você gostaria de enviar notificação de busca?',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        ...activeStudents.map(student => ({
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

              {/* NOVO: Botão para notificações */}
              <TouchableOpacity 
                style={styles.quickActionCard}
                onPress={() => navigation.navigate('Notifications')}
              >
                <View style={styles.quickActionIconContainer}>
                  <Ionicons name="notifications" size={32} color={theme.colors.secondary} />
                  {unreadCount > 0 && <NotificationBadge size="small" />}
                </View>
                <Text style={styles.quickActionText}>Notificações</Text>
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
  childCardInactive: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: theme.colors.border,
    opacity: 0.8,
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
  avatarContainerInactive: {
    backgroundColor: '#e9ecef',
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  childNameInactive: {
    color: theme.colors.text.secondary,
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
  inactiveText: {
    color: theme.colors.text.light,
  },
  warningText: {
    fontSize: 12,
    color: theme.colors.warning,
    marginTop: 4,
    fontStyle: 'italic',
  },
  // NOVO: Estilo para texto de dica de exclusão
  deleteHintText: {
    fontSize: 11,
    color: theme.colors.error,
    marginTop: 2,
    fontStyle: 'italic',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  // NOVO: Botão de exclusão no canto superior direito
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
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
  // NOVO: Estilo para botão de exclusão
  deleteAction: {
    backgroundColor: theme.colors.error,
  },
  disabledAction: {
    backgroundColor: '#e9ecef',
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
  // NOVO: Texto para botão de exclusão
  deleteActionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledActionText: {
    color: theme.colors.text.light,
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
  // NOVO: Container para ícone com badge
  quickActionIconContainer: {
    position: 'relative',
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