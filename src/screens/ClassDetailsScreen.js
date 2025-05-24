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
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

export default function ClassDetailsScreen({ route, navigation }) {
  const { classId, className } = route.params;
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState({});

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      
      // Primeiro, buscar os IDs dos alunos matriculados nesta turma
      const { data: enrollments, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('student_id, status')
        .eq('class_id', classId);

      if (enrollmentError) throw enrollmentError;

      if (!enrollments || enrollments.length === 0) {
        setStudents([]);
        return;
      }

      // Extrair os IDs dos estudantes
      const studentIds = enrollments.map(e => e.student_id);

      // Buscar os detalhes dos estudantes
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select(`
          *,
          profiles:parent_id (
            id,
            name,
            email
          )
        `)
        .in('id', studentIds)
        .eq('active', true);

      if (studentsError) throw studentsError;

      // Combinar dados dos estudantes com status de matrícula
      const studentsWithStatus = studentsData.map(student => {
        const enrollment = enrollments.find(e => e.student_id === student.id);
        return {
          ...student,
          enrollmentStatus: enrollment?.status || 'active'
        };
      });

      setStudents(studentsWithStatus);
      
      // Inicializar status de presença
      const initialStatus = {};
      studentsWithStatus.forEach(student => {
        initialStatus[student.id] = 'present';
      });
      setAttendanceStatus(initialStatus);
    } catch (error) {
      console.error('Erro ao buscar alunos:', error.message);
      Alert.alert('Erro', 'Não foi possível carregar os alunos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStudents();
  };

  const toggleAttendance = (studentId) => {
    setAttendanceStatus(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present'
    }));
  };

  const saveAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Obter o ID do usuário primeiro
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('Erro', 'Usuário não autenticado');
        return;
      }
      
      // Preparar dados de presença
      const attendanceData = Object.entries(attendanceStatus).map(([studentId, status]) => ({
        student_id: studentId,
        class_id: classId,
        date: today,
        status: status,
        marked_by: user.id
      }));

      // Inserir ou atualizar presenças
      for (const attendance of attendanceData) {
        const { error } = await supabase
          .from('attendances')
          .upsert(attendance, { 
            onConflict: 'student_id,date' 
          });

        if (error) throw error;
      }

      Alert.alert('Sucesso', 'Presença salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar presença:', error);
      Alert.alert('Erro', 'Não foi possível salvar a presença');
    }
  };

  const addStudent = async () => {
    if (!newStudentName.trim()) {
      Alert.alert('Erro', 'O nome do aluno é obrigatório');
      return;
    }

    try {
      setLoading(true);
      
      let parentId = null;
      
      // Se um email de responsável foi fornecido
      if (parentEmail.trim()) {
        // Verificar se já existe um perfil com este email
        const { data: existingProfiles, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', parentEmail.trim())
          .eq('role', 'parent')
          .limit(1);
        
        if (profileError) throw profileError;
        
        if (existingProfiles && existingProfiles.length > 0) {
          parentId = existingProfiles[0].id;
        } else {
          Alert.alert(
            'Aviso', 
            'O responsável informado não possui cadastro. Um convite será enviado para o email informado.'
          );
        }
      }
      
      // Criar o aluno
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .insert([
          { 
            name: newStudentName.trim(),
            parent_id: parentId,
            active: true
          }
        ])
        .select();
      
      if (studentError) throw studentError;
      
      if (!studentData || studentData.length === 0) {
        throw new Error('Erro ao criar aluno');
      }
      
      // Matricular o aluno na turma
      const { error: enrollmentError } = await supabase
        .from('enrollments')
        .insert([
          {
            student_id: studentData[0].id,
            class_id: classId,
            status: 'active'
          }
        ]);
      
      if (enrollmentError) throw enrollmentError;
      
      // Recarregar a lista
      await fetchStudents();
      
      // Limpar os campos e fechar o modal
      setNewStudentName('');
      setParentEmail('');
      setModalVisible(false);
      
      Alert.alert('Sucesso', 'Aluno adicionado com sucesso');
    } catch (error) {
      console.error('Erro ao adicionar aluno:', error.message);
      Alert.alert('Erro', 'Não foi possível adicionar o aluno');
    } finally {
      setLoading(false);
    }
  };

  const removeStudent = async (studentId, studentName) => {
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{className}</Text>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={saveAttendance}
        >
          <Ionicons name="save" size={24} color="white" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <View style={styles.statusSummary}>
          <View style={styles.statusItem}>
            <Text style={styles.statusCount}>
              {Object.values(attendanceStatus).filter(s => s === 'present').length}
            </Text>
            <Text style={styles.statusLabel}>Presentes</Text>
          </View>
          
          <View style={styles.statusDivider} />
          
          <View style={styles.statusItem}>
            <Text style={[styles.statusCount, { color: '#ef4444' }]}>
              {Object.values(attendanceStatus).filter(s => s === 'absent').length}
            </Text>
            <Text style={styles.statusLabel}>Ausentes</Text>
          </View>
          
          <View style={styles.statusDivider} />
          
          <View style={styles.statusItem}>
            <Text style={styles.statusCount}>{students.length}</Text>
            <Text style={styles.statusLabel}>Total</Text>
          </View>
        </View>
        
        <Text style={styles.sectionTitle}>Lista de Alunos</Text>
        
        {loading && students.length === 0 ? (
          <ActivityIndicator size="large" color="#344955" style={styles.loader} />
        ) : students.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#c5c5c5" />
            <Text style={styles.emptyStateText}>Nenhum aluno nesta turma</Text>
            <Text style={styles.emptyStateSubtext}>Adicione alunos para fazer a chamada</Text>
          </View>
        ) : (
          <FlatList
            data={students}
            keyExtractor={(item) => item.id}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            renderItem={({ item }) => (
              <View style={styles.studentCard}>
                <TouchableOpacity 
                  style={styles.studentTouchable}
                  onPress={() => toggleAttendance(item.id)}
                >
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{item.name}</Text>
                    {item.profiles && (
                      <Text style={styles.parentInfo}>
                        <Ionicons name="person-outline" size={12} color="#64748b" />
                        {' '}{item.profiles.name}
                      </Text>
                    )}
                  </View>
                  <View style={[
                    styles.statusBadge, 
                    { backgroundColor: attendanceStatus[item.id] === 'present' ? '#4ade80' : '#f87171' }
                  ]}>
                    <Text style={styles.statusText}>
                      {attendanceStatus[item.id] === 'present' ? 'Presente' : 'Ausente'}
                    </Text>
                  </View>
                </TouchableOpacity>
                
                {/* Botões de ação */}
                <View style={styles.studentActions}>
                  {!item.parent_id && (
                    <TouchableOpacity
                      style={styles.qrButton}
                      onPress={() => navigation.navigate('StudentQRCode', { student: item })}
                    >
                      <Ionicons name="qr-code" size={20} color="#6366f1" />
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeStudent(item.id, item.name)}
                  >
                    <Ionicons name="close-circle" size={22} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
        
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>
      
      {/* Modal para Adicionar Aluno */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Adicionar Novo Aluno</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Nome do Aluno"
              value={newStudentName}
              onChangeText={setNewStudentName}
              autoCapitalize="words"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Email do Responsável (opcional)"
              value={parentEmail}
              onChangeText={setParentEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setNewStudentName('');
                  setParentEmail('');
                }}
              >
                <Text style={[styles.buttonText, { color: '#344955' }]}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={addStudent}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Salvando...' : 'Salvar'}
                </Text>
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#344955',
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  saveButton: {
    padding: 5,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statusSummary: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
  },
  statusCount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#344955',
  },
  statusLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 5,
  },
  statusDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#344955',
    marginBottom: 15,
  },
  studentCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentTouchable: {
    flex: 1,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#344955',
  },
  parentInfo: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 5,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  studentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  qrButton: {
    paddingHorizontal: 8,
    marginRight: 5,
  },
  removeButton: {
    paddingLeft: 8,
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
    color: '#64748b',
    marginTop: 20,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 5,
    textAlign: 'center',
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#4F46E5',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#344955',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
  },
  saveButton: {
    backgroundColor: '#4F46E5',
  },
  buttonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold',
  },
  loader: {
    marginTop: 50,
  },
});