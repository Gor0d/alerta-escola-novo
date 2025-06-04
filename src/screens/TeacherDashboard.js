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
import { useNotifications } from '../contexts/NotificationContext';
import { NotificationBadge } from '../components/NotificationBadge';
import { supabase } from '../services/supabase';
import { theme } from '../styles/theme';

export default function TeacherDashboard({ navigation }) {
  const { signOut, profile, user } = useAuth();
  const { unreadCount, notifications: contextNotifications, respondToPickup } = useNotifications();
  const insets = useSafeAreaInsets();
  
  const [classes, setClasses] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [schoolYear, setSchoolYear] = useState('2025');

  const [recentAnnouncements, setRecentAnnouncements] = useState([]);
  const [canteenSummary, setCanteenSummary] = useState({
    totalSales: 0,
    pendingPayments: 0,
    todayTransactions: 0
  });
  const [quickStats, setQuickStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    pendingPickups: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (contextNotifications) {
      const pendingNotifications = contextNotifications.filter(n => n.status === 'pending');
      setNotifications(pendingNotifications);
    }
  }, [contextNotifications]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchClasses(),
        fetchRecentAnnouncements(),
        fetchCanteenSummary(),
        fetchQuickStats()
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
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const classesWithStudentCount = await Promise.all(
        (data || []).map(async (classItem) => {
          const { count, error: countError } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', classItem.id);

          if (countError) {
            console.error('Erro ao contar alunos:', countError);
            return { ...classItem, enrollments: [] };
          }

          const mockEnrollments = Array.from({ length: count || 0 }, (_, i) => ({ id: i }));
          return { ...classItem, enrollments: mockEnrollments };
        })
      );

      setClasses(classesWithStudentCount);
    } catch (error) {
      console.error('Erro ao buscar turmas:', error);
      Alert.alert('Erro', 'Não foi possível carregar suas turmas');
      setClasses([]);
    }
  };

  const fetchRecentAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .eq('author_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      setRecentAnnouncements(data || []);
    } catch (error) {
      console.error('Erro ao buscar avisos:', error);
      setRecentAnnouncements([]);
    }
  };

  const fetchCanteenSummary = async () => {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: bills, error: billsError } = await supabase
        .from('canteen_bills')
        .select('total_amount')
        .gte('created_at', startOfMonth.toISOString())
        .neq('status', 'paid');

      if (billsError) throw billsError;

      const { data: consumptions, error: consumptionsError } = await supabase
        .from('canteen_consumption')
        .select('total_price, consumed_at')
        .gte('consumed_at', startOfMonth.toISOString());

      if (consumptionsError) throw consumptionsError;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: todayConsumptions, error: todayError } = await supabase
        .from('canteen_consumption')
        .select('id')
        .gte('consumed_at', today.toISOString())
        .lt('consumed_at', tomorrow.toISOString());

      if (todayError) throw todayError;

      const totalSales = consumptions?.reduce((sum, c) => sum + (c.total_price || 0), 0) || 0;
      const pendingPayments = bills?.reduce((sum, bill) => sum + (bill.total_amount || 0), 0) || 0;

      setCanteenSummary({
        totalSales,
        pendingPayments,
        todayTransactions: todayConsumptions?.length || 0
      });
    } catch (error) {
      console.error('Erro ao buscar resumo da cantina:', error);
      setCanteenSummary({ totalSales: 0, pendingPayments: 0, todayTransactions: 0 });
    }
  };

  const fetchQuickStats = async () => {
    try {
      const classIds = classes.map(c => c.id);
      
      if (classIds.length === 0) {
        setQuickStats({ totalStudents: 0, presentToday: 0, pendingPickups: unreadCount });
        return;
      }

      const { count: totalStudents } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .in('class_id', classIds);

      const today = new Date().toISOString().split('T')[0];
      const { count: presentToday } = await supabase
        .from('attendances')
        .select('*', { count: 'exact', head: true })
        .in('class_id', classIds)
        .eq('date', today)
        .eq('status', 'present');

      setQuickStats({
        totalStudents: totalStudents || 0,
        presentToday: presentToday || 0,
        pendingPickups: unreadCount
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      setQuickStats({ totalStudents: 0, presentToday: 0, pendingPickups: unreadCount });
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
          school_year: schoolYear,
          school_unit: profile?.school_unit
        }])
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
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
    
    Alert.alert(
      'Excluir Turma',
      `Tem certeza que deseja excluir a turma "${classToDelete.name}"?` +
      (studentCount > 0 ? `\n\nEsta turma possui ${studentCount} aluno${studentCount > 1 ? 's' : ''} matriculado${studentCount > 1 ? 's' : ''}.` : ''),
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () => confirmDeleteClass(classToDelete)
        }
      ]
    );
  };

  const confirmDeleteClass = async (classToDelete) => {
    try {
      // 1. Excluir frequências
      await supabase
        .from('attendances')
        .delete()
        .eq('class_id', classToDelete.id);

      // 2. Excluir notificações relacionadas
      await supabase
        .from('pickup_notifications')
        .delete()
        .eq('class_id', classToDelete.id);

      // 3. Excluir matrículas
      await supabase
        .from('enrollments')
        .delete()
        .eq('class_id', classToDelete.id);

      // 4. Excluir turma
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classToDelete.id);

      if (error) throw error;

      setClasses(classes.filter(c => c.id !== classToDelete.id));
      Alert.alert('Sucesso', `Turma "${classToDelete.name}" excluída!`);
    } catch (error) {
      console.error('Erro ao excluir turma:', error);
      Alert.alert('Erro', 'Não foi possível excluir a turma: ' + error.message);
    }
  };

  const confirmPickup = async (notificationId) => {
    try {
      await respondToPickup(notificationId, true, 'Autorizado pelo professor');
    } catch (error) {
      console.error('Erro ao confirmar busca:', error);
      Alert.alert('Erro', 'Não foi possível confirmar a busca. Tente novamente.');
    }
  };

  const rejectPickup = async (notificationId) => {
    try {
      await respondToPickup(notificationId, false, 'Negado pelo professor');
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
          onPress: async () => await signOut(),
          style: 'destructive' 
        }
      ]
    );
  };

  const handleCreateAnnouncement = () => {
    navigation.navigate('NoticeBoardScreen', { userRole: 'teacher' });
  };

  const handleCanteenManagement = () => {
    navigation.navigate('CanteenManagementScreen', { userRole: 'teacher' });
  };

  const handleViewAllAnnouncements = () => {
    navigation.navigate('NoticeBoardScreen', { userRole: 'teacher' });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderClassCard = (classItem) => {
    const studentCount = classItem.enrollments?.length || 0;

    return (
      <TouchableOpacity 
        key={classItem.id} 
        style={styles.classCard}
        onPress={() => {
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
              e.stopPropagation();
              navigation.navigate('ClassDetails', {
                classId: classItem.id,
                className: classItem.name
              });
            }}
          >
            <Ionicons name="list" size={20} color={theme.colors.primary} />
            <Text style={styles.actionButtonText}>Chamada</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              Alert.alert('Em breve', 'Funcionalidade de mensagens será implementada!');
            }}
          >
            <Ionicons name="chatbubbles" size={20} color={theme.colors.text.secondary} />
            <Text style={styles.actionButtonText}>Chat</Text>
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
    return (
      <View key={notification.id} style={styles.notificationCard}>
        <View style={styles.notificationHeader}>
          <Ionicons name="car" size={20} color={theme.colors.warning} />
          <Text style={styles.notificationTitle}>Solicitação de Busca</Text>
          <Text style={styles.notificationTime}>
            {formatDate(notification.created_at)}
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

  const renderAnnouncementCard = (notice) => {
    return (
      <View key={notice.id} style={styles.announcementCard}>
        <View style={styles.announcementHeader}>
          <Ionicons 
            name={notice.type === 'urgent' ? 'alert-circle' : 'megaphone'} 
            size={18} 
            color={notice.type === 'urgent' ? theme.colors.error : theme.colors.primary} 
          />
          <Text style={styles.announcementTitle} numberOfLines={1}>
            {notice.title}
          </Text>
          <Text style={styles.announcementDate}>
            {formatDate(notice.created_at)}
          </Text>
        </View>
        <Text style={styles.announcementContent} numberOfLines={2}>
          {notice.content}
        </Text>
        {notice.class_id && (
          <Text style={styles.announcementClass}>
            Para turma específica
          </Text>
        )}
      </View>
    );
  };

  const totalStudents = classes.reduce((total, c) => total + (c.enrollments?.length || 0), 0);

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
              Prof. {profile?.name}! 👩‍🏫
            </Text>
            <Text style={styles.subGreeting}>Universo do Saber - Área do Professor</Text>
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

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Ações Rápidas</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={handleCreateAnnouncement}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#e0f2fe' }]}>
                <Ionicons name="megaphone" size={24} color="#0284c7" />
              </View>
              <Text style={styles.quickActionText}>Criar Aviso</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={handleCanteenManagement}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#f0fdf4' }]}>
                <Ionicons name="restaurant" size={24} color="#16a34a" />
              </View>
              <Text style={styles.quickActionText}>Cantina</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('Notifications')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="notifications" size={24} color="#d97706" />
              </View>
              <Text style={styles.quickActionText}>Notificações</Text>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => setModalVisible(true)}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#f3e8ff' }]}>
                <Ionicons name="add-circle" size={24} color="#9333ea" />
              </View>
              <Text style={styles.quickActionText}>Nova Turma</Text>
            </TouchableOpacity>
          </View>
        </View>

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
            <Ionicons name="card" size={24} color="#16a34a" />
            <Text style={[styles.summaryNumber, { fontSize: 14 }]}>
              {formatCurrency(canteenSummary.totalSales)}
            </Text>
            <Text style={styles.summaryLabel}>Vendas</Text>
          </View>

          <View style={styles.summaryCard}>
            <Ionicons name="notifications" size={24} color={theme.colors.warning} />
            <Text style={styles.summaryNumber}>{unreadCount}</Text>
            <Text style={styles.summaryLabel}>Pendentes</Text>
          </View>
        </View>

        {recentAnnouncements.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Meus Avisos Recentes</Text>
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={handleViewAllAnnouncements}
              >
                <Text style={styles.viewAllText}>Ver Todos</Text>
              </TouchableOpacity>
            </View>
            {recentAnnouncements.map(renderAnnouncementCard)}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Resumo da Cantina</Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={handleCanteenManagement}
            >
              <Text style={styles.viewAllText}>Gerenciar</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.canteenSummaryCard}>
            <View style={styles.canteenStats}>
              <View style={styles.canteenStat}>
                <Text style={styles.canteenStatValue}>
                  {formatCurrency(canteenSummary.totalSales)}
                </Text>
                <Text style={styles.canteenStatLabel}>Vendas do Mês</Text>
              </View>
              
              <View style={styles.canteenStat}>
                <Text style={[styles.canteenStatValue, { color: '#dc2626' }]}>
                  {formatCurrency(canteenSummary.pendingPayments)}
                </Text>
                <Text style={styles.canteenStatLabel}>A Receber</Text>
              </View>
              
              <View style={styles.canteenStat}>
                <Text style={styles.canteenStatValue}>
                  {canteenSummary.todayTransactions}
                </Text>
                <Text style={styles.canteenStatLabel}>Vendas Hoje</Text>
              </View>
            </View>
          </View>
        </View>

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
            {notifications.slice(0, 3).map(renderNotificationCard)}
          </View>
        )}

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

        <View style={styles.bottomSpacing} />
      </ScrollView>

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
  quickActionsContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  quickActionCard: {
    flex: 1,
    minWidth: '45%',
    maxWidth: '48%',
    backgroundColor: 'white',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    position: 'relative',
  },
  quickActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
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
  announcementCard: {
    backgroundColor: 'white',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  announcementTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  announcementDate: {
    fontSize: 12,
    color: theme.colors.text.light,
  },
  announcementContent: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    lineHeight: 18,
  },
  announcementClass: {
    fontSize: 12,
    color: theme.colors.primary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  canteenSummaryCard: {
    backgroundColor: 'white',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  canteenStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  canteenStat: {
    flex: 1,
    alignItems: 'center',
  },
  canteenStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  canteenStatLabel: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
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
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
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