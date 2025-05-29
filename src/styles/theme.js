  export const theme = {
    colors: {
      // Cores do Universo do Saber
      primary: '#0066CC',      // Azul principal da logo
      secondary: '#004499',    // Azul mais escuro
      accent: '#0080FF',       // Azul mais claro para acentos
      
      // Backgrounds
      background: '#F8FAFC',   // Cinza muito claro
      surface: '#F8FAFC',      // Branco
      card: '#FFFFFF',
      
      // Text
      text: {
        primary: '#1E293B',    // Texto principal escuro
        secondary: '#64748B',  // Texto secundário
        light: '#94A3B8',      // Texto claro
        inverse: '#FFFFFF',    // Texto branco
      },
      
      // Status colors - mantendo harmonia com o azul
      success: '#10B981',      // Verde para sucesso
      warning: '#F59E0B',      // Laranja para avisos
      error: '#EF4444',        // Vermelho para erros
      info: '#0066CC',         // Azul da escola para informações
      
      // Borders
      border: '#E2E8F0',
      divider: '#F1F5F9',
      
      // Overlay
      overlay: 'rgba(0, 102, 204, 0.5)',    // Azul da escola com transparência
      backdrop: 'rgba(0, 68, 153, 0.3)',    // Azul escuro com transparência
      
      // Gradientes do Universo do Saber
      gradients: {
        primary: ['#0066CC', '#004499'],     // Azul principal para escuro
        secondary: ['#0080FF', '#0066CC'],   // Azul claro para principal
        accent: ['#87CEEB', '#0066CC'],      // Céu para azul (tema universo)
      }
    },
    
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
      xxl: 48,
    },
    
    borderRadius: {
      sm: 6,
      md: 10,
      lg: 16,
      xl: 24,
    },
    
    typography: {
      // Fonte principal - mais educacional
      fontFamily: {
        regular: 'System',
        medium: 'System',
        bold: 'System',
      },
      
      h1: {
        fontSize: 28,
        fontWeight: 'bold',
        lineHeight: 36,
        color: '#004499', // Azul escuro para títulos principais
      },
      h2: {
        fontSize: 24,
        fontWeight: 'bold',
        lineHeight: 32,
        color: '#0066CC', // Azul principal para subtítulos
      },
      h3: {
        fontSize: 20,
        fontWeight: '600',
        lineHeight: 28,
        color: '#0066CC',
      },
      body: {
        fontSize: 16,
        lineHeight: 24,
        color: '#1E293B',
      },
      caption: {
        fontSize: 14,
        lineHeight: 20,
        color: '#64748B',
      },
      small: {
        fontSize: 12,
        lineHeight: 16,
        color: '#94A3B8',
      }
    },
    
    shadows: {
      small: {
        shadowColor: '#0066CC',
        shadowOffset: {
          width: 0,
          height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      },
      medium: {
        shadowColor: '#004499',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 4,
      },
      large: {
        shadowColor: '#004499',
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
      }
    },
    
    // Elementos específicos do Universo do Saber
    school: {
      name: 'Centro Educacional Universo do Saber',
      shortName: 'Universo do Saber',
      colors: {
        star: '#FFFFFF',        // Cor das estrelas
        logoBlue: '#0066CC',    // Azul exato da logo
        logoDark: '#004499',    // Azul escuro da logo
      },
      
      // Configurações da logo
      logo: {
        width: 60,
        height: 60,
        borderRadius: 12,
      }
    }
  };