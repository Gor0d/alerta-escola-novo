import React, { useState, useEffect } from 'react';
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
  Alert,
  ActivityIndicator,
  Keyboard,
  Dimensions,
  Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { useAuth } from '../contexts/AuthContext';

// Importe sua logo real aqui
 const LogoUniversoSaber = require('../../assets/images/logo-universo-saber.png');

const { height: screenHeight } = Dimensions.get('window');

export default function AuthScreen({ navigation }) {
  const { signIn, signUp, loading } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [activeInput, setActiveInput] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'parent',
    phone: '',
    school_unit: ''
  });

  // Gerenciar aparência/desaparecimento do teclado
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setActiveInput(null);
      }
    );

    return () => {
      keyboardDidHideListener?.remove();
      keyboardDidShowListener?.remove();
    };
  }, []);

  const handleAuth = async () => {
    // Fechar teclado antes de processar
    Keyboard.dismiss();
    
    if (!formData.email || !formData.password) {
      Alert.alert('Erro', 'Preencha todos os campos obrigatórios');
      return;
    }

    if (isSignUp && !formData.name) {
      Alert.alert('Erro', 'Nome é obrigatório para cadastro');
      return;
    }

    // Validação de email simples
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Alert.alert('Erro', 'Digite um email válido');
      return;
    }

    // Validação de senha
    if (formData.password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');
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
        // Melhorar mensagens de erro
        let errorMessage = result.error.message;
        
        if (errorMessage.includes('Invalid login credentials')) {
          errorMessage = 'Email ou senha incorretos';
        } else if (errorMessage.includes('User already registered')) {
          errorMessage = 'Este email já está cadastrado';
        } else if (errorMessage.includes('Password should be at least 6 characters')) {
          errorMessage = 'A senha deve ter pelo menos 6 caracteres';
        }
        
        Alert.alert('Erro', errorMessage);
      } else if (isSignUp) {
        Alert.alert(
          'Sucesso!', 
          'Cadastro realizado com sucesso!',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Erro na autenticação:', error);
      Alert.alert('Erro', 'Ocorreu um erro inesperado. Tente novamente.');
    }
  };

  const clearForm = () => {
    setFormData({
      email: '',
      password: '',
      name: '',
      role: 'parent',
      phone: '',
      school_unit: ''
    });
  };

  const toggleMode = () => {
    Keyboard.dismiss();
    setIsSignUp(!isSignUp);
    clearForm();
    setActiveInput(null);
  };

  // Função para focar no input e marcar como ativo
  const handleInputFocus = (inputName) => {
    setActiveInput(inputName);
  };

  const handleInputBlur = () => {
    // Pequeno delay antes de limpar o activeInput para evitar flickering
    setTimeout(() => {
      if (!keyboardVisible) {
        setActiveInput(null);
      }
    }, 100);
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
            contentContainerStyle={[
              styles.scrollContent,
              keyboardVisible && styles.scrollContentKeyboard
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEnabled={true}
            bounces={false}
          >
            {/* Header com logo - Reduzir quando teclado aparecer */}
            <View style={[
              styles.header,
              keyboardVisible && styles.headerCompact
            ]}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                disabled={loading}
              >
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
              
              <View style={styles.logoContainerMain}>
                {/* Logo do Universo do Saber */}
                <View style={[
                  styles.logoWrapper,
                  keyboardVisible && styles.logoWrapperCompact
                ]}>
                  {/* Caixa branca com bordas arredondadas para a logo */}
                  <View style={[
                    styles.logoContainer,
                    keyboardVisible && styles.logoContainerCompact
                  ]}>
                    <Image 
                      source={LogoUniversoSaber} 
                      style={[
                        styles.realLogo, 
                        keyboardVisible && styles.realLogoCompact
                      ]} 
                      resizeMode="contain" 
                    />
                  </View>
                </View>
                
                {!keyboardVisible && (
                  <>
                    <Text style={styles.schoolName}>
                      {theme.school.name}
                    </Text>
                    <Text style={styles.appName}>Alerta Escola</Text>
                  </>
                )}
              </View>
            </View>

            {/* Formulário */}
            <View style={[
              styles.formContainer,
              keyboardVisible && styles.formContainerKeyboard
            ]}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>
                  {isSignUp ? 'Criar Conta' : 'Entrar'}
                </Text>
                {!keyboardVisible && (
                  <Text style={styles.formSubtitle}>
                    {isSignUp 
                      ? 'Preencha os dados para criar sua conta' 
                      : 'Entre com suas credenciais'
                    }
                  </Text>
                )}
              </View>

              {/* Nome (apenas no cadastro) */}
              {isSignUp && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Nome Completo *</Text>
                  <View style={[
                    styles.inputWrapper,
                    activeInput === 'name' && styles.inputWrapperFocused
                  ]}>
                    <Ionicons name="person-outline" size={20} color={theme.colors.text.secondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Digite seu nome completo"
                      value={formData.name}
                      onChangeText={(value) => setFormData({...formData, name: value})}
                      onFocus={() => handleInputFocus('name')}
                      onBlur={handleInputBlur}
                      autoCapitalize="words"
                      editable={!loading}
                      returnKeyType="next"
                    />
                  </View>
                </View>
              )}

              {/* Email */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email *</Text>
                <View style={[
                  styles.inputWrapper,
                  activeInput === 'email' && styles.inputWrapperFocused
                ]}>
                  <Ionicons name="mail-outline" size={20} color={theme.colors.text.secondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Digite seu email"
                    value={formData.email}
                    onChangeText={(value) => setFormData({...formData, email: value})}
                    onFocus={() => handleInputFocus('email')}
                    onBlur={handleInputBlur}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!loading}
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* Senha */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Senha *</Text>
                <View style={[
                  styles.inputWrapper,
                  activeInput === 'password' && styles.inputWrapperFocused
                ]}>
                  <Ionicons name="lock-closed-outline" size={20} color={theme.colors.text.secondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Digite sua senha (mín. 6 caracteres)"
                    value={formData.password}
                    onChangeText={(value) => setFormData({...formData, password: value})}
                    onFocus={() => handleInputFocus('password')}
                    onBlur={handleInputBlur}
                    secureTextEntry
                    editable={!loading}
                    returnKeyType={isSignUp ? "next" : "done"}
                    onSubmitEditing={isSignUp ? undefined : handleAuth}
                  />
                </View>
              </View>

              {/* Seletor de perfil (apenas no cadastro) */}
              {isSignUp && !keyboardVisible && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Eu sou: *</Text>
                  <View style={styles.roleSelector}>
                    <TouchableOpacity
                      style={[
                        styles.roleButton,
                        formData.role === 'parent' && styles.roleButtonSelected
                      ]}
                      onPress={() => setFormData({...formData, role: 'parent'})}
                      disabled={loading}
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
                      disabled={loading}
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
                style={[
                  styles.authButton,
                  loading && styles.authButtonDisabled
                ]} 
                onPress={handleAuth}
                disabled={loading}
              >
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={styles.buttonText}>
                      {isSignUp ? 'Criando conta...' : 'Entrando...'}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.buttonText}>
                    {isSignUp ? 'Criar Conta' : 'Entrar'}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Toggle entre login e cadastro */}
              <View style={styles.toggleContainer}>
                <Text style={styles.toggleText}>
                  {isSignUp 
                    ? 'Já tem uma conta?' 
                    : 'Ainda não tem conta?'
                  }
                </Text>
                <TouchableOpacity 
                  onPress={toggleMode}
                  disabled={loading}
                >
                  <Text style={[
                    styles.toggleLink,
                    loading && styles.toggleLinkDisabled
                  ]}>
                    {isSignUp ? 'Fazer Login' : 'Criar Conta'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Indicador de campos obrigatórios */}
              {!keyboardVisible && (
                <Text style={styles.requiredNote}>
                  * Campos obrigatórios
                </Text>
              )}
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
    minHeight: screenHeight,
  },
  scrollContentKeyboard: {
    minHeight: screenHeight * 0.7, // Reduzir altura mínima quando teclado aparecer
  },
  header: {
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    position: 'relative',
    minHeight: 180,
  },
  headerCompact: {
    minHeight: 100,
    paddingTop: theme.spacing.sm,
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
    zIndex: 1,
  },
  logoContainerMain: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  logoContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  logoContainerCompact: {
    borderRadius: 12,
    padding: 8,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  logoWrapperCompact: {
    marginBottom: theme.spacing.xs,
  },
  // Logo real
  realLogo: {
    width: 70,
    height: 70,
  },
  realLogoCompact: {
    width: 45,
    height: 45,
  },
  // Logo placeholder - remova quando tiver a logo real
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoPlaceholderCompact: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  schoolName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  appName: {
    color: 'white',
    fontSize: theme.typography.body.fontSize,
    opacity: 0.9,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  formContainer: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.xl,
  },
  formContainerKeyboard: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.lg,
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  formTitle: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: theme.typography.h2.fontWeight,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  formSubtitle: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.typography.caption.fontSize,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    ...theme.shadows.small,
  },
  inputWrapperFocused: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  inputIcon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: theme.typography.body.fontSize,
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
    ...theme.shadows.small,
  },
  roleButtonSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  roleButtonText: {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.caption.fontSize,
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
    ...theme.shadows.medium,
  },
  authButtonDisabled: {
    backgroundColor: theme.colors.text.light,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  buttonText: {
    color: 'white',
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  toggleText: {
    color: theme.colors.text.secondary,
    marginRight: theme.spacing.sm,
    fontSize: theme.typography.caption.fontSize,
  },
  toggleLink: {
    color: theme.colors.primary,
    fontWeight: '600',
    fontSize: theme.typography.caption.fontSize,
  },
  toggleLinkDisabled: {
    color: theme.colors.text.light,
  },
  requiredNote: {
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.text.light,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
});