// src/screens/NoticeBoardScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Image,
  ActivityIndicator,
  RefreshControl,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../services/supabase';

// Tema local (caso o arquivo externo não funcione)
const theme = {
  colors: {
    primary: '#0066CC',
    secondary: '#004499',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    
    background: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    
    text: {
      primary: '#1F2937',
      secondary: '#6B7280',
      light: '#9CA3AF',
      inverse: '#FFFFFF'
    }
  },
  
  typography: {
    h1: { fontSize: 32, fontWeight: 'bold' },
    h2: { fontSize: 24, fontWeight: 'bold' },
    h3: { fontSize: 20, fontWeight: '600' },
    body: { fontSize: 16, fontWeight: 'normal' },
    bodySmall: { fontSize: 14, fontWeight: 'normal' },
    caption: { fontSize: 12, fontWeight: 'normal' }
  },
  
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: { sm: 4, md: 8, lg: 12, xl: 16 },
  
  shadows: {
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    }
  },
  
  school: {
    name: 'Universo do Saber',
    shortName: 'Universo do Saber',
  }
};

export default function NoticeBoardScreen({ route, navigation }) {
  const { userRole, classId } = route.params || {};
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);
  
  // Estados do formulário
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noticeType, setNoticeType] = useState('general');
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedAttachment, setSelectedAttachment] = useState(null);

  const noticeTypes = [
    { key: 'general', label: 'Aviso Geral', icon: 'information-circle', color: theme.colors.info },
    { key: 'event', label: 'Evento', icon: 'calendar', color: theme.colors.success },
    { key: 'announcement', label: 'Comunicado', icon: 'megaphone', color: theme.colors.warning },
    { key: 'urgent', label: 'Urgente', icon: 'warning', color: theme.colors.error }
  ];

  useEffect(() => {
    fetchNotices();
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        console.log('⚠️ Permissão para galeria negada');
      }
    } catch (error) {
      console.error('❌ Erro ao solicitar permissões:', error);
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setNoticeType('general');
    setSelectedImage(null);
    setSelectedAttachment(null);
  };

  const fetchNotices = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('notices')
        .select(`
          *,
          author:profiles(name),
          class:classes(name)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (classId) {
        query = query.or(`class_id.eq.${classId},class_id.is.null`);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setNotices(data || []);
    } catch (error) {
      console.error('Erro ao buscar avisos:', error);
      Alert.alert('Erro', 'Não foi possível carregar os avisos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotices();
  };

  const pickImage = async () => {
    dismissKeyboard();
    
    try {
      console.log('📸 Iniciando seleção de imagem...');
      
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Necessária', 
          'Precisamos de permissão para acessar sua galeria de fotos.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { 
              text: 'Configurações', 
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Alert.alert('Configurações', 'Vá em Configurações > Privacidade > Fotos e ative para este app');
                } else {
                  Alert.alert('Configurações', 'Vá em Configurações > Apps > Permissões e ative o acesso à galeria');
                }
              }
            }
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        setSelectedImage(selectedAsset);
        Alert.alert('Sucesso', 'Imagem selecionada com sucesso!');
      }
    } catch (error) {
      console.error('❌ Erro ao selecionar imagem:', error);
      Alert.alert('Erro', `Não foi possível selecionar a imagem: ${error.message}`);
    }
  };

  const pickDocument = async () => {
    dismissKeyboard();
    
    try {
      console.log('📎 Iniciando seleção de documento...');
      
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'text/*', 'application/msword'],
        copyToCacheDirectory: true,
        multiple: false
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedDoc = result.assets[0];
        setSelectedAttachment(selectedDoc);
        Alert.alert('Sucesso', 'Documento selecionado com sucesso!');
      }
    } catch (error) {
      console.error('❌ Erro ao selecionar documento:', error);
      Alert.alert('Erro', `Não foi possível selecionar o documento: ${error.message}`);
    }
  };

  const handleCreateNotice = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Erro', 'Título e conteúdo são obrigatórios');
      return;
    }

    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      const noticeData = {
        title: title.trim(),
        content: content.trim(),
        type: noticeType,
        class_id: classId || null,
        author_id: user.id,
        image_url: selectedImage?.uri || null,
        attachment_url: selectedAttachment?.uri || null
      };

      const { data, error } = await supabase
        .from('notices')
        .insert([noticeData])
        .select();

      if (error) throw error;

      Alert.alert('Sucesso', 'Aviso criado com sucesso!');
      resetForm();
      setModalVisible(false);
      fetchNotices();
    } catch (error) {
      console.error('❌ Erro ao criar aviso:', error);
      Alert.alert('Erro', `Não foi possível criar o aviso: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNotice = async (notice) => {
    Alert.alert(
      'Excluir Aviso',
      `Tem certeza que deseja excluir o aviso "${notice.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              const { data: { user } } = await supabase.auth.getUser();
              
              if (notice.author_id !== user.id) {
                Alert.alert('Erro', 'Você só pode excluir seus próprios avisos');
                return;
              }

              const { error } = await supabase
                .from('notices')
                .delete()
                .eq('id', notice.id)
                .eq('author_id', user.id);

              if (error) throw error;

              setNotices(notices.filter(n => n.id !== notice.id));
              Alert.alert('Sucesso', 'Aviso excluído com sucesso!');
            } catch (error) {
              console.error('❌ Erro ao excluir aviso:', error);
              Alert.alert('Erro', `Não foi possível excluir o aviso: ${error.message}`);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getNoticeTypeInfo = (type) => {
    return noticeTypes.find(nt => nt.key === type) || noticeTypes[0];
  };

  const renderNoticeItem = ({ item }) => {
    const typeInfo = getNoticeTypeInfo(item.type);
    
    return (
      <TouchableOpacity
        style={[styles.noticeCard, theme.shadows.medium]}
        onPress={() => setSelectedNotice(item)}
      >
        <View style={styles.noticeHeader}>
          <View style={[styles.typeIcon, { backgroundColor: typeInfo.color }]}>
            <Ionicons name={typeInfo.icon} size={20} color={theme.colors.text.inverse} />
          </View>
          <View style={styles.noticeInfo}>
            <Text style={[styles.noticeTitle, { color: theme.colors.text.primary }]}>
              {item.title}
            </Text>
            <Text style={[styles.noticeAuthor, { color: theme.colors.text.secondary }]}>
              Por: {item.author?.name} • {formatDate(item.created_at)}
            </Text>
            {item.class?.name && (
              <Text style={[styles.noticeClass, { color: theme.colors.primary }]}>
                Turma: {item.class.name}
              </Text>
            )}
          </View>
          
          {userRole === 'teacher' && (
            <TouchableOpacity
              style={styles.deleteNoticeButton}
              onPress={(e) => {
                e.stopPropagation();
                handleDeleteNotice(item);
              }}
            >
              <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
            </TouchableOpacity>
          )}
        </View>
        
        <Text style={[styles.noticeContent, { color: theme.colors.text.primary }]} numberOfLines={3}>
          {item.content}
        </Text>
        
        {item.image_url && !item.image_url.includes('example.com') && (
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: item.image_url }} 
              style={styles.attachedImage}
              resizeMode="cover"
            />
          </View>
        )}
        
        <View style={styles.noticeFooter}>
          <Text style={[styles.typeLabel, { color: typeInfo.color }]}>
            {typeInfo.label}
          </Text>
          <View style={styles.noticeFooterIcons}>
            {item.attachment_url && (
              <Ionicons name="attach" size={16} color={theme.colors.text.secondary} />
            )}
            {userRole === 'teacher' && (
              <Ionicons name="create-outline" size={16} color={theme.colors.text.light} style={{ marginLeft: 8 }} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTypeSelector = () => (
    <View style={styles.typeSelector}>
      {noticeTypes.map((type) => (
        <TouchableOpacity
          key={type.key}
          style={[
            styles.typeOption,
            { borderColor: type.color },
            noticeType === type.key && { backgroundColor: type.color }
          ]}
          onPress={() => {
            dismissKeyboard();
            setNoticeType(type.key);
          }}
        >
          <Ionicons
            name={type.icon}
            size={18}
            color={noticeType === type.key ? theme.colors.text.inverse : type.color}
          />
          <Text
            style={[
              styles.typeOptionText,
              { color: noticeType === type.key ? theme.colors.text.inverse : type.color }
            ]}
          >
            {type.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.inverse} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: theme.colors.text.inverse }]}>
            Mural de Avisos
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.text.inverse }]}>
            {theme.school.shortName}
          </Text>
        </View>
        {userRole === 'teacher' && (
          <TouchableOpacity onPress={() => setModalVisible(true)}>
            <Ionicons name="add" size={24} color={theme.colors.text.inverse} />
          </TouchableOpacity>
        )}
      </View>

      {loading && notices.length === 0 ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={notices}
          keyExtractor={(item) => item.id}
          renderItem={renderNoticeItem}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
            />
          }
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="newspaper-outline" size={64} color={theme.colors.text.light} />
              <Text style={[styles.emptyStateText, { color: theme.colors.text.secondary }]}>
                Nenhum aviso encontrado
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: theme.colors.text.light }]}>
                {userRole === 'teacher' 
                  ? 'Toque no + para criar seu primeiro aviso'
                  : 'Aguarde novos avisos dos professores'
                }
              </Text>
            </View>
          }
        />
      )}

      {/* Modal para criar aviso */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <View style={styles.modalContainer}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                <ScrollView 
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: theme.colors.text.primary }]}>
                      Novo Aviso
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: theme.colors.text.secondary }]}>
                      {theme.school.shortName}
                    </Text>
                  </View>
                  
                  <TextInput
                    style={[styles.input, { 
                      borderColor: theme.colors.border,
                      color: theme.colors.text.primary 
                    }]}
                    placeholder="Título do aviso"
                    placeholderTextColor={theme.colors.text.light}
                    value={title}
                    onChangeText={setTitle}
                    maxLength={100}
                    returnKeyType="next"
                    blurOnSubmit={false}
                  />
                  
                  <TextInput
                    style={[styles.input, styles.textArea, { 
                      borderColor: theme.colors.border,
                      color: theme.colors.text.primary 
                    }]}
                    placeholder="Conteúdo do aviso"
                    placeholderTextColor={theme.colors.text.light}
                    value={content}
                    onChangeText={setContent}
                    multiline
                    numberOfLines={4}
                    maxLength={500}
                    returnKeyType="done"
                    blurOnSubmit={true}
                  />

                  <Text style={[styles.sectionLabel, { color: theme.colors.text.primary }]}>
                    Tipo do Aviso:
                  </Text>
                  {renderTypeSelector()}

                  <View style={styles.attachmentSection}>
                    <TouchableOpacity 
                      style={[styles.attachButton, { borderColor: theme.colors.primary }]} 
                      onPress={pickImage}
                    >
                      <Ionicons name="image" size={20} color={theme.colors.primary} />
                      <Text style={[styles.attachButtonText, { color: theme.colors.primary }]}>
                        Adicionar Imagem
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.attachButton, { borderColor: theme.colors.primary }]} 
                      onPress={pickDocument}
                    >
                      <Ionicons name="attach" size={20} color={theme.colors.primary} />
                      <Text style={[styles.attachButtonText, { color: theme.colors.primary }]}>
                        Adicionar Anexo
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {selectedImage && (
                    <View style={[styles.selectedFile, { backgroundColor: theme.colors.success + '20' }]}>
                      <Image 
                        source={{ uri: selectedImage.uri }} 
                        style={styles.previewImage}
                        resizeMode="cover"
                      />
                      <View style={styles.selectedFileInfo}>
                        <Ionicons name="image" size={16} color={theme.colors.success} />
                        <Text style={[styles.selectedFileText, { color: theme.colors.success }]}>
                          Imagem selecionada
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.removeFileButton}
                        onPress={() => setSelectedImage(null)}
                      >
                        <Ionicons name="close-circle" size={16} color={theme.colors.error} />
                      </TouchableOpacity>
                    </View>
                  )}

                  {selectedAttachment && (
                    <View style={[styles.selectedFile, { backgroundColor: theme.colors.success + '20' }]}>
                      <Ionicons name="attach" size={16} color={theme.colors.success} />
                      <Text style={[styles.selectedFileText, { color: theme.colors.success }]} numberOfLines={1}>
                        {selectedAttachment.name}
                      </Text>
                      <TouchableOpacity 
                        style={styles.removeFileButton}
                        onPress={() => setSelectedAttachment(null)}
                      >
                        <Ionicons name="close-circle" size={16} color={theme.colors.error} />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton, { backgroundColor: theme.colors.border }]}
                      onPress={() => {
                        dismissKeyboard();
                        setModalVisible(false);
                        resetForm();
                      }}
                    >
                      <Text style={[styles.buttonText, { color: theme.colors.text.secondary }]}>
                        Cancelar
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.button, styles.saveButton, { backgroundColor: theme.colors.primary }]}
                      onPress={() => {
                        dismissKeyboard();
                        handleCreateNotice();
                      }}
                      disabled={loading}
                    >
                      <Text style={[styles.buttonText, { color: theme.colors.text.inverse }]}>
                        {loading ? 'Criando...' : 'Criar Aviso'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Modal para visualizar aviso */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={!!selectedNotice}
        onRequestClose={() => setSelectedNotice(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedNotice(null)}>
          <View style={styles.modalContainer}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {selectedNotice && (
                    <>
                      <View style={styles.noticeDetailHeader}>
                        <View style={[
                          styles.typeIcon, 
                          { backgroundColor: getNoticeTypeInfo(selectedNotice.type).color }
                        ]}>
                          <Ionicons 
                            name={getNoticeTypeInfo(selectedNotice.type).icon} 
                            size={20} 
                            color={theme.colors.text.inverse}
                          />
                        </View>
                        <View style={styles.noticeDetailTitleContainer}>
                          <Text style={[styles.noticeDetailTitle, { color: theme.colors.text.primary }]}>
                            {selectedNotice.title}
                          </Text>
                          <Text style={[styles.schoolBadge, { color: theme.colors.primary }]}>
                            {theme.school.shortName}
                          </Text>
                        </View>
                      </View>
                      
                      <Text style={[styles.noticeDetailMeta, { color: theme.colors.text.secondary }]}>
                        Por: {selectedNotice.author?.name} • {formatDate(selectedNotice.created_at)}
                      </Text>
                      
                      {selectedNotice.class?.name && (
                        <Text style={[styles.noticeDetailClass, { color: theme.colors.primary }]}>
                          Turma: {selectedNotice.class.name}
                        </Text>
                      )}
                      
                      <Text style={[styles.noticeDetailContent, { color: theme.colors.text.primary }]}>
                        {selectedNotice.content}
                      </Text>
                      
                      {selectedNotice.image_url && !selectedNotice.image_url.includes('example.com') && (
                        <View style={styles.imageContainer}>
                          <Image 
                            source={{ uri: selectedNotice.image_url }} 
                            style={styles.fullImage}
                            resizeMode="contain"
                          />
                        </View>
                      )}
                      
                      {selectedNotice.attachment_url && (
                        <TouchableOpacity 
                          style={[styles.attachmentLink, { backgroundColor: theme.colors.primary + '10' }]}
                          onPress={() => {
                            Alert.alert('Anexo', 'Arquivo anexado ao aviso');
                          }}
                        >
                          <Ionicons name="attach" size={20} color={theme.colors.primary} />
                          <Text style={[styles.attachmentLinkText, { color: theme.colors.primary }]}>
                            Ver Anexo
                          </Text>
                        </TouchableOpacity>
                      )}
                      
                      <TouchableOpacity
                        style={[styles.closeButton, { backgroundColor: theme.colors.primary }]}
                        onPress={() => setSelectedNotice(null)}
                      >
                        <Text style={[styles.closeButtonText, { color: theme.colors.text.inverse }]}>
                          Fechar
                        </Text>
                      </TouchableOpacity>
                      
                      {userRole === 'teacher' && (
                        <TouchableOpacity
                          style={[styles.deleteButton, { backgroundColor: theme.colors.error, marginTop: 8 }]}
                          onPress={() => {
                            setSelectedNotice(null);
                            setTimeout(() => handleDeleteNotice(selectedNotice), 100);
                          }}
                        >
                          <Ionicons name="trash" size={18} color="white" />
                          <Text style={[styles.deleteButtonText, { color: 'white', marginLeft: 8 }]}>
                            Excluir Aviso
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
    opacity: 0.9,
    marginTop: 2,
  },
  listContainer: {
    padding: 16,
  },
  noticeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  noticeInfo: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  noticeAuthor: {
    fontSize: 12,
  },
  noticeClass: {
    fontSize: 12,
    marginTop: 2,
  },
  noticeContent: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  noticeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noticeFooterIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteNoticeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EF444415',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '85%',
    borderRadius: 12,
    padding: 24,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    margin: 4,
  },
  typeOptionText: {
    marginLeft: 5,
    fontSize: 12,
    fontWeight: '500',
  },
  attachmentSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  attachButtonText: {
    marginLeft: 5,
    fontWeight: '500',
    fontSize: 12,
  },
  imageContainer: {
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  attachedImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#F8FAFC',
  },
  fullImage: {
    width: '100%',
    height: 250,
    backgroundColor: '#F8FAFC',
  },
  previewImage: {
    width: 60,
    height: 40,
    borderRadius: 8,
    marginRight: 8,
  },
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  selectedFileInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedFileText: {
    flex: 1,
    marginLeft: 5,
    fontSize: 12,
  },
  removeFileButton: {
    marginLeft: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  button: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {},
  saveButton: {},
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyStateText: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },
  loader: {
    marginTop: 50,
  },
  // Estilos para visualização de aviso
  noticeDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  noticeDetailTitleContainer: {
    flex: 1,
    marginLeft: 8,
  },
  noticeDetailTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  schoolBadge: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  noticeDetailMeta: {
    fontSize: 12,
    marginBottom: 5,
  },
  noticeDetailClass: {
    fontSize: 12,
    marginBottom: 16,
  },
  noticeDetailContent: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  attachmentLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  attachmentLinkText: {
    marginLeft: 8,
    fontWeight: '500',
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
});