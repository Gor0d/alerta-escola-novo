// src/screens/CanteenManagementScreen.js
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
  ActivityIndicator,
  RefreshControl,
  Clipboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { theme } from '../styles/theme';

export default function CanteenManagementScreen({ route, navigation }) {
  const { userRole, studentId, classId } = route.params || {};
  const [activeTab, setActiveTab] = useState('items'); // 'items', 'consumption', 'bills'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Estados para itens da cantina
  const [canteenItems, setCanteenItems] = useState([]);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('snack');
  const [newItemDescription, setNewItemDescription] = useState('');
  
  // Estados para consumo
  const [consumptions, setConsumptions] = useState([]);
  const [consumptionModalVisible, setConsumptionModalVisible] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState('monthly');
  
  // Estados para faturas
  const [bills, setBills] = useState([]);
  const [students, setStudents] = useState([]);
  
  // Estados para configurações PIX
  const [pixKey, setPixKey] = useState('universodosaber@pix.com.br');

  const categories = [
    { key: 'snack', label: 'Lanche', icon: 'fast-food', color: theme.colors.warning },
    { key: 'drink', label: 'Bebida', icon: 'water', color: theme.colors.info },
    { key: 'meal', label: 'Refeição', icon: 'restaurant', color: theme.colors.success },
    { key: 'sweet', label: 'Doce', icon: 'ice-cream', color: theme.colors.error },
    { key: 'other', label: 'Outros', icon: 'ellipsis-horizontal', color: theme.colors.text.secondary }
  ];

  useEffect(() => {
    fetchInitialData();
  }, [activeTab]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      await Promise.all([
        fetchCanteenItems(),
        fetchStudents(),
        fetchPixKey(),
        activeTab === 'consumption' && fetchConsumptions(),
        activeTab === 'bills' && fetchBills()
      ].filter(Boolean));
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCanteenItems = async () => {
    try {
      const { data, error } = await supabase
        .from('canteen_items')
        .select('*')
        .eq('is_available', true)
        .order('category', { ascending: true });
      
      if (error) throw error;
      setCanteenItems(data || []);
    } catch (error) {
      console.error('Erro ao buscar itens:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      let query = supabase
        .from('students')
        .select(`
          *,
          enrollments!inner(class_id),
          classes!enrollments(name)
        `);

      if (userRole === 'teacher' && classId) {
        query = query.eq('enrollments.class_id', classId);
      } else if (userRole === 'parent') {
        const { data: { user } } = await supabase.auth.getUser();
        query = query.eq('parent_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Erro ao buscar alunos:', error);
    }
  };

  const fetchConsumptions = async () => {
    try {
      let query = supabase
        .from('canteen_consumption')
        .select(`
          *,
          student:students(name, id),
          item:canteen_items(name, category),
          added_by:profiles(name)
        `)
        .order('consumed_at', { ascending: false });

      if (userRole === 'parent') {
        const { data: { user } } = await supabase.auth.getUser();
        const studentIds = students.filter(s => s.parent_id === user.id).map(s => s.id);
        if (studentIds.length > 0) {
          query = query.in('student_id', studentIds);
        }
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      setConsumptions(data || []);
    } catch (error) {
      console.error('Erro ao buscar consumos:', error);
    }
  };

  const fetchBills = async () => {
    try {
      let query = supabase
        .from('canteen_bills')
        .select(`
          *,
          student:students(name, id)
        `)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (userRole === 'parent') {
        const { data: { user } } = await supabase.auth.getUser();
        const studentIds = students.filter(s => s.parent_id === user.id).map(s => s.id);
        if (studentIds.length > 0) {
          query = query.in('student_id', studentIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setBills(data || []);
    } catch (error) {
      console.error('Erro ao buscar faturas:', error);
    }
  };

  const fetchPixKey = async () => {
    try {
      const { data, error } = await supabase
        .from('school_settings')
        .select('setting_value')
        .eq('setting_key', 'pix_key')
        .single();
      
      if (error) throw error;
      if (data) setPixKey(data.setting_value);
    } catch (error) {
      console.error('Erro ao buscar chave PIX:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInitialData();
  };

  const handleAddItem = async () => {
    if (!newItemName.trim() || !newItemPrice.trim()) {
      Alert.alert('Erro', 'Nome e preço são obrigatórios');
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('canteen_items')
        .insert([{
          name: newItemName.trim(),
          description: newItemDescription.trim(),
          price: parseFloat(newItemPrice.replace(',', '.')),
          category: newItemCategory
        }]);

      if (error) throw error;

      Alert.alert('Sucesso', 'Item adicionado com sucesso!');
      resetItemForm();
      setItemModalVisible(false);
      fetchCanteenItems();
    } catch (error) {
      console.error('Erro ao adicionar item:', error);
      Alert.alert('Erro', 'Não foi possível adicionar o item');
    } finally {
      setLoading(false);
    }
  };

  const handleAddConsumption = async () => {
    if (selectedStudents.length === 0 || !selectedItem || !quantity) {
      Alert.alert('Erro', 'Selecione pelo menos um aluno, um item e a quantidade');
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      const consumptionData = selectedStudents.map(studentId => ({
        student_id: studentId,
        item_id: selectedItem.id,
        quantity: parseInt(quantity),
        unit_price: selectedItem.price,
        total_price: selectedItem.price * parseInt(quantity),
        payment_method: paymentMethod,
        added_by: user.id
      }));

      const { error } = await supabase
        .from('canteen_consumption')
        .insert(consumptionData);

      if (error) throw error;

      // Atualizar ou criar faturas mensais para pagamento mensal
      if (paymentMethod === 'monthly') {
        await updateMonthlyBills(selectedStudents, selectedItem.price * parseInt(quantity));
      }

      Alert.alert('Sucesso', 'Consumo registrado com sucesso!');
      resetConsumptionForm();
      setConsumptionModalVisible(false);
      fetchConsumptions();
    } catch (error) {
      console.error('Erro ao registrar consumo:', error);
      Alert.alert('Erro', 'Não foi possível registrar o consumo');
    } finally {
      setLoading(false);
    }
  };

  const updateMonthlyBills = async (studentIds, amount) => {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      for (const studentId of studentIds) {
        // Verificar se já existe uma fatura para este mês
        const { data: existingBill } = await supabase
          .from('canteen_bills')
          .select('*')
          .eq('student_id', studentId)
          .eq('month', month)
          .eq('year', year)
          .single();

        if (existingBill) {
          // Atualizar fatura existente
          await supabase
            .from('canteen_bills')
            .update({
              total_amount: existingBill.total_amount + amount
            })
            .eq('id', existingBill.id);
        } else {
          // Criar nova fatura
          await supabase
            .from('canteen_bills')
            .insert([{
              student_id: studentId,
              month: month,
              year: year,
              total_amount: amount,
              due_date: new Date(year, month, 5).toISOString().split('T')[0],
              pix_key: pixKey
            }]);
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar faturas:', error);
    }
  };

  const resetItemForm = () => {
    setNewItemName('');
    setNewItemPrice('');
    setNewItemCategory('snack');
    setNewItemDescription('');
  };

  const resetConsumptionForm = () => {
    setSelectedStudents([]);
    setSelectedItem(null);
    setQuantity('1');
    setPaymentMethod('monthly');
  };

  const copyPixKey = () => {
    Clipboard.setString(pixKey);
    Alert.alert(
      'PIX Copiado!', 
      `Chave PIX do ${theme.school.shortName} copiada para a área de transferência`
    );
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return theme.colors.success;
      case 'pending': return theme.colors.warning;
      case 'overdue': return theme.colors.error;
      default: return theme.colors.text.secondary;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'paid': return 'Pago';
      case 'pending': return 'Pendente';
      case 'overdue': return 'Vencido';
      default: return status;
    }
  };

  const getCategoryInfo = (category) => {
    return categories.find(c => c.key === category) || categories[4];
  };

  const renderTabBar = () => (
    <View style={[styles.tabBar, { backgroundColor: theme.colors.card }]}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'items' && [styles.activeTab, { borderBottomColor: theme.colors.primary }]]}
        onPress={() => setActiveTab('items')}
      >
        <Ionicons 
          name="restaurant" 
          size={20} 
          color={activeTab === 'items' ? theme.colors.primary : theme.colors.text.secondary} 
        />
        <Text style={[
          styles.tabText, 
          activeTab === 'items' && [styles.activeTabText, { color: theme.colors.primary }]
        ]}>
          Itens
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.tab, activeTab === 'consumption' && [styles.activeTab, { borderBottomColor: theme.colors.primary }]]}
        onPress={() => setActiveTab('consumption')}
      >
        <Ionicons 
          name="receipt" 
          size={20} 
          color={activeTab === 'consumption' ? theme.colors.primary : theme.colors.text.secondary} 
        />
        <Text style={[
          styles.tabText, 
          activeTab === 'consumption' && [styles.activeTabText, { color: theme.colors.primary }]
        ]}>
          Consumo
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.tab, activeTab === 'bills' && [styles.activeTab, { borderBottomColor: theme.colors.primary }]]}
        onPress={() => setActiveTab('bills')}
      >
        <Ionicons 
          name="card" 
          size={20} 
          color={activeTab === 'bills' ? theme.colors.primary : theme.colors.text.secondary} 
        />
        <Text style={[
          styles.tabText, 
          activeTab === 'bills' && [styles.activeTabText, { color: theme.colors.primary }]
        ]}>
          Faturas
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderItemCard = ({ item }) => {
    const categoryInfo = getCategoryInfo(item.category);
    
    return (
      <View style={[styles.itemCard, theme.shadows.medium, { backgroundColor: theme.colors.card }]}>
        <View style={styles.itemHeader}>
          <View style={[styles.itemIcon, { backgroundColor: categoryInfo.color + '20' }]}>
            <Ionicons name={categoryInfo.icon} size={24} color={categoryInfo.color} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={[styles.itemName, { color: theme.colors.text.primary }]}>{item.name}</Text>
            <Text style={[styles.itemDescription, { color: theme.colors.text.secondary }]}>
              {item.description || 'Sem descrição'}
            </Text>
            <Text style={[styles.itemCategory, { color: categoryInfo.color }]}>
              {categoryInfo.label}
            </Text>
          </View>
          <Text style={[styles.itemPrice, { color: theme.colors.success }]}>
            {formatCurrency(item.price)}
          </Text>
        </View>
      </View>
    );
  };

  const renderConsumptionCard = ({ item }) => (
    <View style={[styles.consumptionCard, theme.shadows.small, { backgroundColor: theme.colors.card }]}>
      <View style={styles.consumptionHeader}>
        <View style={styles.consumptionInfo}>
          <Text style={[styles.consumptionStudent, { color: theme.colors.text.primary }]}>
            {item.student?.name}
          </Text>
          <Text style={[styles.consumptionItem, { color: theme.colors.primary }]}>
            {item.item?.name}
          </Text>
          <Text style={[styles.consumptionDate, { color: theme.colors.text.secondary }]}>
            {formatDate(item.consumed_at)}
          </Text>
        </View>
        <View style={styles.consumptionAmount}>
          <Text style={[styles.consumptionQuantity, { color: theme.colors.text.secondary }]}>
            Qtd: {item.quantity}
          </Text>
          <Text style={[styles.consumptionTotal, { color: theme.colors.success }]}>
            {formatCurrency(item.total_price)}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.payment_status) }]}>
            <Text style={[styles.statusText, { color: theme.colors.text.inverse }]}>
              {getStatusLabel(item.payment_status)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderBillCard = ({ item }) => (
    <View style={[styles.billCard, theme.shadows.medium, { backgroundColor: theme.colors.card }]}>
      <View style={styles.billHeader}>
        <View style={styles.billInfo}>
          <Text style={[styles.billStudent, { color: theme.colors.text.primary }]}>
            {item.student?.name}
          </Text>
          <Text style={[styles.billPeriod, { color: theme.colors.primary }]}>
            {String(item.month).padStart(2, '0')}/{item.year}
          </Text>
          {item.due_date && (
            <Text style={[styles.billDueDate, { color: theme.colors.text.secondary }]}>
              Vencimento: {formatDate(item.due_date)}
            </Text>
          )}
        </View>
        <View style={styles.billAmount}>
          <Text style={[styles.billTotal, { color: theme.colors.success }]}>
            {formatCurrency(item.total_amount)}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={[styles.statusText, { color: theme.colors.text.inverse }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>
      </View>
      
      {item.status !== 'paid' && (
        <View style={styles.billActions}>
          <TouchableOpacity 
            style={[styles.pixButton, { backgroundColor: theme.colors.primary + '10' }]} 
            onPress={copyPixKey}
          >
            <Ionicons name="copy" size={16} color={theme.colors.primary} />
            <Text style={[styles.pixButtonText, { color: theme.colors.primary }]}>
              Copiar PIX
            </Text>
          </TouchableOpacity>
          <Text style={[styles.pixKey, { color: theme.colors.text.secondary }]}>
            {theme.school.shortName}: {pixKey}
          </Text>
        </View>
      )}
    </View>
  );

  const renderContent = () => {
    if (loading && (canteenItems.length === 0 || consumptions.length === 0 || bills.length === 0)) {
      return <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />;
    }

    const data = activeTab === 'items' ? canteenItems : 
                 activeTab === 'consumption' ? consumptions : bills;
    
    const renderItem = activeTab === 'items' ? renderItemCard :
                      activeTab === 'consumption' ? renderConsumptionCard : renderBillCard;

    const emptyIcon = activeTab === 'items' ? 'restaurant-outline' :
                     activeTab === 'consumption' ? 'receipt-outline' : 'card-outline';
    
    const emptyText = activeTab === 'items' ? 'Nenhum item cadastrado' :
                     activeTab === 'consumption' ? 'Nenhum consumo registrado' : 'Nenhuma fatura encontrada';

    return (
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
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
            <Ionicons name={emptyIcon} size={64} color={theme.colors.text.light} />
            <Text style={[styles.emptyStateText, { color: theme.colors.text.secondary }]}>
              {emptyText}
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.colors.text.light }]}>
              {theme.school.shortName}
            </Text>
          </View>
        }
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.inverse} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: theme.colors.text.inverse }]}>
            Cantina
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.text.inverse }]}>
            {theme.school.shortName}
          </Text>
        </View>
        {userRole === 'teacher' && (
          <TouchableOpacity
            onPress={() => {
              if (activeTab === 'items') {
                setItemModalVisible(true);
              } else if (activeTab === 'consumption') {
                setConsumptionModalVisible(true);
              }
            }}
          >
            <Ionicons name="add" size={24} color={theme.colors.text.inverse} />
          </TouchableOpacity>
        )}
      </View>

      {renderTabBar()}
      {renderContent()}

      {/* Modal para adicionar item */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={itemModalVisible}
        onRequestClose={() => setItemModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text.primary }]}>
                Novo Item da Cantina
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
              placeholder="Nome do item"
              placeholderTextColor={theme.colors.text.light}
              value={newItemName}
              onChangeText={setNewItemName}
            />
            
            <TextInput
              style={[styles.input, { 
                borderColor: theme.colors.border,
                color: theme.colors.text.primary 
              }]}
              placeholder="Descrição (opcional)"
              placeholderTextColor={theme.colors.text.light}
              value={newItemDescription}
              onChangeText={setNewItemDescription}
            />
            
            <TextInput
              style={[styles.input, { 
                borderColor: theme.colors.border,
                color: theme.colors.text.primary 
              }]}
              placeholder="Preço (ex: 2,50)"
              placeholderTextColor={theme.colors.text.light}
              value={newItemPrice}
              onChangeText={setNewItemPrice}
              keyboardType="decimal-pad"
            />

            <Text style={[styles.sectionLabel, { color: theme.colors.text.primary }]}>
              Categoria:
            </Text>
            <View style={styles.categorySelector}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.key}
                  style={[
                    styles.categoryOption,
                    { borderColor: category.color },
                    newItemCategory === category.key && { backgroundColor: category.color }
                  ]}
                  onPress={() => setNewItemCategory(category.key)}
                >
                  <Ionicons 
                    name={category.icon} 
                    size={20} 
                    color={newItemCategory === category.key ? theme.colors.text.inverse : category.color} 
                  />
                  <Text style={[
                    styles.categoryText,
                    { color: newItemCategory === category.key ? theme.colors.text.inverse : category.color }
                  ]}>
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, { backgroundColor: theme.colors.border }]}
                onPress={() => {
                  setItemModalVisible(false);
                  resetItemForm();
                }}
              >
                <Text style={[styles.buttonText, { color: theme.colors.text.secondary }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.saveButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleAddItem}
                disabled={loading}
              >
                <Text style={[styles.buttonText, { color: theme.colors.text.inverse }]}>
                  {loading ? 'Salvando...' : 'Salvar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para registrar consumo */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={consumptionModalVisible}
        onRequestClose={() => setConsumptionModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text.primary }]}>
                Registrar Consumo
              </Text>
              <Text style={[styles.modalSubtitle, { color: theme.colors.text.secondary }]}>
                {theme.school.shortName}
              </Text>
            </View>
            
            <Text style={[styles.sectionLabel, { color: theme.colors.text.primary }]}>
              Selecionar Alunos:
            </Text>
            <FlatList
              data={students}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.studentOption,
                    { borderColor: theme.colors.border },
                    selectedStudents.includes(item.id) && { 
                      backgroundColor: theme.colors.primary,
                      borderColor: theme.colors.primary 
                    }
                  ]}
                  onPress={() => {
                    if (selectedStudents.includes(item.id)) {
                      setSelectedStudents(selectedStudents.filter(id => id !== item.id));
                    } else {
                      setSelectedStudents([...selectedStudents, item.id]);
                    }
                  }}
                >
                  <Text style={[
                    styles.studentName,
                    { color: selectedStudents.includes(item.id) ? theme.colors.text.inverse : theme.colors.text.primary }
                  ]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
              style={styles.studentList}
              maxHeight={150}
            />

            <Text style={[styles.sectionLabel, { color: theme.colors.text.primary }]}>
              Selecionar Item:
            </Text>
            <FlatList
              data={canteenItems}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.itemOption,
                    { borderColor: theme.colors.border },
                    selectedItem?.id === item.id && { 
                      backgroundColor: theme.colors.primary,
                      borderColor: theme.colors.primary 
                    }
                  ]}
                  onPress={() => setSelectedItem(item)}
                >
                  <View style={styles.itemOptionContent}>
                    <Text style={[
                      styles.itemOptionName,
                      { color: selectedItem?.id === item.id ? theme.colors.text.inverse : theme.colors.text.primary }
                    ]}>
                      {item.name}
                    </Text>
                    <Text style={[
                      styles.itemOptionPrice,
                      { color: selectedItem?.id === item.id ? theme.colors.text.inverse : theme.colors.success }
                    ]}>
                      {formatCurrency(item.price)}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              style={styles.itemList}
              maxHeight={150}
            />

            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={[styles.inputLabel, { color: theme.colors.text.primary }]}>
                  Quantidade:
                </Text>
                <TextInput
                  style={[styles.input, { 
                    borderColor: theme.colors.border,
                    color: theme.colors.text.primary 
                  }]}
                  placeholder="1"
                  placeholderTextColor={theme.colors.text.light}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                />
              </View>
              
              <View style={styles.inputHalf}>
                <Text style={[styles.inputLabel, { color: theme.colors.text.primary }]}>
                  Pagamento:
                </Text>
                <View style={styles.paymentSelector}>
                  <TouchableOpacity
                    style={[
                      styles.paymentOption,
                      { borderColor: theme.colors.border },
                      paymentMethod === 'monthly' && { 
                        backgroundColor: theme.colors.primary,
                        borderColor: theme.colors.primary 
                      }
                    ]}
                    onPress={() => setPaymentMethod('monthly')}
                  >
                    <Text style={[
                      styles.paymentText,
                      { color: paymentMethod === 'monthly' ? theme.colors.text.inverse : theme.colors.text.primary }
                    ]}>
                      Mensal
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.paymentOption,
                      { borderColor: theme.colors.border },
                      paymentMethod === 'daily' && { 
                        backgroundColor: theme.colors.primary,
                        borderColor: theme.colors.primary 
                      }
                    ]}
                    onPress={() => setPaymentMethod('daily')}
                  >
                    <Text style={[
                      styles.paymentText,
                      { color: paymentMethod === 'daily' ? theme.colors.text.inverse : theme.colors.text.primary }
                    ]}>
                      Diário
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {selectedItem && (
              <View style={[styles.totalSection, { backgroundColor: theme.colors.success + '10' }]}>
                <Text style={[styles.totalLabel, { color: theme.colors.text.primary }]}>
                  Total:
                </Text>
                <Text style={[styles.totalAmount, { color: theme.colors.success }]}>
                  {formatCurrency(selectedItem.price * parseInt(quantity || '1'))}
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, { backgroundColor: theme.colors.border }]}
                onPress={() => {
                  setConsumptionModalVisible(false);
                  resetConsumptionForm();
                }}
              >
                <Text style={[styles.buttonText, { color: theme.colors.text.secondary }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.saveButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleAddConsumption}
                disabled={loading}
              >
                <Text style={[styles.buttonText, { color: theme.colors.text.inverse }]}>
                  {loading ? 'Registrando...' : 'Registrar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  tabBar: {
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {},
  tabText: {
    marginLeft: 5,
    fontSize: theme.typography.caption.fontSize,
  },
  activeTabText: {
    fontWeight: 'bold',
  },
  listContainer: {
    padding: theme.spacing.md,
  },
  itemCard: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
  },
  itemDescription: {
    fontSize: theme.typography.small.fontSize,
    marginTop: 2,
  },
  itemCategory: {
    fontSize: theme.typography.small.fontSize,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: theme.typography.h3.fontSize,
    fontWeight: 'bold',
  },
  consumptionCard: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  consumptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  consumptionInfo: {
    flex: 1,
  },
  consumptionStudent: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
  },
  consumptionItem: {
    fontSize: theme.typography.caption.fontSize,
    marginTop: 2,
  },
  consumptionDate: {
    fontSize: theme.typography.small.fontSize,
    marginTop: 2,
  },
  consumptionAmount: {
    alignItems: 'flex-end',
  },
  consumptionQuantity: {
    fontSize: theme.typography.small.fontSize,
  },
  consumptionTotal: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
    marginTop: 2,
  },
  billCard: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  billInfo: {
    flex: 1,
  },
  billStudent: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
  },
  billPeriod: {
    fontSize: theme.typography.caption.fontSize,
    marginTop: 2,
  },
  billDueDate: {
    fontSize: theme.typography.small.fontSize,
    marginTop: 2,
  },
  billAmount: {
    alignItems: 'flex-end',
  },
  billTotal: {
    fontSize: theme.typography.h3.fontSize,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  billActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  pixButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  pixButtonText: {
    marginLeft: 5,
    fontWeight: '500',
    fontSize: theme.typography.small.fontSize,
  },
  pixKey: {
    fontSize: theme.typography.small.fontSize,
    flex: 1,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.lg,
    marginTop: 5,
  },
  statusText: {
    fontSize: 10,
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
  },
  emptyStateSubtext: {
    fontSize: theme.typography.caption.fontSize,
    marginTop: 5,
  },
  loader: {
    marginTop: 50,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.backdrop,
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
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
  sectionLabel: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
    marginBottom: theme.spacing.sm,
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.lg,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    margin: 4,
  },
  categoryText: {
    marginLeft: 5,
    fontSize: theme.typography.small.fontSize,
  },
  studentList: {
    maxHeight: 150,
    marginBottom: theme.spacing.md,
  },
  studentOption: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: 5,
  },
  studentName: {
    fontSize: theme.typography.caption.fontSize,
  },
  itemList: {
    maxHeight: 150,
    marginBottom: theme.spacing.md,
  },
  itemOption: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: 5,
  },
  itemOptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemOptionName: {
    fontSize: theme.typography.caption.fontSize,
  },
  itemOptionPrice: {
    fontSize: theme.typography.caption.fontSize,
    fontWeight: 'bold',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  inputHalf: {
    flex: 1,
    marginHorizontal: 5,
  },
  inputLabel: {
    fontSize: theme.typography.caption.fontSize,
    fontWeight: '500',
    marginBottom: 5,
  },
  paymentSelector: {
    flexDirection: 'row',
  },
  paymentOption: {
    flex: 1,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  paymentText: {
    fontSize: theme.typography.small.fontSize,
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  totalLabel: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
  },
  totalAmount: {
    fontSize: theme.typography.h3.fontSize,
    fontWeight: 'bold',
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
});