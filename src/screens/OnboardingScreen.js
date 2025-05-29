import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

// Substitua pela sua logo real quando disponível
// const LogoUniversoSaber = require('../../assets/images/logo-universo-saber.png');

const { width, height } = Dimensions.get('window');

const onboardingData = [
  {
    id: 1,
    icon: 'school-outline',
    title: 'Bem-vindos ao\nUniverso do Saber',
    subtitle: 'Conectando famílias e educadores para uma comunicação mais eficiente e segura',
    color: theme.colors.primary,
    backgroundColor: theme.colors.background,
  },
  {
    id: 2,
    icon: 'people-outline',
    title: 'Gestão de\nTurmas',
    subtitle: 'Professores criam turmas, organizam alunos e fazem chamadas de forma simples e prática',
    color: theme.colors.secondary,
    backgroundColor: theme.colors.background,
  },
  {
    id: 3,
    icon: 'chatbubbles-outline',
    title: 'Comunicação\nDireta',
    subtitle: 'Chat em tempo real entre responsáveis e professores para maior tranquilidade',
    color: theme.colors.accent,
    backgroundColor: theme.colors.background,
  },
  {
    id: 4,
    icon: 'notifications-outline',
    title: 'Alerta Escola\nCompleto',
    subtitle: 'Notificações inteligentes sobre presença, ausência e retirada de alunos',
    color: theme.colors.info,
    backgroundColor: theme.colors.background,
  }
];

