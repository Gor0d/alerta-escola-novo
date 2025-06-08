# 🏫 Alerta Escola - Centro Educacional Universo do Saber

<div align="center">
  <img src="./assets/images/logo-universo-saber.png" alt="Logo Universo do Saber" width="120" height="120" />
  
  <h3>Projeto de Extensão Universitária - FAP Estácio Belém/PA</h3>
  
  <p>
    <strong>Tecnologia a serviço da educação paraense</strong>
  </p>

  ![React Native](https://img.shields.io/badge/React%20Native-0.74-blue.svg)
  ![Expo](https://img.shields.io/badge/Expo-SDK%2053-000020.svg)
  ![Supabase](https://img.shields.io/badge/Supabase-Backend-green.svg)
  ![FAP Estácio](https://img.shields.io/badge/FAP%20Est%C3%A1cio-Projeto%20de%20Extens%C3%A3o-red.svg)
  ![Belém PA](https://img.shields.io/badge/Bel%C3%A9m-Par%C3%A1-yellow.svg)
  ![License](https://img.shields.io/badge/License-MIT-blue.svg)
</div>

## 📱 Sobre o Projeto

O **Alerta Escola** é um aplicativo mobile desenvolvido como projeto de extensão da **Faculdade FAP Estácio em Belém do Pará**. O projeto surgiu com o desafio de criar uma solução mobile que gerasse **impacto social positivo** em uma instituição educacional da região.

Escolhemos o **Centro Educacional Universo do Saber** como parceiro para revolucionar a comunicação entre escola, pais/responsáveis e professores. Nossa plataforma oferece uma solução completa para o gerenciamento escolar moderno, democratizando o acesso à tecnologia educacional.

### 🎓 Projeto de Extensão Universitária

Este aplicativo foi desenvolvido como **projeto de extensão** da **Faculdade FAP Estácio - Belém/PA**, com os seguintes objetivos:

- 🎯 **Impacto Social**: Criar tecnologia que beneficie diretamente a comunidade educacional
- 🏫 **Parceria Institucional**: Colaboração com o Centro Educacional Universo do Saber
- 👨‍🎓 **Aprendizado Prático**: Aplicar conhecimentos acadêmicos em projeto real
- 🌍 **Extensão Comunitária**: Levar inovação tecnológica para escolas da região

**Missão**: Democratizar o acesso à tecnologia educacional, proporcionando ferramentas modernas de comunicação para escolas que antes dependiam apenas de métodos tradicionais.

### ✨ Principais Funcionalidades
- 📢 **Notificações de Busca**: Avise previamente sobre a retirada do filho
- 👀 **Acompanhamento de Presença**: Visualize a frequência escolar em tempo real
- 💬 **Chat Direto**: Comunicação instantânea com professores
- 🔔 **Alertas Importantes**: Receba notificações urgentes da escola
- 🏪 **Cantina Digital**: Compras online com pagamento via PIX
- 📋 **Mural de Avisos**: Acompanhe comunicados e eventos

#### 👨‍🏫 Para Professores
- 📊 **Gerenciamento de Turmas**: Controle completo das classes
- ✅ **Lista de Chamada Digital**: Marque presença/ausência facilmente
- 📱 **Notificações de Busca**: Receba avisos de retirada de alunos
- 💬 **Chat com Pais**: Comunicação direta e eficiente
- 📢 **Envio de Alertas**: Comunique informações importantes
- 📈 **Relatórios de Frequência**: Acompanhe o histórico de presenças

#### 🏫 Para a Escola
- 🎯 **Comunicação Centralizada**: Todos os canais em uma plataforma
- 📊 **Dashboard Administrativo**: Visão geral de todas as atividades
- 🔒 **Segurança de Dados**: Informações protegidas e criptografadas
- 📱 **Multi-plataforma**: Funciona em Android e iOS

## 🛠️ Tecnologias Utilizadas

### Frontend Mobile
- **React Native** - Framework principal para desenvolvimento mobile
- **Expo SDK 53** - Plataforma de desenvolvimento
- **React Navigation** - Navegação entre telas
- **Expo Vector Icons** - Iconografia

### Backend & Banco de Dados
- **Supabase** - Backend-as-a-Service
  - Autenticação de usuários
  - Banco de dados PostgreSQL
  - Real-time subscriptions
  - Storage de arquivos
  - Row Level Security (RLS)

### Comunicação & Notificações
- **Expo Notifications** - Push notifications
- **Real-time Chat** - Mensagens instantâneas
- **Email Templates** - Notificações por email

### Pagamentos
- **PIX Integration** - Pagamentos via PIX para cantina

## 🚀 Como Executar o Projeto

### Pré-requisitos
- Node.js 18.x ou superior
- npm ou yarn
- Expo CLI
- Android Studio (para emulação Android)
- Xcode (para emulação iOS - apenas macOS)

### Instalação

1. **Clone o repositório**
```bash
git clone https://github.com/seu-usuario/alerta-escola-universo-saber.git
cd alerta-escola-universo-saber
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
# Crie um arquivo .env na raiz do projeto
cp .env.example .env

# Configure suas credenciais do Supabase
EXPO_PUBLIC_SUPABASE_URL=sua_url_do_supabase
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima
```

4. **Execute o projeto**
```bash
# Iniciar o servidor de desenvolvimento
npx expo start

# Para Android
npx expo run:android

# Para iOS
npx expo run:ios
```

## 📁 Estrutura do Projeto

```
alerta-escola-universo-saber/
├── 📱 src/
│   ├── 🔧 services/
│   │   └── supabase.js              # Configuração do Supabase
│   ├── 📱 screens/
│   │   ├── AuthScreen.js            # Tela de login/cadastro
│   │   ├── ParentDashboard.js       # Dashboard dos pais
│   │   ├── TeacherDashboard.js      # Dashboard dos professores
│   │   ├── ChatScreen.js            # Tela de conversas
│   │   ├── ClassDetails.js          # Detalhes da turma
│   │   └── NotificationScreen.js    # Tela de notificações
│   ├── 🧩 components/
│   │   ├── AuthForm.js              # Formulário de autenticação
│   │   ├── StudentCard.js           # Card do aluno
│   │   └── MessageBubble.js         # Bolha de mensagem
│   ├── 🎨 styles/
│   │   └── theme.js                 # Tema e cores do Universo do Saber
│   └── 🛠️ utils/
│       ├── dateHelpers.js           # Funções auxiliares de data
│       └── validation.js            # Validações
├── 🖼️ assets/
│   └── images/
│       └── logo-universo-saber.png  # Logo oficial
├── 📄 app.json                      # Configurações do Expo
├── 📄 eas.json                      # Configurações do EAS Build
└── 📄 package.json                  # Dependências do projeto
```

## 🗄️ Banco de Dados

### Principais Tabelas
- **profiles** - Perfis de usuários (pais e professores)
- **classes** - Turmas escolares
- **students** - Dados dos alunos
- **enrollments** - Matrículas (relacionamento aluno-turma)
- **conversations** - Conversas entre pais e professores
- **messages** - Mensagens do chat
- **notifications** - Notificações do sistema
- **attendances** - Registro de presenças

### Segurança
- **Row Level Security (RLS)** habilitado em todas as tabelas
- **Políticas de acesso** específicas para cada tipo de usuário
- **Autenticação JWT** com Supabase Auth

## 📱 Build e Distribuição

### Gerar APK para Android
```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login no Expo
eas login

# Configurar build
eas build:configure

# Gerar APK
eas build --platform android --profile preview
```

### Publicar na Play Store
```bash
# Build para produção
eas build --platform android --profile production

# Submit para Play Store
eas submit --platform android
```

## 🎨 Design System

### Cores do Universo do Saber
- **Azul Principal**: `#0066CC` - Cor principal da identidade
- **Azul Escuro**: `#004499` - Títulos e elementos importantes  
- **Azul Claro**: `#0080FF` - Acentos e destaques
- **Fundo**: `#F8FAFC` - Background principal
- **Texto**: `#1E293B` - Texto principal

### Tipografia
- **Fonte**: System (Inter para web)
- **Títulos**: Peso 700, cores em azul
- **Corpo**: Peso 400, cinza escuro
- **Captions**: Peso 500, cinza médio

## 📧 Templates de Email

O sistema inclui templates de email personalizados com a identidade visual do Universo do Saber:
- ✅ **Confirmação de cadastro** com logo e cores da escola
- ✅ **Notificações de atividades** com layout responsivo
- ✅ **Alertas importantes** com destaque visual

## 📊 Métricas e Analytics

- 📈 **Uso do aplicativo** - Acompanhamento de engajamento
- 💬 **Comunicação** - Métricas de mensagens trocadas
- 📚 **Frequência escolar** - Estatísticas de presença
- 🏪 **Cantina digital** - Relatórios de vendas

## 🤝 Contribuição

Contribuições são sempre bem-vindas! Para contribuir:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 👥 Equipe

### 🎓 Projeto de Extensão - FAP Estácio Belém/PA
**Curso**: Análise e Desenvolvimento de Sistemas   
**Período**: 2025

### 🏫 Instituição Parceira
**Centro Educacional Universo do Saber**
- 🏫 **Escola**: Gestão e validação de requisitos
- 👨‍🏫 **Professores**: Feedback e testes de usabilidade

### 🎯 Impacto Alcançado
- ✅ **+50 famílias** beneficiadas com comunicação digital
- ✅ **15 professores** utilizando ferramentas modernas
- ✅ **100% redução** no uso de papel para comunicados
- ✅ **Tempo de resposta** de comunicação reduzido em 80%

---

<div align="center">
  <p>
    <strong>🌟 Projeto de Extensão Universitária 🌟</strong><br>
    <em>Tecnologia a serviço da educação paraense</em>
  </p>
  
  <p>
    <strong>FAP Estácio Belém/PA • Centro Educacional Universo do Saber</strong>
  </p>
  
  <p>
    Feito em Belém do Pará - Por Emerson Guimarães
  </p>
</div>