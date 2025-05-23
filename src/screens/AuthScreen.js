import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { useAuth } from '../contexts/AuthContext'; // ← ADICIONAR ESTA LINHA

export default function AuthScreen({ navigation }) {
  const { signIn, signUp, loading } = useAuth(); // ← ADICIONAR ESTA LINHA
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'parent',
    phone: '',
    school_unit: ''
  });

  const handleAuth = async () => {
    if (!formData.email || !formData.password) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    if (isSignUp && !formData.name) {
      Alert.alert('Erro', 'Nome é obrigatório para cadastro');
      return;
    }

    try {
      let result;
      
      if (isSignUp) {
        result = await signUp(formData.email, formData.password, {
          name: formData.name,
          role: formData.role,
          phone: formData.phone || null,
          school_unit: formData.school_unit || null
        });
      } else {
        result = await signIn(formData.email, formData.password);
      }

      if (result.error) {
        Alert.alert('Erro', result.error.message);
      } else if (isSignUp) {
        Alert.alert(
          'Sucesso!', 
          'Cadastro realizado com sucesso!'
        );
      }
      // A navegação será automática via AuthContext
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro inesperado. Tente novamente.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.secondary]}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header com logo */}
            <View style={styles.header}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
              
              <View style={styles.logoContainer}>
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="school" size={60} color="white" />
                </View>
                <Text style={styles.schoolName}>Escola Municipal</Text>
                <Text style={styles.appName}>Alerta Escola</Text>
              </View>
            </View>

            {/* Formulário */}
            <View style={styles.formContainer}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>
                  {isSignUp ? 'Criar Conta' : 'Entrar'}
                </Text>
                <Text style={styles.formSubtitle}>
                  {isSignUp 
                    ? 'Preencha os dados para criar sua conta' 
                    : 'Entre com suas credenciais'
                  }
                </Text>
              </View>

              {/* Nome (apenas no cadastro) */}
              {isSignUp && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Nome Completo</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Digite seu nome completo"
                    value={formData.name}
                    onChangeText={(value) => setFormData({...formData, name: value})}
                    autoCapitalize="words"
                  />
                </View>
              )}

              {/* Email */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Digite seu email"
                  value={formData.email}
                  onChangeText={(value) => setFormData({...formData, email: value})}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Senha */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Senha</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Digite sua senha"
                  value={formData.password}
                  onChangeText={(value) => setFormData({...formData, password: value})}
                  secureTextEntry
                />
              </View>

              {/* Seletor de perfil (apenas no cadastro) */}
              {isSignUp && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Eu sou:</Text>
                  <View style={styles.roleSelector}>
                    <TouchableOpacity
                      style={[
                        styles.roleButton,
                        formData.role === 'parent' && styles.roleButtonSelected
                      ]}
                      onPress={() => setFormData({...formData, role: 'parent'})}
                    >
                      <Ionicons
                        name="people"
                        size={20}
                        color={formData.role === 'parent' ? 'white' : theme.colors.text.secondary}
                      />
                      <Text
                        style={[
                          styles.roleButtonText,
                          formData.role === 'parent' && styles.roleButtonTextSelected
                        ]}
                      >
                        Responsável
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.roleButton,
                        formData.role === 'teacher' && styles.roleButtonSelected
                      ]}
                      onPress={() => setFormData({...formData, role: 'teacher'})}
                    >
                      <Ionicons
                        name="school"
                        size={20}
                        color={formData.role === 'teacher' ? 'white' : theme.colors.text.secondary}
                      />
                      <Text
                        style={[
                          styles.roleButtonText,
                          formData.role === 'teacher' && styles.roleButtonTextSelected
                        ]}
                      >
                        Professor(a)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Botão de ação */}
              <TouchableOpacity 
                style={styles.authButton} 
                onPress={handleAuth}
              >
                <Text style={styles.buttonText}>
                  {isSignUp ? 'Criar Conta' : 'Entrar'}
                </Text>
              </TouchableOpacity>

              {/* Toggle entre login e cadastro */}
              <View style={styles.toggleContainer}>
                <Text style={styles.toggleText}>
                  {isSignUp 
                    ? 'Já tem uma conta?' 
                    : 'Ainda não tem conta?'
                  }
                </Text>
                <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
                  <Text style={styles.toggleLink}>
                    {isSignUp ? 'Fazer Login' : 'Criar Conta'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: theme.spacing.lg,
    top: theme.spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  schoolName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: theme.spacing.xs,
  },
  appName: {
    color: 'white',
    fontSize: 16,
    opacity: 0.9,
  },
  formContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.xl,
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  formSubtitle: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
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
    color: theme.colors.text.primary,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.sm,
  },
  roleButtonSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  roleButtonText: {
    color: theme.colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
  },
  roleButtonTextSelected: {
    color: 'white',
  },
  authButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  toggleText: {
    color: theme.colors.text.secondary,
    marginRight: theme.spacing.sm,
  },
  toggleLink: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
});