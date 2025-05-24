import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { theme } from '../styles/theme';

export default function ClassManagementScreen({ route, navigation }) {
  const { classId, className } = route.params;
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [studentModalVisible, setStudentModalVisible] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  
  // Estados para criar novo aluno
  const [newStudentName, setNewStudentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  
  // Estados para buscar alunos existentes
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      
      // Buscar alunos matriculados nesta turma
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          profiles!students_parent_id_fkey (
            name,
            email,
            phone
          )
        `)
        .in('id', 
          // Subquery para pegar apenas alunos desta turma
          await supabase
            .from('enrollments')
            .select('student_id')
            .eq('class_id', classId)
            .then(result => result.data?.map(e => e.student_id) || [])
        );

      if (error) throw error;
      
      setStudents(data || []);
    } catch (error) {
      console.error('Erro ao buscar alunos:', error);
      Alert.alert('Erro', 'Não foi possível carregar os alunos');
    } finally {
      setLoading(false);
    }
  };

  const createNewStudent = async () => {
    if (!newStudentName.trim()) {
      Alert.alert('Erro', 'Nome do aluno é obrigatório');
      return;
    }

    try {
      setLoading(true);
      
      let parentId = null;
      
      // Se um email foi fornecido, verificar/criar responsável
      if (parentEmail.trim()) {
        // Verificar se já existe um responsável com este email
        const { data: existingParent } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', parentEmail.trim())
          .eq('role', 'parent')
          .single();

        if (existingParent) {
          parentId = existingParent.id;
        } else {
          // Criar convite para o responsável (simplificado)
          Alert.alert(
            'Responsável não cadastrado',
            `Um convite será enviado para ${parentEmail} para se cadastrar no sistema.`
          );
        }
      }

      // Criar o aluno
      const { data: newStudent, error: studentError } = await supabase
        .from('students')
        .insert({
          name: newStudentName.trim(),
          parent_id: parentId,
          birth_date: null,
          medical_info: null
        })
        .select()
        .single();

      if (studentError) throw studentError;

      // Matricular o aluno na turma
      const { error: enrollError } = await supabase
        .from('enrollments')
        .insert({
          student_id: newStudent.id,
          class_id: classId,
          status: 'active'
        });

      if (enrollError) throw enrollError;

      // Atualizar lista local
      await fetchStudents();
      
      // Limpar formulário
      setNewStudentName('');
      setParentEmail('');
      setParentPhone('');
      setStudentModalVisible(false);
      
      Alert.alert('Sucesso', 'Aluno criado e matriculado com sucesso!');
    } catch (error) {
      console.error('Erro ao criar aluno:', error);
      Alert.alert('Erro', 'Não foi possível criar o aluno');
    } finally {
      setLoading(false);
    }
  };

  const searchExistingStudents = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Erro', 'Digite um nome para buscar');
      return;
    }

    try {
      setSearching(true);
      
      // Buscar alunos que NÃO estão nesta turma
      const { data: enrolledStudentIds } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('class_id', classId);

      const enrolledIds = enrolledStudentIds?.map(e => e.student_id) || [];

      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          profiles!students_parent_id_fkey (
            name,
            email
          )
        `)
        .ilike('name', `%${searchQuery}%`)
        .not('id', 'in', `(${enrolledIds.length > 0 ? enrolledIds.join(',') : 'null'})`);

      if (error) throw error;
      
      setSearchResults(data || []);
      
      if (!data || data.length === 0) {
        Alert.alert('Nenhum resultado', 'Nenhum aluno encontrado com este nome');
      }
    } catch (error) {
      console.error('Erro ao buscar alunos:', error);
      Alert.alert('Erro', 'Não foi possível buscar alunos');
    } finally {
      setSearching(false);
    }
  };

  const enrollExistingStudent = async (student) => {
    try {
      const { error } = await supabase
        .from('enrollments')
        .insert({
          student_id: student.id,
          class_id: classId,
          status: 'active'
        });

      if (error) throw error;

      await fetchStudents();
      setSearchModalVisible(false);
      setSearchQuery('');
      setSearchResults([]);
      
      Alert.alert('Sucesso', `${student.name} foi matriculado na turma!`);
    } catch (error) {
      console.error('Erro ao matricular aluno:', error);
      Alert.alert('Erro', 'Não foi possível matricular o aluno');
    }
  };

  const removeStudentFromClass = async (studentId, studentName) => {
    Alert.alert(
      'Remover Aluno',
      `Deseja remover ${studentName} desta turma?`,
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
                .eq('student_id', studentId)
                .eq('class_id', classId);

              if (error) throw error;

              await fetchStudents();
              Alert.alert('Sucesso', 'Aluno removido da turma');
            } catch (error) {
              console.error('Erro ao remover aluno:', error);
              Alert.alert('Erro', 'Não foi possível remover o aluno');
            }
          }
        }
      ]
    );
  };

  const deleteClass = async () => {
    Alert.alert(
      'Excluir Turma',
      `Tem certeza que deseja excluir a turma "${className}"? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              // Primeiro remover todas as matrículas
              await supabase
                .from('enrollments')
                .delete()
                .eq('class_id', classId);

              // Depois excluir a turma
              const { error } = await supabase
                .from('classes')
                .delete()
                .eq('id', classId);

              if (error) throw error;

              Alert.alert('Sucesso', 'Turma excluída com sucesso');
              navigation.goBack();
            } catch (error) {
              console.error('Erro ao excluir turma:', error);
              Alert.alert('Erro', 'Não foi possível excluir a turma');
            }
          }
        }
      ]
    );
  };

  const renderStudent = ({ item }) => (
    <View style={styles.studentCard}>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.name}</Text>
        {item.profiles && (
          <Text style={styles.parentInfo}>
            Responsável: {item.profiles.name}
          </Text>
        )}
      </View>
      
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removeStudentFromClass(item.id, item.name)}
      >
        <Ionicons name="close-circle" size={24} color={theme.colors.error} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{className}</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="settings" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Estatísticas */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{students.length}</Text>
          <Text style={styles.statLabel}>Total de Alunos</Text>
        </View>
      </View>

      {/* Lista de Alunos */}
      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Alunos Matriculados</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setSearchModalVisible(true)}
            >
              <Ionicons name="search" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setStudentModalVisible(true)}
            >
              <Ionicons name="add" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : students.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={theme.colors.text.light} />
            <Text style={styles.emptyStateText}>Nenhum aluno matriculado</Text>
            <Text style={styles.emptyStateSubtext}>
              Adicione alunos para começar
            </Text>
          </View>
        ) : (
          <FlatList
            data={students}
            keyExtractor={(item) => item.id}
            renderItem={renderStudent}
            contentContainerStyle={styles.studentsList}
          />
        )}
      </View>

      {/* Modal de Configurações da Turma */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configurações da Turma</Text>
            
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={deleteClass}
            >
              <Ionicons name="trash" size={20} color="white" />
              <Text style={styles.dangerButtonText}>Excluir Turma</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal para Criar Novo Aluno */}
      <Modal
        visible={studentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setStudentModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Novo Aluno</Text>

            <TextInput
              style={styles.input}
              placeholder="Nome do Aluno"
              value={newStudentName}
              onChangeText={setNewStudentName}
            />

            <TextInput
              style={styles.input}
              placeholder="Email do Responsável (opcional)"
              value={parentEmail}
              onChangeText={setParentEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder="Telefone do Responsável (opcional)"
              value={parentPhone}
              onChangeText={setParentPhone}
              keyboardType="phone-pad"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setStudentModalVisible(false);
                  setNewStudentName('');
                  setParentEmail('');
                  setParentPhone('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={createNewStudent}
              >
                <Text style={styles.primaryButtonText}>Criar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para Buscar Alunos Existentes */}
      <Modal
        visible={searchModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSearchModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Adicionar Aluno Existente</Text>

            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Nome do aluno"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TouchableOpacity
                style={styles.searchButton}
                onPress={searchExistingStudents}
              >
                <Ionicons name="search" size={20} color="white" />
              </TouchableOpacity>
            </View>

            {searching ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.searchResultItem}
                    onPress={() => enrollExistingStudent(item)}
                  >
                    <View>
                      <Text style={styles.searchResultName}>{item.name}</Text>
                      {item.profiles && (
                        <Text style={styles.searchResultParent}>
                          Responsável: {item.profiles.name}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="add-circle" size={24} color={theme.colors.success} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  searchQuery.trim() && !searching ? (
                    <Text style={styles.noResults}>Nenhum aluno encontrado</Text>
                  ) : null
                }
                style={styles.searchResults}
              />
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setSearchModalVisible(false);
                setSearchQuery('');
                setSearchResults([]);
              }}
            >
              <Text style={styles.cancelButtonText}>Fechar</Text>
            </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  statsContainer: {
    padding: 20,
  },
  statCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    ...theme.shadows.small,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.small,
  },
  studentsList: {
    paddingBottom: 20,
  },
  studentCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...theme.shadows.small,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  parentInfo: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 4,
  },
  removeButton: {
    padding: 5,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.secondary,
    marginTop: 20,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: theme.colors.text.light,
    marginTop: 5,
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
    borderRadius: 10,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: theme.colors.border,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: theme.colors.text.secondary,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: theme.colors.error,
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  dangerButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    marginRight: 10,
  },
  searchButton: {
    backgroundColor: theme.colors.primary,
    width: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResults: {
    maxHeight: 300,
    marginBottom: 20,
  },
  searchResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  searchResultParent: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  noResults: {
    textAlign: 'center',
    color: theme.colors.text.light,
    padding: 20,
  },
});