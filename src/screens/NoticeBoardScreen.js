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
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../services/supabase';
import { theme } from '../styles/theme';

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
  }, []);

  // NOVA FUNÇÃO: Dispensar teclado
  const dismissKeyboard = () => {
    Keyboard.dismiss();
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

      // Filtrar por turma se especificado
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
    // Dispensar teclado antes de abrir o picker
    dismissKeyboard();
    
    try {
      // CORRIGIDO: Usar MediaType em vez de MediaTypeOptions (deprecated)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        base64: false,
      });

      console.log('📸 Resultado do picker:', {
        canceled: result.canceled,
        hasAssets: result.assets?.length > 0,
        uri: result.assets?.[0]?.uri?.substring(0, 80) + '...' || 'N/A'
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        console.log('✅ Imagem selecionada:', {
          uri: selectedAsset.uri,
          width: selectedAsset.width,
          height: selectedAsset.height,
          fileSize: selectedAsset.fileSize
        });
        setSelectedImage(selectedAsset);
      }
    } catch (error) {
      console.error('❌ Erro ao selecionar imagem:', error);
      Alert.alert('Erro', 'Não foi possível selecionar a imagem');
    }
  };

  const pickDocument = async () => {
    // Dispensar teclado antes de abrir o picker
    dismissKeyboard();
    
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*', 'text/*'],
      copyToCacheDirectory: true
    });

    if (!result.canceled) {
      setSelectedAttachment(result.assets[0]);
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
      
      // CORRIGIDO: Remover attachment_name que não existe na tabela
      const noticeData = {
        title: title.trim(),
        content: content.trim(),
        type: noticeType,
        class_id: classId || null,
        author_id: user.id,
        image_url: selectedImage?.uri || null,
        attachment_url: selectedAttachment?.uri || null
      };

      console.log('🖼️ Criando aviso com dados:', {
        title: noticeData.title,
        hasImage: !!selectedImage,
        hasAttachment: !!selectedAttachment,
        type: noticeData.type
      });

      const { data, error } = await supabase
        .from('notices')
        .insert([noticeData])
        .select();

      if (error) throw error;

      console.log('✅ Aviso criado com sucesso:', data);
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

  const resetForm = () => {
    setTitle('');
    setContent('');
    setNoticeType('general');
    setSelectedImage(null);
    setSelectedAttachment(null);
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
              onError={(error) => {
                console.log('❌ Erro ao carregar imagem:', item.image_url, error.nativeEvent.error);
              }}
              onLoad={() => {
                console.log('✅ Imagem carregada com sucesso:', item.image_url.substring(0, 50) + '...');
              }}
            />
          </View>
        )}
        
        {item.image_url && item.image_url.includes('example.com') && (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image" size={24} color={theme.colors.text.secondary} />
            <Text style={[styles.imagePlaceholderText, { color: theme.colors.text.secondary }]}>
              Imagem anexada (URL inválida)
            </Text>
          </View>
        )}
        
        <View style={styles.noticeFooter}>
          <Text style={[styles.typeLabel, { color: typeInfo.color }]}>
            {typeInfo.label}
          </Text>
          {item.attachment_url && (
            <Ionicons name="attach" size={16} color={theme.colors.text.secondary} />
          )}
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
            dismissKeyboard(); // Dispensar teclado ao selecionar tipo
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

      {/* Modal para criar aviso - CORRIGIDO com TouchableWithoutFeedback */}
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
                            onError={(error) => {
                              console.log('❌ Erro ao carregar imagem no modal:', selectedNotice.image_url, error.nativeEvent.error);
                            }}
                          />
                        </View>
                      )}
                      
                      {selectedNotice.image_url && selectedNotice.image_url.includes('example.com') && (
                        <View style={[styles.imagePlaceholder, { marginVertical: theme.spacing.md }]}>
                          <Ionicons name="image" size={32} color={theme.colors.text.secondary} />
                          <Text style={[styles.imagePlaceholderText, { color: theme.colors.text.secondary }]}>
                            Imagem anexada (URL inválida)
                          </Text>
                        </View>
                      )}
                      
                      {selectedNotice.attachment_url && (
                        <TouchableOpacity 
                          style={[styles.attachmentLink, { backgroundColor: theme.colors.primary + '10' }]}
                          onPress={() => {
                            Alert.alert(
                              'Anexo', 
                              'Arquivo anexado ao aviso',
                              [
                                { text: 'OK', style: 'default' }
                              ]
                            );
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
    padding: theme.spacing.lg,
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: theme.spacing.lg,
  },
  headerTitle: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: theme.typography.h2.fontWeight,
  },
  headerSubtitle: {
    fontSize: theme.typography.caption.fontSize,
    opacity: 0.9,
    marginTop: 2,
  },
  listContainer: {
    padding: theme.spacing.md,
  },
  noticeCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  noticeInfo: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  noticeAuthor: {
    fontSize: theme.typography.small.fontSize,
  },
  noticeClass: {
    fontSize: theme.typography.small.fontSize,
    marginTop: 2,
  },
  noticeContent: {
    fontSize: theme.typography.caption.fontSize,
    lineHeight: 20,
    marginBottom: theme.spacing.sm,
  },
  imagePlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  imagePlaceholderText: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.typography.caption.fontSize,
  },
  noticeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeLabel: {
    fontSize: theme.typography.small.fontSize,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.backdrop,
  },
  modalContent: {
    width: '90%',
    maxHeight: '85%',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  modalTitle: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: theme.typography.h2.fontWeight,
  },
  modalSubtitle: {
    fontSize: theme.typography.caption.fontSize,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    fontSize: theme.typography.body.fontSize,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  sectionLabel: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
    marginBottom: theme.spacing.sm,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.lg,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    margin: 4,
  },
  typeOptionText: {
    marginLeft: 5,
    fontSize: theme.typography.small.fontSize,
    fontWeight: '500',
  },
  attachmentSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.md,
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  attachButtonText: {
    marginLeft: 5,
    fontWeight: '500',
    fontSize: theme.typography.caption.fontSize,
  },
  // NOVOS: Estilos para imagens
  imageContainer: {
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  attachedImage: {
    width: '100%',
    height: 200,
    backgroundColor: theme.colors.background,
  },
  fullImage: {
    width: '100%',
    height: 250,
    backgroundColor: theme.colors.background,
  },
  previewImage: {
    width: 60,
    height: 40,
    borderRadius: 8,
    marginRight: theme.spacing.sm,
  },
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.sm,
  },
  selectedFileInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedFileText: {
    flex: 1,
    marginLeft: 5,
    fontSize: theme.typography.small.fontSize,
  },
  removeFileButton: {
    marginLeft: theme.spacing.sm,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.lg,
  },
  button: {
    flex: 1,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {},
  saveButton: {},
  buttonText: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyStateText: {
    fontSize: theme.typography.body.fontSize,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: theme.typography.caption.fontSize,
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
    marginBottom: theme.spacing.md,
  },
  noticeDetailTitleContainer: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  noticeDetailTitle: {
    fontSize: theme.typography.h3.fontSize,
    fontWeight: theme.typography.h3.fontWeight,
  },
  schoolBadge: {
    fontSize: theme.typography.small.fontSize,
    fontWeight: '500',
    marginTop: 2,
  },
  noticeDetailMeta: {
    fontSize: theme.typography.small.fontSize,
    marginBottom: 5,
  },
  noticeDetailClass: {
    fontSize: theme.typography.caption.fontSize,
    marginBottom: theme.spacing.md,
  },
  noticeDetailContent: {
    fontSize: theme.typography.body.fontSize,
    lineHeight: 24,
    marginBottom: theme.spacing.md,
  },
  attachmentLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  attachmentLinkText: {
    marginLeft: theme.spacing.sm,
    fontWeight: '500',
  },
  closeButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  closeButtonText: {
    fontWeight: 'bold',
    fontSize: theme.typography.body.fontSize,
  },
});