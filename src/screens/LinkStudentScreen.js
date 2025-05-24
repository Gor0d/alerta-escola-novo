import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../styles/theme';

export default function LinkStudentScreen({ navigation }) {
  const { user } = useAuth();
  const [searchMethod, setSearchMethod] = useState('code');
  const [studentCode, setStudentCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchByCode = async () => {
    const searchCode = studentCode.trim();
    
    if (!searchCode) {
      Alert.alert('Erro', 'Digite o código do aluno');
      return;
    }

    try {
      setLoading(true);
      
      // Buscar aluno pelo código (ID completo ou código curto)
      let query = supabase
        .from('students')
        .select(`
          *,
          enrollments!inner (
            class_id,
            classes!inner (
              name,
              teacher_id,
              profiles!classes_teacher_id_fkey (
                name,
                email
              )
            )
          )
        `);

      // Tentar buscar pelo ID completo primeiro
      let { data, error } = await query.eq('id', searchCode).single();

      // Se não encontrar, tentar buscar pelo código curto (primeiros 8 caracteres)
      if (error || !data) {
        const { data: students, error: searchError } = await supabase
          .from('students')
          .select(`
            *,
            enrollments!inner (
              class_id,
              classes!inner (
                name,
                teacher_id,
                profiles!classes_teacher_id_fkey (
                  name,
                  email
                )
              )
            )
          `);

        if (!searchError && students) {
          // Procurar aluno cujo ID começa com o código fornecido
          const foundStudent = students.find(s => 
            s.id.toUpperCase().startsWith(searchCode.toUpperCase())
          );
          
          if (foundStudent) {
            data = foundStudent;
            error = null;
          }
        }
      }

      if (error || !data) {
        Alert.alert('Não encontrado', 'Nenhum aluno encontrado com este código');
        return;
      }

      // Verificar se já está vinculado
      if (data.parent_id === user.id) {
        Alert.alert('Aviso', 'Este aluno já está vinculado a você');
        return;
      }

      // Mostrar confirmação
      Alert.alert(
        'Confirmar Vínculo',
        `Deseja vincular ${data.name} como seu filho(a)?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Confirmar',
            onPress: () => linkStudent(data.id)
          }
        ]
      );
    } catch (error) {
      console.error('Erro ao buscar aluno:', error);
      Alert.alert('Erro', 'Não foi possível buscar o aluno');
    } finally {
      setLoading(false);
    }
  };

  const searchByNameAndTeacher = async () => {
    if (!studentName.trim() || !teacherEmail.trim()) {
      Alert.alert('Erro', 'Preencha o nome do aluno e o email do professor');
      return;
    }

    try {
      setLoading(true);
      
      // Primeiro, buscar o professor pelo email
      const { data: teacher, error: teacherError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', teacherEmail.trim())
        .eq('role', 'teacher')
        .single();

      if (teacherError || !teacher) {
        Alert.alert('Erro', 'Professor não encontrado com este email');
        return;
      }

      // Buscar turmas do professor
      const { data: classes, error: classError } = await supabase
        .from('classes')
        .select('id')
        .eq('teacher_id', teacher.id);

      if (classError || !classes || classes.length === 0) {
        Alert.alert('Erro', 'Este professor não tem turmas cadastradas');
        return;
      }

      const classIds = classes.map(c => c.id);

      // Buscar alunos com nome similar nas turmas do professor
      const { data: enrollments, error: enrollmentError } = await supabase
        .from('enrollments')
        .select(`
          student_id,
          students!inner (
            id,
            name,
            parent_id
          ),
          classes!inner (
            name,
            teacher_id
          )
        `)
        .in('class_id', classIds)
        .ilike('students.name', `%${studentName.trim()}%`);

      if (enrollmentError) throw enrollmentError;

      if (!enrollments || enrollments.length === 0) {
        Alert.alert('Não encontrado', 'Nenhum aluno encontrado com este nome nas turmas do professor');
        return;
      }

      // Filtrar alunos não vinculados
      const unlinkedStudents = enrollments.filter(e => !e.students.parent_id);
      
      if (unlinkedStudents.length === 0) {
        Alert.alert('Aviso', 'Todos os alunos encontrados já possuem responsável');
        return;
      }

      setSearchResults(unlinkedStudents);
    } catch (error) {
      console.error('Erro ao buscar alunos:', error);
      Alert.alert('Erro', 'Não foi possível buscar alunos');
    } finally {
      setLoading(false);
    }
  };

  const linkStudent = async (studentId) => {
    try {
      setLoading(true);
      
      // Atualizar o parent_id do aluno
      const { error } = await supabase
        .from('students')
        .update({ parent_id: user.id })
        .eq('id', studentId);

      if (error) throw error;

      Alert.alert(
        'Sucesso', 
        'Aluno vinculado com sucesso!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Erro ao vincular aluno:', error);
      Alert.alert('Erro', 'Não foi possível vincular o aluno');
    } finally {
      setLoading(false);
    }
  };

  const requestLinkFromTeacher = async (enrollment) => {
    Alert.alert(
      'Solicitar Vínculo',
      `Deseja solicitar ao professor a vinculação com ${enrollment.students.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Solicitar',
          onPress: async () => {
            try {
              // Criar notificação para o professor
              const { error } = await supabase
                .from('link_requests')
                .insert({
                  student_id: enrollment.students.id,
                  parent_id: user.id,
                  teacher_id: enrollment.classes.teacher_id,
                  status: 'pending',
                  message: `Solicitação de vínculo com o aluno ${enrollment.students.name}`
                });

              if (error) throw error;

              Alert.alert(
                'Sucesso',
                'Solicitação enviada! O professor será notificado.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } catch (error) {
              console.error('Erro ao enviar solicitação:', error);
              Alert.alert('Erro', 'Não foi possível enviar a solicitação');
            }
          }
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vincular Filho(a)</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.methodSelector}>
          <TouchableOpacity
            style={[
              styles.methodButton,
              searchMethod === 'code' && styles.methodButtonActive
            ]}
            onPress={() => setSearchMethod('code')}
          >
            <Ionicons 
              name="key" 
              size={24} 
              color={searchMethod === 'code' ? 'white' : theme.colors.primary} 
            />
            <Text style={[
              styles.methodButtonText,
              searchMethod === 'code' && styles.methodButtonTextActive
            ]}>
              Por Código
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.methodButton,
              searchMethod === 'name' && styles.methodButtonActive
            ]}
            onPress={() => setSearchMethod('name')}
          >
            <Ionicons 
              name="search" 
              size={24} 
              color={searchMethod === 'name' ? 'white' : theme.colors.primary} 
            />
            <Text style={[
              styles.methodButtonText,
              searchMethod === 'name' && styles.methodButtonTextActive
            ]}>
              Por Nome
            </Text>
          </TouchableOpacity>
        </View>

        {searchMethod === 'code' ? (
          <View style={styles.searchSection}>
            <Text style={styles.sectionTitle}>Buscar por Código</Text>
            <Text style={styles.sectionDescription}>
              Digite o código fornecido pela escola ou professor
            </Text>
            
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
              <Text style={styles.infoCardText}>
                Em breve: escaneie QR Codes diretamente pelo app!
              </Text>
            </View>
            
            <TextInput
              style={styles.input}
              placeholder="Digite o código do aluno"
              value={studentCode}
              onChangeText={setStudentCode}
              autoCapitalize="characters"
              maxLength={8}
            />

            <TouchableOpacity
              style={styles.searchButton}
              onPress={searchByCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="search" size={20} color="white" />
                  <Text style={styles.searchButtonText}>Buscar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.searchSection}>
            <Text style={styles.sectionTitle}>Buscar por Nome</Text>
            <Text style={styles.sectionDescription}>
              Digite o nome do aluno e o email do professor
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="Nome do aluno"
              value={studentName}
              onChangeText={setStudentName}
              autoCapitalize="words"
            />

            <TextInput
              style={styles.input}
              placeholder="Email do professor"
              value={teacherEmail}
              onChangeText={setTeacherEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={styles.searchButton}
              onPress={searchByNameAndTeacher}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="search" size={20} color="white" />
                  <Text style={styles.searchButtonText}>Buscar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {searchResults.length > 0 && (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>Resultados</Text>
            {searchResults.map((enrollment, index) => (
              <TouchableOpacity
                key={index}
                style={styles.resultCard}
                onPress={() => requestLinkFromTeacher(enrollment)}
              >
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName}>{enrollment.students.name}</Text>
                  <Text style={styles.resultClass}>Turma: {enrollment.classes.name}</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={theme.colors.text.light} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={24} color={theme.colors.primary} />
          <Text style={styles.infoText}>
            Para vincular um aluno, você precisa do código fornecido pela escola 
            ou o nome do aluno e email do professor responsável.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  content: {
    flex: 1,
  },
  methodSelector: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 15,
    borderRadius: 10,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  methodButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  methodButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  methodButtonTextActive: {
    color: 'white',
  },
  searchSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.primary + '10',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  infoCardText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.primary,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  searchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsSection: {
    padding: 20,
    paddingTop: 0,
  },
  resultCard: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  resultClass: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 5,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 15,
    padding: 20,
    margin: 20,
    backgroundColor: theme.colors.primary + '10',
    borderRadius: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text.secondary,
    lineHeight: 20,
  },
});