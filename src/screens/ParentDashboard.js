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
  StatusBar,
  Clipboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { NotificationBadge } from '../components/NotificationBadge';
import { supabase } from '../services/supabase';
import { theme } from '../styles/theme';

export default function ParentDashboard({ navigation }) {
  const { signOut, profile, user } = useAuth();
  const { sendPickupNotification: sendNotification, unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(null);
  
  // Estados para novas funcionalidades
  const [recentNotices, setRecentNotices] = useState([]);
  const [canteenSummary, setCanteenSummary] = useState({
    totalDebt: 0,
    pendingItems: 0,
    recentConsumptions: []
  });
  const [pixKey, setPixKey] = useState('');

  useEffect(() => {
    fetchStudents();
    fetchRecentNotices();
    fetchCanteenSummary();
    fetchPixKey();
  }, []);

  // Função original do fetchStudents mantida
  const fetchStudents = async () => {
    try {
      setLoading(true);
      console.log('=== BUSCANDO FILHOS DO RESPONSÁVEL ===');
      console.log('Parent ID:', user.id);
      
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
            
            const { data: enrollment, error: enrollmentError } = await supabase
              .from('enrollments')
              .select('class_id, status')
              .eq('student_id', student.id)
              .in('status', ['active', 'present', 'absent', 'enrolled'])
              .single();

            if (enrollmentError) {
              console.log(`❌ Erro ao buscar matrícula para ${student.name}:`, enrollmentError);
              
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
                  canDelete: true
                };
              }
              
              console.log(`⚠️ Matrícula encontrada com status: ${anyEnrollment.status}`);
              enrollment = anyEnrollment;
            }

            console.log(`✅ Matrícula encontrada para ${student.name}:`, enrollment);

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
                canDelete: true
              };
            }

            console.log(`✅ Turma encontrada:`, classData);

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
              canDelete: false
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
              canDelete: true
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

  // NOVA FUNÇÃO: Buscar avisos recentes
  const fetchRecentNotices = async () => {
    try {
      const classIds = students.map(s => s.classId).filter(Boolean);
      
      if (classIds.length === 0) return;

      const { data, error } = await supabase
        .from('notices')
        .select(`
          *,
          author:profiles(name),
          class:classes(name)
        `)
        .or(`class_id.in.(${classIds.join(',')}),class_id.is.null`)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      setRecentNotices(data || []);
    } catch (error) {
      console.error('Erro ao buscar avisos:', error);
    }
  };

  // NOVA FUNÇÃO: Buscar resumo da cantina
  const fetchCanteenSummary = async () => {
    try {
      const studentIds = students.map(s => s.id).filter(Boolean);
      
      if (studentIds.length === 0) return;

      // Buscar faturas pendentes
      const { data: bills, error: billsError } = await supabase
        .from('canteen_bills')
        .select('total_amount')
        .in('student_id', studentIds)
        .neq('status', 'paid');

      if (billsError) throw billsError;

      // Buscar consumos recentes
      const { data: consumptions, error: consumptionsError } = await supabase
        .from('canteen_consumption')
        .select(`
          *,
          student:students(name),
          item:canteen_items(name)
        `)
        .in('student_id', studentIds)
        .eq('payment_status', 'pending')
        .order('consumed_at', { ascending: false })
        .limit(5);

      if (consumptionsError) throw consumptionsError;

      const totalDebt = bills?.reduce((sum, bill) => sum + bill.total_amount, 0) || 0;
      
      setCanteenSummary({
        totalDebt,
        pendingItems: consumptions?.length || 0,
        recentConsumptions: consumptions || []
      });

    } catch (error) {
      console.error('Erro ao buscar resumo da cantina:', error);
    }
  };

  // NOVA FUNÇÃO: Buscar chave PIX
  const fetchPixKey = async () => {
    try {
      const { data, error } = await supabase
        .from('school_settings')
        .select('setting_value')
        .eq('setting_key', 'pix_key')
        .single();
      
      if (error) throw error;
      if (data) setPixKey(data.setting_value);
    } catch (error) {
      console.error('Erro ao buscar chave PIX:', error);
    }
  };

  // NOVA FUNÇÃO: Copiar chave PIX
  const copyPixKey = () => {
    Clipboard.setString(pixKey);
    Alert.alert(
      'PIX Copiado!', 
      `Chave PIX do ${theme.school.shortName} copiada para a área de transferência`
    );
  };

  // Função de refresh atualizada
  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents();
    fetchRecentNotices();
    fetchCanteenSummary();
    fetchPixKey();
  };

  // Funções originais mantidas
  const sendPickupNotification = async (student) => {
    if (!student.teacherId || !student.classId) {
      Alert.alert('Erro', 'Não foi possível enviar notificação. Dados do professor não encontrados.');
      return;
    }

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
      'Consulta médica'
    );
  };

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
              
              const { error: pickupError } = await supabase
                .from('pickup_notifications')
                .delete()
                .eq('student_id', student.id);
              
              if (pickupError) {
                console.log('Aviso: Erro ao limpar notificações de busca:', pickupError);
              }
              
              const { error: enrollmentError } = await supabase
                .from('enrollments')
                .delete()
                .eq('student_id', student.id);
              
              if (enrollmentError) {
                console.log('Aviso: Erro ao limpar matrículas:', enrollmentError);
              }
              
              const { error: deleteError } = await supabase
                .from('students')
                .delete()
                .eq('id', student.id)
                .eq('parent_id', user.id);

              if (deleteError) {
                console.error('Erro ao deletar aluno:', deleteError);
                throw deleteError;
              }

              console.log(`✅ Aluno ${student.name} removido com sucesso`);
              
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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getNoticeTypeColor = (type) => {
    switch (type) {
      case 'urgent': return theme.colors.error;
      case 'event': return theme.colors.success;
      case 'announcement': return theme.colors.warning;
      default: return theme.colors.info;
    }
  };

  // NOVO: Renderizar avisos recentes
  const renderRecentNotices = () => {
    if (recentNotices.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Avisos Recentes</Text>
          <TouchableOpacity 
            onPress={() => navigation.navigate('NoticeBoardScreen', { userRole: 'parent' })}
          >
            <Text style={styles.seeAllText}>Ver todos</Text>
          </TouchableOpacity>
        </View>
        
        {recentNotices.slice(0, 2).map((notice) => (
          <View key={notice.id} style={styles.noticeCard}>
            <View style={styles.noticeHeader}>
              <View style={[
                styles.noticeIcon,
                { backgroundColor: getNoticeTypeColor(notice.type) + '20' }
              ]}>
                <Ionicons 
                  name={notice.type === 'urgent' ? 'warning' : 
                        notice.type === 'event' ? 'calendar' : 'megaphone'} 
                  size={16} 
                  color={getNoticeTypeColor(notice.type)} 
                />
              </View>
              <View style={styles.noticeInfo}>
                <Text style={styles.noticeTitle}>{notice.title}</Text>
                <Text style={styles.noticeAuthor}>
                  Por: {notice.author?.name} • {formatDate(notice.created_at)}
                </Text>
                {notice.class?.name && (
                  <Text style={styles.noticeClass}>Turma: {notice.class.name}</Text>
                )}
              </View>
            </View>
            <Text style={styles.noticeContent} numberOfLines={2}>
              {notice.content}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // NOVO: Renderizar resumo da cantina
  const renderCanteenSummary = () => {
    if (canteenSummary.totalDebt === 0 && canteenSummary.pendingItems === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Cantina</Text>
          <TouchableOpacity 
            onPress={() => navigation.navigate('CanteenManagementScreen', { 
              userRole: 'parent',
              studentId: students[0]?.id 
            })}
          >
            <Text style={styles.seeAllText}>Ver detalhes</Text>
          </TouchableOpacity>
        </View>
        
        {canteenSummary.totalDebt > 0 && (
          <View style={styles.debtCard}>
            <View style={styles.debtInfo}>
              <Text style={styles.debtTitle}>Total a Pagar</Text>
              <Text style={styles.debtAmount}>{formatCurrency(canteenSummary.totalDebt)}</Text>
              <Text style={styles.schoolName}>{theme.school.shortName}</Text>
            </View>
            <TouchableOpacity style={styles.pixButton} onPress={copyPixKey}>
              <Ionicons name="copy" size={16} color={theme.colors.primary} />
              <Text style={styles.pixButtonText}>Copiar PIX</Text>
            </TouchableOpacity>
          </View>
        )}

        {canteenSummary.recentConsumptions.length > 0 && (
          <View style={styles.consumptionsPreview}>
            <Text style={styles.consumptionsTitle}>Consumos Recentes:</Text>
            {canteenSummary.recentConsumptions.slice(0, 3).map((consumption) => (
              <View key={consumption.id} style={styles.consumptionItem}>
                <Text style={styles.consumptionStudent}>{consumption.student?.name}</Text>
                <Text style={styles.consumptionDetails}>
                  {consumption.item?.name} • Qtd: {consumption.quantity}
                </Text>
                <Text style={styles.consumptionPrice}>
                  {formatCurrency(consumption.total_price)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
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
      <StatusBar 
        barStyle="light-content" 
        backgroundColor={theme.colors.primary}
        translucent={false}
      />
      
      <View style={[styles.header, { 
        paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 24) + 12 
      }]}>
        <View style={styles.headerContent}>
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting} numberOfLines={1} adjustsFontSizeToFit>
              Olá, {profile?.name}! 👋
            </Text>
            <Text style={styles.subGreeting}>{theme.school.shortName}</Text>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.notificationButton} 
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={24} color="white" />
              <NotificationBadge />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.profileButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

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

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Resumo rápido atualizado */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Ionicons name="people" size={24} color={theme.colors.primary} />
            <Text style={styles.summaryNumber}>{students.length}</Text>
            <Text style={styles.summaryLabel}>Filhos</Text>
          </View>

          <View style={styles.summaryCard}>
            <Ionicons name="newspaper" size={24} color={theme.colors.success} />
            <Text style={styles.summaryNumber}>{recentNotices.length}</Text>
            <Text style={styles.summaryLabel}>Avisos</Text>
          </View>

          <View style={styles.summaryCard}>
            <Ionicons name="restaurant" size={24} color={theme.colors.warning} />
            <Text style={styles.summaryNumber}>{canteenSummary.pendingItems}</Text>
            <Text style={styles.summaryLabel}>Pendências</Text>
          </View>

          <View style={styles.summaryCard}>
            <Ionicons name="card" size={24} color={theme.colors.error} />
            <Text style={[styles.summaryNumber, { fontSize: 14 }]}>
              {formatCurrency(canteenSummary.totalDebt)}
            </Text>
            <Text style={styles.summaryLabel}>A Pagar</Text>
          </View>
        </View>

        {/* NOVO: Avisos recentes */}
        {renderRecentNotices()}

        {/* NOVO: Resumo da cantina */}
        {renderCanteenSummary()}

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

        {/* Ações rápidas atualizadas */}
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

              {/* NOVO: Botão para mural de avisos */}
              <TouchableOpacity 
                style={styles.quickActionCard}
                onPress={() => navigation.navigate('NoticeBoardScreen', { userRole: 'parent' })}
              >
                <Ionicons name="newspaper" size={32} color={theme.colors.success} />
                <Text style={styles.quickActionText}>Ver Avisos</Text>
              </TouchableOpacity>

              {/* NOVO: Botão para cantina */}
              <TouchableOpacity 
                style={styles.quickActionCard}
                onPress={() => navigation.navigate('CanteenManagementScreen', { 
                  userRole: 'parent',
                  studentId: students[0]?.id 
                })}
              >
                <Ionicons name="restaurant" size={32} color={theme.colors.warning} />
                <Text style={styles.quickActionText}>Cantina</Text>
              </TouchableOpacity>

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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
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
    gap: theme.spacing.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    ...theme.shadows.small,
  },
  summaryNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginTop: theme.spacing.xs,
  },
  summaryLabel: {
    fontSize: 10,
    color: theme.colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  seeAllText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  // NOVOS: Estilos para avisos
  noticeCard: {
    backgroundColor: 'white',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.small,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  noticeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  noticeInfo: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  noticeAuthor: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  noticeClass: {
    fontSize: 12,
    color: theme.colors.primary,
    marginTop: 2,
  },
  noticeContent: {
    fontSize: 14,
    color: theme.colors.text.primary,
    lineHeight: 20,
  },
  // NOVOS: Estilos para cantina
  debtCard: {
    backgroundColor: '#fef3c7',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  debtInfo: {
    flex: 1,
  },
  debtTitle: {
    fontSize: 14,
    color: '#92400e',
    fontWeight: '500',
  },
  debtAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#92400e',
    marginTop: 2,
  },
  schoolName: {
    fontSize: 12,
    color: '#92400e',
    marginTop: 2,
  },
  pixButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
  },
  pixButtonText: {
    marginLeft: 5,
    color: theme.colors.primary,
    fontWeight: '500',
    fontSize: 12,
  },
  consumptionsPreview: {
    backgroundColor: 'white',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.small,
  },
  consumptionsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  consumptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  consumptionStudent: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    flex: 1,
  },
  consumptionDetails: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    flex: 2,
    textAlign: 'center',
  },
  consumptionPrice: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.success,
    flex: 1,
    textAlign: 'right',
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
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  quickActionCard: {
    width: '48%',
    backgroundColor: 'white',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    ...theme.shadows.small,
  },
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