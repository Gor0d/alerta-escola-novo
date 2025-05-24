export const theme = {
  colors: {
    primary: '#4F46E5',      // Azul principal
    secondary: '#7C3AED',    // Roxo
    accent: '#06B6D4',       // Ciano
    background: '#F8FAFC',   // Cinza muito claro
    surface: '#FFFFFF',      // Branco
    text: {
      primary: '#1E293B',
      secondary: '#64748B',
      light: '#94A3B8'
    },
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    border: '#E2E8F0'
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48
  },
  borderRadius: {
    sm: 6,
    md: 10,
    lg: 16,
    xl: 24
  },
  typography: {
    h1: {
      fontSize: 28,
      fontWeight: 'bold',
      lineHeight: 36
    },
    h2: {
      fontSize: 24,
      fontWeight: 'bold',
      lineHeight: 32
    },
    h3: {
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 28
    },
    body: {
      fontSize: 16,
      lineHeight: 24
    },
    caption: {
      fontSize: 14,
      lineHeight: 20
    },
    small: {
      fontSize: 12,
      lineHeight: 16
    }
  },
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
    }
  }
};