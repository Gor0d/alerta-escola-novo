import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { theme } from '../styles/theme';

export default function ClassDetailsScreen({ route, navigation }) {
  const { classId, className } = route.params;
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [addingStudent, setAddingStudent] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      
      // Buscar alunos matriculados nesta turma
      const { data: enrollments, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          status,
          students (
            id,
            name,
            parent_id,
            profiles (
              name,
              email
            )
          )
        `)
        .eq('class_id', classId);

      if (error) throw error;

      // Transformar dados para formato mais fácil de usar
      const studentsData = (enrollments || []).map(enrollment => ({
        enrollmentId: enrollment.id,
        id: enrollment.students.id,
        name: enrollment.students.name,
        status: enrollment.status,
        parentId: enrollment.students.parent_id,
        parentName: enrollment.students.profiles?.name || 'Sem responsável',
        parentEmail: enrollment.students.profiles?.email || 'Email não informado'
      }));

      console.log('Students in class:', studentsData);
      setStudents(studentsData);
    } catch (error) {
      console.error('Erro ao buscar alunos:', error);
      Alert.alert('Erro', 'Não foi possível carregar os alunos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents();
  };

  const findParentByEmail = async (email) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('email', email.toLowerCase().trim())
        .eq('role', 'parent')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Erro ao buscar responsável:', error);
      return null;
    }
  };

  const addStudent = async () => {
    if (!newStudentName.trim()) {
      Alert.alert('Erro', 'O nome do aluno é obrigatório');
      return;
    }

    try {
      setAddingStudent(true);
      
      let parentId = null;
      
      // Se um email foi fornecido, buscar o responsável
      if (parentEmail.trim()) {
        const parent = await findParentByEmail(parentEmail);
        
        if (parent) {
          parentId = parent.id;
          console.log('Responsável encontrado:', parent);
        } else {
          Alert.alert(
            'Responsável não encontrado',
            `Não foi encontrado um responsável cadastrado com o email "${parentEmail}". O aluno será criado sem responsável vinculado.`
          );
        }
      }
      
      // Criar o aluno
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .insert([{
          name: newStudentName.trim(),
          parent_id: parentId
        }])
        .select()
        .single();

      if (studentError) throw studentError;

      console.log('Aluno criado:', studentData);
      
      // Matricular o aluno na turma
      const { error: enrollmentError } = await supabase
        .from('enrollments')
        .insert([{
          student_id: studentData.id,
          class_id: classId,
          status: 'active'
        }]);

      if (enrollmentError) throw enrollmentError;

      // Limpar formulário e fechar modal
      setNewStudentName('');
      setParentEmail('');
      setModalVisible(false);
      
      Alert.alert('Sucesso', 'Aluno adicionado com sucesso!');
      
      // Recarregar lista
      fetchStudents();
      
    } catch (error) {
      console.error('Erro ao adicionar aluno:', error);
      Alert.alert('Erro', 'Não foi possível adicionar o aluno');
    } finally {
      setAddingStudent(false);
    }
  };

  const removeStudent = async (student) => {
    Alert.alert(
      'Remover Aluno',
      `Tem certeza que deseja remover ${student.name} desta turma?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('enrollments')
                .delete()
                .eq('id', student.enrollmentId);

              if (error) throw error;

              Alert.alert('Sucesso', 'Aluno removido da turma');
              fetchStudents();
            } catch (error) {
              console.error('Erro ao remover aluno:', error);
              Alert.alert('Erro', 'Não foi possível remover o aluno');
            }
          }
        }
      ]
    );
  };

  const renderStudentCard = ({ item: student }) => (
    <View style={styles.studentCard}>
      <View style={styles.studentHeader}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person" size={24} color={theme.colors.primary} />
        </View>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{student.name}</Text>
          <Text style={styles.parentInfo}>
            Responsável: {student.parentName}
          </Text>
          {student.parentEmail !== 'Email não informado' && (
            <Text style={styles.parentEmail}>{student.parentEmail}</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeStudent(student)}
        >
          <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.studentStatus}>
        <View style={[
          styles.statusBadge,
          student.status === 'active' ? styles.activeBadge : styles.inactiveBadge
        ]}>
          <Text style={styles.statusText}>
            {student.status === 'active' ? 'Ativo' : 'Inativo'}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{className}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Resumo */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Ionicons name="people" size={24} color={theme.colors.primary} />
          <Text style={styles.summaryNumber}>{students.length}</Text>
          <Text style={styles.summaryLabel}>Total de Alunos</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
          <Text style={styles.summaryNumber}>
            {students.filter(s => s.status === 'active').length}
          </Text>
          <Text style={styles.summaryLabel}>Ativos</Text>
        </View>

        <View style={styles.summaryCard}>
          <Ionicons name="person-add" size={24} color={theme.colors.warning} />
          <Text style={styles.summaryNumber}>
            {students.filter(s => s.parentId).length}
          </Text>
          <Text style={styles.summaryLabel}>Com Responsável</Text>
        </View>
      </View>

      {/* Lista de alunos */}
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Alunos da Turma</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
        ) : students.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={theme.colors.text.light} />
            <Text style={styles.emptyStateTitle}>Nenhum aluno nesta turma</Text>
            <Text style={styles.emptyStateText}>
              Adicione alunos para começar a gerenciar a turma
            </Text>
          </View>
        ) : (
          <FlatList
            data={students}
            keyExtractor={(item) => item.id}
            renderItem={renderStudentCard}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Modal para adicionar aluno */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Adicionar Aluno</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nome do Aluno *</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite o nome completo do aluno"
                value={newStudentName}
                onChangeText={setNewStudentName}
                autoCapitalize="words"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email do Responsável (opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite o email do responsável"
                value={parentEmail}
                onChangeText={setParentEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text style={styles.helperText}>
                Se o responsável já tiver cadastro, será vinculado automaticamente
              </Text>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setModalVisible(false);
                  setNewStudentName('');
                  setParentEmail('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.saveButton, addingStudent && styles.disabledButton]}
                onPress={addStudent}
                disabled={addingStudent}
              >
                {addingStudent ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>Adicionar</Text>
                )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginHorizontal: theme.spacing.md,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 20,
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
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  studentCard: {
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
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
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
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  parentInfo: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  parentEmail: {
    fontSize: 12,
    color: theme.colors.text.light,
    marginTop: 2,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentStatus: {
    alignItems: 'flex-start',
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: theme.colors.success,
  },
  inactiveBadge: {
    backgroundColor: theme.colors.error,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  loader: {
    marginTop: theme.spacing.xl,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
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
    width: '90%',
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
  helperText: {
    fontSize: 12,
    color: theme.colors.text.light,
    marginTop: theme.spacing.xs,
    lineHeight: 16,
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
  saveButton: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});