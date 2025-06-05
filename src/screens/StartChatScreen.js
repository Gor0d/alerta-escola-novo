// src/screens/StartChatScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { theme } from '../styles/theme';

export default function StartChatScreen({ route, navigation }) {
  const { userRole, currentUser } = route.params;
  
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [searchText, contacts]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      
      console.log(`👥 Buscando contatos para ${userRole}: ${currentUser?.name}`);

      if (userRole === 'parent') {
        await fetchTeachersForParent();
      } else if (userRole === 'teacher') {
        await fetchParentsForTeacher();
      }

    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
      Alert.alert('Erro', 'Não foi possível carregar os contatos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTeachersForParent = async () => {
    try {
      // Buscar professores dos filhos do responsável
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          name,
          enrollments!inner(
            class_id,
            classes!inner(
              id,
              name,
              teacher_id,
              teacher:profiles!teacher_id(
                id,
                name,
                email
              )
            )
          )
        `)
        .eq('parent_id', currentUser.id);

      if (studentsError) throw studentsError;

      // Processar dados para criar lista de professores únicos
      const teachersMap = new Map();
      
      studentsData?.forEach(student => {
        student.enrollments.forEach(enrollment => {
          const teacher = enrollment.classes.teacher;
          const teacherId = teacher.id;
          
          if (!teachersMap.has(teacherId)) {
            teachersMap.set(teacherId, {
              id: teacherId,
              name: teacher.name,
              email: teacher.email,
              role: 'teacher',
              students: [],
              classes: []
            });
          }
          
          const teacherData = teachersMap.get(teacherId);
          
          // Adicionar aluno se não estiver já na lista
          if (!teacherData.students.find(s => s.id === student.id)) {
            teacherData.students.push({
              id: student.id,
              name: student.name
            });
          }
          
          // Adicionar turma se não estiver já na lista
          if (!teacherData.classes.find(c => c.id === enrollment.classes.id)) {
            teacherData.classes.push({
              id: enrollment.classes.id,
              name: enrollment.classes.name
            });
          }
        });
      });

      const teachersList = Array.from(teachersMap.values());
      console.log(`👨‍🏫 ${teachersList.length} professores encontrados`);
      setContacts(teachersList);

    } catch (error) {
      console.error('Erro ao buscar professores:', error);
      throw error;
    }
  };

  const fetchParentsForTeacher = async () => {
    try {
      // Buscar responsáveis dos alunos das turmas do professor
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          enrollments!inner(
            student_id,
            students!inner(
              id,
              name,
              parent_id,
              parent:profiles!parent_id(
                id,
                name,
                email
              )
            )
          )
        `)
        .eq('teacher_id', currentUser.id);

      if (classesError) throw classesError;

      // Processar dados para criar lista de responsáveis únicos
      const parentsMap = new Map();
      
      classesData?.forEach(classData => {
        classData.enrollments.forEach(enrollment => {
          const student = enrollment.students;
          const parent = student.parent;
          
          if (parent && !parentsMap.has(parent.id)) {
            parentsMap.set(parent.id, {
              id: parent.id,
              name: parent.name,
              email: parent.email,
              role: 'parent',
              students: [],
              classes: []
            });
          }
          
          if (parent) {
            const parentData = parentsMap.get(parent.id);
            
            // Adicionar aluno se não estiver já na lista
            if (!parentData.students.find(s => s.id === student.id)) {
              parentData.students.push({
                id: student.id,
                name: student.name
              });
            }
            
            // Adicionar turma se não estiver já na lista
            if (!parentData.classes.find(c => c.id === classData.id)) {
              parentData.classes.push({
                id: classData.id,
                name: classData.name
              });
            }
          }
        });
      });

      const parentsList = Array.from(parentsMap.values());
      console.log(`👨‍👩‍👧‍👦 ${parentsList.length} responsáveis encontrados`);
      setContacts(parentsList);

    } catch (error) {
      console.error('Erro ao buscar responsáveis:', error);
      throw error;
    }
  };

  const filterContacts = () => {
    if (!searchText.trim()) {
      setFilteredContacts(contacts);
      return;
    }

    const filtered = contacts.filter(contact => 
      contact.name.toLowerCase().includes(searchText.toLowerCase()) ||
      contact.students.some(student => 
        student.name.toLowerCase().includes(searchText.toLowerCase())
      )
    );

    setFilteredContacts(filtered);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchContacts();
  };

  const createOrFindConversation = async (contact, selectedStudent) => {
    try {
      setCreating(true);
      
      console.log(`💬 Criando/buscando conversa com ${contact.name} sobre ${selectedStudent.name}`);

      // Definir IDs baseado no papel do usuário
      const teacherId = userRole === 'teacher' ? currentUser.id : contact.id;
      const parentId = userRole === 'parent' ? currentUser.id : contact.id;

      // Verificar se já existe uma conversa para este trio
      const { data: existingConversation, error: searchError } = await supabase
        .from('conversations')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('parent_id', parentId)
        .eq('student_id', selectedStudent.id)
        .single();

      if (searchError && searchError.code !== 'PGRST116') {
        throw searchError;
      }

      let conversationId;

      if (existingConversation) {
        console.log('📋 Conversa existente encontrada');
        conversationId = existingConversation.id;
      } else {
        console.log('🆕 Criando nova conversa');
        
        const { data: newConversation, error: createError } = await supabase
          .from('conversations')
          .insert([{
            teacher_id: teacherId,
            parent_id: parentId,
            student_id: selectedStudent.id
          }])
          .select()
          .single();

        if (createError) throw createError;
        
        conversationId = newConversation.id;
        console.log('✅ Nova conversa criada');
      }

      // Navegar para o chat
      navigation.navigate('ChatScreen', {
        conversationId: conversationId,
        otherParticipant: contact,
        student: selectedStudent,
        userRole: userRole
      });

    } catch (error) {
      console.error('❌ Erro ao criar conversa:', error);
      Alert.alert('Erro', 'Não foi possível iniciar a conversa. Tente novamente.');
    } finally {
      setCreating(false);
    }
  };

  const handleContactPress = (contact) => {
    if (contact.students.length === 1) {
      // Se tem apenas um aluno, iniciar conversa diretamente
      createOrFindConversation(contact, contact.students[0]);
    } else {
      // Se tem múltiplos alunos, mostrar opções
      showStudentSelector(contact);
    }
  };

  const showStudentSelector = (contact) => {
    const studentButtons = contact.students.map(student => ({
      text: student.name,
      onPress: () => createOrFindConversation(contact, student)
    }));

    studentButtons.push({
      text: 'Cancelar',
      style: 'cancel'
    });

    Alert.alert(
      'Selecionar Aluno',
      `Sobre qual aluno você quer conversar com ${contact.name}?`,
      studentButtons
    );
  };

  const renderContactCard = ({ item }) => (
    <TouchableOpacity
      style={[styles.contactCard, theme.shadows.small, { backgroundColor: theme.colors.card }]}
      onPress={() => handleContactPress(item)}
      disabled={creating}
    >
      <View style={styles.contactHeader}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
          <Ionicons 
            name={item.role === 'teacher' ? 'school' : 'people'} 
            size={24} 
            color={theme.colors.text.inverse} 
          />
        </View>

        {/* Informações do contato */}
        <View style={styles.contactInfo}>
          <Text style={[styles.contactName, { color: theme.colors.text.primary }]}>
            {item.name}
          </Text>
          
          <Text style={[styles.contactRole, { color: theme.colors.text.secondary }]}>
            {item.role === 'teacher' ? '👨‍🏫 Professor' : '👨‍👩‍👧‍👦 Responsável'}
          </Text>
          
          {/* Lista de alunos */}
          <View style={styles.studentsContainer}>
            {item.students.map((student, index) => (
              <View key={student.id} style={styles.studentChip}>
                <Text style={[styles.studentName, { color: theme.colors.primary }]}>
                  {student.name}
                </Text>
              </View>
            ))}
          </View>
          
          {/* Classes (para professores) */}
          {item.classes && item.classes.length > 0 && (
            <Text style={[styles.classesText, { color: theme.colors.text.light }]}>
              Turmas: {item.classes.map(c => c.name).join(', ')}
            </Text>
          )}
        </View>

        {/* Ícone de ação */}
        <View style={styles.actionContainer}>
          <Ionicons 
            name="chatbubble" 
            size={20} 
            color={theme.colors.primary} 
          />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={64} color={theme.colors.text.light} />
      <Text style={[styles.emptyStateText, { color: theme.colors.text.secondary }]}>
        Nenhum contato encontrado
      </Text>
      <Text style={[styles.emptyStateSubtext, { color: theme.colors.text.light }]}>
        {userRole === 'teacher' 
          ? 'Não há responsáveis nas suas turmas ainda'
          : 'Seus filhos ainda não estão matriculados em turmas'
        }
      </Text>
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
            Nova Conversa
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.text.inverse }]}>
            {userRole === 'teacher' ? 'Escolha um responsável' : 'Escolha um professor'}
          </Text>
        </View>
      </View>

      {/* Barra de pesquisa */}
      <View style={[styles.searchContainer, { backgroundColor: theme.colors.card }]}>
        <View style={[styles.searchWrapper, { borderColor: theme.colors.border }]}>
          <Ionicons name="search" size={20} color={theme.colors.text.secondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text.primary }]}
            placeholder={`Buscar ${userRole === 'teacher' ? 'responsáveis' : 'professores'}...`}
            placeholderTextColor={theme.colors.text.light}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close" size={20} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Lista de contatos */}
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          renderItem={renderContactCard}
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

      {/* Loading overlay */}
      {creating && (
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingCard, { backgroundColor: theme.colors.card }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.text.primary }]}>
              Iniciando conversa...
            </Text>
          </View>
        </View>
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
  searchContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.body.fontSize,
    marginLeft: theme.spacing.sm,
  },
  listContainer: {
    padding: theme.spacing.md,
  },
  contactCard: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  contactHeader: {
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
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  contactRole: {
    fontSize: theme.typography.caption.fontSize,
    marginBottom: theme.spacing.sm,
  },
  studentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.xs,
  },
  studentChip: {
    backgroundColor: theme.colors.primary + '10',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.xs,
    marginBottom: 4,
  },
  studentName: {
    fontSize: theme.typography.small.fontSize,
    fontWeight: '500',
  },
  classesText: {
    fontSize: theme.typography.small.fontSize,
    marginTop: 4,
  },
  actionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.sm,
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
  loader: {
    marginTop: 100,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    ...theme.shadows.large,
  },
  loadingText: {
    fontSize: theme.typography.body.fontSize,
    marginTop: theme.spacing.md,
    fontWeight: '500',
  },
});