export default function OnboardingScreen({ navigation }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef(null);

  const handleNext = () => {
    if (currentIndex < onboardingData.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      scrollViewRef.current?.scrollTo({
        x: nextIndex * width,
        animated: true,
      });
    } else {
      handleGetStarted();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      scrollViewRef.current?.scrollTo({
        x: prevIndex * width,
        animated: true,
      });
    }
  };

  const handleGetStarted = () => {
    navigation.navigate('Auth');
  };

  const handleSkip = () => {
    navigation.navigate('Auth');
  };

  // Função para lidar com o scroll manual (swipe)
  const handleScroll = (event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const currentPosition = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(currentPosition / slideSize);
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < onboardingData.length) {
      setCurrentIndex(newIndex);
    }
  };

  // Função para quando o usuário para de fazer scroll
  const handleScrollEnd = (event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const currentPosition = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(currentPosition / slideSize);
    
    // Garantir que estamos na posição correta
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      scrollViewRef.current?.scrollTo({
        x: newIndex * width,
        animated: true,
      });
    }
  };

  const renderSlide = (item, index) => {
    return (
      <SafeAreaView key={item.id} style={[styles.slide, { backgroundColor: item.backgroundColor }]}>
        <View style={styles.slideContent}>
          {/* Ilustração principal */}
          <View style={styles.illustrationContainer}>
            {/* Círculo principal com gradiente */}
            <LinearGradient
              colors={[item.color, theme.colors.secondary]}
              style={styles.mainCircle}
            >
              <Ionicons name={item.icon} size={50} color="white" />
            </LinearGradient>
            
            {/* Elementos decorativos */}
            <View style={[styles.decorativeCircle, styles.circle1, { backgroundColor: item.color + '20' }]} />
            <View style={[styles.decorativeCircle, styles.circle2, { backgroundColor: theme.colors.accent + '15' }]} />
            <View style={[styles.decorativeCircle, styles.circle3, { backgroundColor: theme.colors.secondary + '10' }]} />
          </View>

          {/* Conteúdo textual */}
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: item.color }]}>
              {item.title}
            </Text>
            <Text style={styles.subtitle}>
              {item.subtitle}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  };

  const currentSlide = onboardingData[currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={[styles.skipText, { color: currentSlide.color }]}>Pular</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={true}
        style={styles.scrollView}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        bounces={false}
        decelerationRate="fast"
      >
        {onboardingData.map((item, index) => renderSlide(item, index))}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {/* Indicadores - Agora clicáveis */}
        <View style={styles.indicators}>
          {onboardingData.map((_, index) => (
            <TouchableOpacity
              key={index}
              style={styles.indicatorButton}
              onPress={() => {
                setCurrentIndex(index);
                scrollViewRef.current?.scrollTo({
                  x: index * width,
                  animated: true,
                });
              }}
            >
              <View
                style={[
                  styles.indicator,
                  {
                    backgroundColor: index === currentIndex ? currentSlide.color : theme.colors.text.light,
                    width: index === currentIndex ? 24 : 8,
                  }
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Botões de navegação */}
        <View style={styles.navigationContainer}>
          {currentIndex > 0 && (
            <TouchableOpacity
              style={[styles.navButton, styles.prevButton, { borderColor: currentSlide.color }]}
              onPress={handlePrevious}
            >
              <Ionicons name="arrow-back" size={24} color={currentSlide.color} />
            </TouchableOpacity>
          )}

          <View style={styles.spacer} />

          {/* Botão que cresce suavemente */}
          <TouchableOpacity
            style={[
              styles.navButton, 
              styles.nextButton,
              currentIndex === onboardingData.length - 1 && styles.getStartedButtonExpanded
            ]}
            onPress={handleNext}
          >
            <LinearGradient
              colors={theme.colors.gradients.primary}
              style={[
                styles.gradientButton,
                currentIndex === onboardingData.length - 1 && styles.gradientButtonExpanded
              ]}
            >
              {currentIndex === onboardingData.length - 1 ? (
                <Text style={styles.getStartedText}>Começar</Text>
              ) : (
                <Ionicons name="arrow-forward" size={24} color="white" />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Branding do Universo do Saber */}
        <View style={styles.schoolBranding}>
          {/* Logo placeholder - substitua quando tiver a logo real */}
          <View style={styles.logoPlaceholder}>
            <Ionicons name="school" size={24} color={theme.colors.primary} />
          </View>
          
          {/* Para usar logo real, descomente e ajuste:
          <Image 
            source={LogoUniversoSaber} 
            style={styles.realLogo} 
            resizeMode="contain" 
          />
          */}
          
          <Text style={styles.schoolName}>{theme.school.name}</Text>
          <Text style={styles.appVersion}>Alerta Escola v1.0</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    height: 60,
  },
  skipButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width: width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideContent: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  illustrationContainer: {
    position: 'relative',
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  mainCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.large,
    zIndex: 3,
  },
  decorativeCircle: {
    position: 'absolute',
    borderRadius: 1000,
  },
  circle1: {
    width: 140,
    height: 140,
    top: 10,
    left: 10,
    zIndex: 1,
  },
  circle2: {
    width: 50,
    height: 50,
    top: 5,
    right: 5,
    zIndex: 2,
  },
  circle3: {
    width: 30,
    height: 30,
    bottom: 15,
    left: 20,
    zIndex: 2,
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: theme.spacing.sm,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    minHeight: 200, // Altura mínima fixa para evitar cortes
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  indicatorButton: {
    padding: 4, // Área de toque maior
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    height: 8,
    borderRadius: 4,
    transition: 'all 0.3s ease',
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  navButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.medium,
  },
  prevButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
  },
  nextButton: {
    overflow: 'hidden',
  },
  gradientButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 28,
  },
  gradientButtonExpanded: {
    borderRadius: 28,
    paddingHorizontal: 8,
  },
  spacer: {
    flex: 1,
  },
  getStartedButtonExpanded: {
    width: 120, // Largura fixa para evitar saltos
    height: 56,
  },
  getStartedText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  schoolBranding: {
    alignItems: 'center',
  },
  logoPlaceholder: {
    width: 50,
    height: 50,
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  realLogo: {
    width: 50,
    height: 50,
    borderRadius: 10,
    marginBottom: theme.spacing.sm,
  },
  schoolName: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  appVersion: {
    fontSize: 12,
    color: theme.colors.text.light,
    textAlign: 'center',
  },
});