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
  RefreshControl,
  ScrollView
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
  const [selectedParent, setSelectedParent] = useState(null);
  const [availableParents, setAvailableParents] = useState([]);
  const [showParentDropdown, setShowParentDropdown] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);

  useEffect(() => {
    fetchStudents();
    fetchAvailableParents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      console.log('Buscando alunos para a turma:', classId);
      
      // Query sem usar campo id - usar student_id e class_id como chave composta
      const { data: enrollments, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('student_id, class_id, status, enrolled_at')
        .eq('class_id', classId);

      if (enrollmentError) {
        console.error('Erro ao buscar enrollments:', enrollmentError);
        throw enrollmentError;
      }

      console.log('Enrollments encontrados:', enrollments);

      if (!enrollments || enrollments.length === 0) {
        console.log('Nenhum enrollment encontrado');
        setStudents([]);
        return;
      }

      // Para cada enrollment, buscar dados do estudante
      const studentsData = await Promise.all(
        enrollments.map(async (enrollment) => {
          try {
            // Buscar dados do estudante
            const { data: student, error: studentError } = await supabase
              .from('students')
              .select('*')
              .eq('id', enrollment.student_id)
              .single();

            if (studentError) {
              console.error('Erro ao buscar estudante:', studentError);
              return null;
            }

            // Buscar dados do responsável se existir
            let parentData = null;
            if (student.parent_id) {
              const { data: parent, error: parentError } = await supabase
                .from('profiles')
                .select('name, email')
                .eq('id', student.parent_id)
                .single();

              if (!parentError && parent) {
                parentData = parent;
              }
            }

            return {
              // Usar combinação student_id + class_id como identificador único
              enrollmentKey: `${enrollment.student_id}_${enrollment.class_id}`,
              id: student.id,
              name: student.name,
              status: enrollment.status || 'active',
              parentId: student.parent_id,
              parentName: parentData?.name || 'Sem responsável',
              parentEmail: parentData?.email || 'Email não informado',
              birthDate: student.birth_date,
              active: student.active,
              studentId: enrollment.student_id,
              classId: enrollment.class_id
            };

          } catch (error) {
            console.error('Erro ao processar enrollment:', error);
            return null;
          }
        })
      );

      // Filtrar nulls e definir estudantes
      const validStudents = studentsData.filter(student => student !== null);
      console.log('Estudantes processados:', validStudents);
      setStudents(validStudents);

    } catch (error) {
      console.error('Erro geral ao buscar alunos:', error);
      Alert.alert('Erro', `Não foi possível carregar os alunos: ${error.message}`);
      setStudents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAvailableParents = async () => {
    try {
      console.log('Buscando responsáveis disponíveis...');
      
      const { data: parents, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('role', 'parent')
        .order('name');

      if (error) {
        console.error('Erro ao buscar responsáveis:', error);
        return;
      }

      console.log('Responsáveis encontrados:', parents);
      setAvailableParents(parents || []);
    } catch (error) {
      console.error('Erro ao carregar responsáveis:', error);
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
      console.log('Adicionando estudante:', newStudentName);
      
      let parentId = null;
      
      // Usar o responsável selecionado do dropdown
      if (selectedParent) {
        parentId = selectedParent.id;
        console.log('Responsável selecionado:', selectedParent);
      }
      
      // Criar o aluno
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .insert([{
          name: newStudentName.trim(),
          parent_id: parentId,
          active: true
        }])
        .select()
        .single();

      if (studentError) {
        console.error('Erro ao criar estudante:', studentError);
        throw studentError;
      }

      console.log('Aluno criado:', studentData);
      
      // Matricular o aluno na turma - sem usar campo id
      const { error: enrollmentError } = await supabase
        .from('enrollments')
        .insert([{
          student_id: studentData.id,
          class_id: classId,
          status: 'active'
        }]);

      if (enrollmentError) {
        console.error('Erro ao criar enrollment:', enrollmentError);
        throw enrollmentError;
      }

      console.log('Enrollment criado com sucesso');

      // Limpar formulário e fechar modal
      setNewStudentName('');
      setSelectedParent(null);
      setModalVisible(false);
      
      Alert.alert('Sucesso', 'Aluno adicionado com sucesso!');
      
      // Recarregar lista
      fetchStudents();
      
    } catch (error) {
      console.error('Erro ao adicionar aluno:', error);
      Alert.alert('Erro', `Não foi possível adicionar o aluno: ${error.message}`);
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
              console.log('Removendo enrollment para student_id:', student.studentId, 'class_id:', student.classId);
              
              // Deletar usando chave composta student_id + class_id
              const { error } = await supabase
                .from('enrollments')
                .delete()
                .eq('student_id', student.studentId)
                .eq('class_id', student.classId);

              if (error) {
                console.error('Erro ao remover enrollment:', error);
                throw error;
              }

              Alert.alert('Sucesso', 'Aluno removido da turma');
              fetchStudents();
            } catch (error) {
              console.error('Erro ao remover aluno:', error);
              Alert.alert('Erro', `Não foi possível remover o aluno: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const toggleAttendance = async (student) => {
    try {
      const newStatus = student.status === 'present' ? 'absent' : 'present';
      
      console.log('Alterando status do aluno:', student.name, 'para:', newStatus);
      
      // Atualizar usando chave composta student_id + class_id
      const { error } = await supabase
        .from('enrollments')
        .update({ status: newStatus })
        .eq('student_id', student.studentId)
        .eq('class_id', student.classId);

      if (error) {
        console.error('Erro ao atualizar status:', error);
        throw error;
      }

      // Atualizar estado local
      setStudents(students.map(s => 
        s.id === student.id ? { ...s, status: newStatus } : s
      ));

    } catch (error) {
      console.error('Erro ao alterar presença:', error);
      Alert.alert('Erro', `Não foi possível alterar a presença: ${error.message}`);
    }
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
        <View style={styles.studentActions}>
          <TouchableOpacity
            style={styles.attendanceButton}
            onPress={() => toggleAttendance(student)}
          >
            <View style={[
              styles.statusBadge,
              student.status === 'present' ? styles.presentBadge : 
              student.status === 'absent' ? styles.absentBadge : styles.activeBadge
            ]}>
              <Text style={styles.statusText}>
                {student.status === 'present' ? 'Presente' : 
                 student.status === 'absent' ? 'Ausente' : 'Ativo'}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeStudent(student)}
          >
            <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
          </TouchableOpacity>
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
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
          <Text style={styles.summaryNumber}>
            {students.filter(s => s.status === 'present').length}
          </Text>
          <Text style={styles.summaryLabel}>Presentes</Text>
        </View>

        <View style={styles.summaryCard}>
          <Ionicons name="close-circle" size={24} color={theme.colors.error} />
          <Text style={styles.summaryNumber}>
            {students.filter(s => s.status === 'absent').length}
          </Text>
          <Text style={styles.summaryLabel}>Ausentes</Text>
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
            <TouchableOpacity
              style={styles.addFirstStudentButton}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.addFirstStudentText}>Adicionar Primeiro Aluno</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={students}
            keyExtractor={(item) => item.enrollmentKey}
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
            <ScrollView showsVerticalScrollIndicator={false}>
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
                <Text style={styles.label}>Responsável (opcional)</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowParentDropdown(!showParentDropdown)}
                >
                  <View style={styles.dropdownButtonContent}>
                    <View style={styles.dropdownTextContainer}>
                      <Text style={[
                        styles.dropdownButtonText,
                        !selectedParent && styles.dropdownPlaceholder
                      ]} numberOfLines={1}>
                        {selectedParent ? selectedParent.name : 'Selecionar responsável'}
                      </Text>
                      {selectedParent && selectedParent.email && (
                        <Text style={styles.dropdownButtonEmail} numberOfLines={1}>
                          {selectedParent.email}
                        </Text>
                      )}
                    </View>
                    <Ionicons 
                      name={showParentDropdown ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color={theme.colors.text.secondary} 
                    />
                  </View>
                </TouchableOpacity>
                
                {showParentDropdown && (
                  <View style={styles.dropdownList}>
                    <ScrollView 
                      style={styles.dropdownScrollView} 
                      nestedScrollEnabled={true}
                      keyboardShouldPersistTaps="handled"
                    >
                      <TouchableOpacity
                        style={[styles.dropdownItem, styles.dropdownItemFirst]}
                        onPress={() => {
                          setSelectedParent(null);
                          setShowParentDropdown(false);
                        }}
                      >
                        <View style={styles.dropdownItemContent}>
                          <Ionicons name="person-remove" size={20} color={theme.colors.text.light} />
                          <Text style={[styles.dropdownItemText, styles.noParentText]}>
                            Sem responsável
                          </Text>
                        </View>
                      </TouchableOpacity>
                      
                      {availableParents.map((parent, index) => (
                        <TouchableOpacity
                          key={parent.id}
                          style={[
                            styles.dropdownItem,
                            selectedParent?.id === parent.id && styles.dropdownItemSelected
                          ]}
                          onPress={() => {
                            setSelectedParent(parent);
                            setShowParentDropdown(false);
                          }}
                        >
                          <View style={styles.dropdownItemContent}>
                            <Ionicons 
                              name="person" 
                              size={20} 
                              color={selectedParent?.id === parent.id ? theme.colors.primary : theme.colors.text.secondary} 
                            />
                            <View style={styles.parentDropdownInfo}>
                              <Text style={[
                                styles.dropdownItemText,
                                selectedParent?.id === parent.id && styles.dropdownItemTextSelected
                              ]} numberOfLines={1}>
                                {parent.name}
                              </Text>
                              <Text style={[
                                styles.dropdownItemEmail,
                                selectedParent?.id === parent.id && styles.dropdownItemEmailSelected
                              ]} numberOfLines={1}>
                                {parent.email}
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                      
                      {availableParents.length === 0 && (
                        <View style={styles.dropdownItem}>
                          <View style={styles.dropdownItemContent}>
                            <Ionicons name="information-circle" size={20} color={theme.colors.text.light} />
                            <Text style={styles.dropdownEmptyText}>
                              Nenhum responsável cadastrado
                            </Text>
                          </View>
                        </View>
                      )}
                    </ScrollView>
                  </View>
                )}
                
                <Text style={styles.helperText}>
                  Escolha um responsável da lista ou deixe sem responsável
                </Text>
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setModalVisible(false);
                    setNewStudentName('');
                    setSelectedParent(null);
                    setShowParentDropdown(false);
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
            </ScrollView>
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
  studentActions: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  attendanceButton: {
    marginBottom: theme.spacing.xs,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 70,
    alignItems: 'center',
  },
  presentBadge: {
    backgroundColor: theme.colors.success,
  },
  absentBadge: {
    backgroundColor: theme.colors.error,
  },
  activeBadge: {
    backgroundColor: theme.colors.primary,
  },
  statusText: {
    color: 'white',
    fontSize: 11,
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
    marginBottom: theme.spacing.lg,
  },
  addFirstStudentButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  addFirstStudentText: {
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
    width: '90%',
    maxHeight: '80%',
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
    marginTop: theme.spacing.lg,
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
  // Estilos do Dropdown Melhorado
  dropdownButton: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
  },
  dropdownButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownTextContainer: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  dropdownButtonEmail: {
    fontSize: 12,
    color: theme.colors.text.light,
    marginTop: 2,
  },
  dropdownPlaceholder: {
    color: theme.colors.text.light,
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'white',
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  dropdownScrollView: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  dropdownItemFirst: {
    borderTopWidth: 0,
  },
  dropdownItemSelected: {
    backgroundColor: theme.colors.primary + '10',
  },
  dropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  parentDropdownInfo: {
    flex: 1,
  },
  dropdownItemText: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  dropdownItemTextSelected: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  dropdownItemEmail: {
    fontSize: 12,
    color: theme.colors.text.light,
    marginTop: 2,
  },
  dropdownItemEmailSelected: {
    color: theme.colors.primary,
  },
  noParentText: {
    fontStyle: 'italic',
    color: theme.colors.text.light,
  },
  dropdownEmptyText: {
    fontSize: 14,
    color: theme.colors.text.light,
    fontStyle: 'italic',
  },
});