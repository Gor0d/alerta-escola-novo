import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  SafeAreaView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

const { width, height } = Dimensions.get('window');

export default function OnboardingScreen({ navigation }) {
  const slides = [
    {
      id: 1,
      title: 'Bem-vindo ao\nAlerta Escola',
      subtitle: 'Comunicação direta entre pais e professores para a segurança dos seus filhos',
      icon: 'school-outline',
      color: theme.colors.primary
    },
    {
      id: 2,
      title: 'Notificações\nInstantâneas',
      subtitle: 'Receba e envie alertas em tempo real sobre a retirada dos alunos',
      icon: 'notifications-outline',
      color: theme.colors.accent
    },
    {
      id: 3,
      title: 'Controle de\nPresença',
      subtitle: 'Acompanhe a presença dos alunos e mantenha os pais sempre informados',
      icon: 'checkmark-circle-outline',
      color: theme.colors.success
    }
  ];

  const [currentSlide, setCurrentSlide] = React.useState(0);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      // Navegar para a tela de login
      navigation.navigate('Auth');
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const goToAuth = () => {
    navigation.navigate('Auth');
  };

  const currentSlideData = slides[currentSlide];

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[currentSlideData.color, currentSlideData.color + '80']}
        style={styles.gradient}
      >
        {/* Header com logo da escola */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            {/* Por enquanto, ícone placeholder */}
            <View style={styles.logoPlaceholder}>
              <Ionicons name="school" size={40} color="white" />
              <Text style={styles.logoText}>Logo da Escola</Text>
            </View>
          </View>
        </View>

        {/* Conteúdo principal */}
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name={currentSlideData.icon} 
              size={120} 
              color="white" 
            />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.title}>{currentSlideData.title}</Text>
            <Text style={styles.subtitle}>{currentSlideData.subtitle}</Text>
          </View>

          {/* Indicadores de slide */}
          <View style={styles.pagination}>
            {slides.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === currentSlide && styles.paginationDotActive
                ]}
              />
            ))}
          </View>
        </View>

        {/* Footer com botões */}
        <View style={styles.footer}>
          <View style={styles.buttonContainer}>
            {currentSlide > 0 && (
              <TouchableOpacity style={styles.backButton} onPress={prevSlide}>
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.skipButton} onPress={goToAuth}>
              <Text style={styles.skipButtonText}>Pular</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.nextButton} onPress={nextSlide}>
              {currentSlide === slides.length - 1 ? (
                <Text style={styles.nextButtonText}>Começar</Text>
              ) : (
                <Ionicons name="arrow-forward" size={24} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </View>
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
  header: {
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoPlaceholder: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  logoText: {
    color: 'white',
    fontSize: 12,
    marginTop: theme.spacing.xs,
    opacity: 0.8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  iconContainer: {
    marginBottom: theme.spacing.xxl,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  title: {
    ...theme.typography.h1,
    color: 'white',
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    fontWeight: 'bold',
  },
  subtitle: {
    ...theme.typography.body,
    color: 'white',
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 24,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: 'white',
    width: 24,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  skipButtonText: {
    color: 'white',
    fontSize: 16,
    opacity: 0.8,
  },
  nextButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});