import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { theme } from '../styles/theme';

export default function StudentQRCodeScreen({ route, navigation }) {
  const { student } = route.params;
  const [qrValue, setQrValue] = useState('');

  useEffect(() => {
    // Gerar valor único para o QR Code
    const qrData = {
      studentId: student.id,
      studentName: student.name,
      timestamp: new Date().toISOString()
    };
    setQrValue(JSON.stringify(qrData));
  }, [student]);

  const shareCode = async () => {
    try {
      await Share.share({
        message: `Código do aluno ${student.name}: ${student.id}`,
        title: 'Código de Vínculo'
      });
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QR Code do Aluno</Text>
        <TouchableOpacity onPress={shareCode}>
          <Ionicons name="share-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.qrContainer}>
          <Text style={styles.studentName}>{student.name}</Text>
          
          <View style={styles.qrCodeWrapper}>
            <QRCode
              value={qrValue}
              size={250}
              color={theme.colors.primary}
              backgroundColor="white"
            />
          </View>

          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>Código:</Text>
            <Text style={styles.codeText}>{student.id.slice(0, 8).toUpperCase()}</Text>
          </View>

          <Text style={styles.instructions}>
            Os pais podem escanear este QR Code ou digitar o código acima 
            para vincular o aluno em suas contas.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.shareButton}
          onPress={shareCode}
        >
          <Ionicons name="share" size={20} color="white" />
          <Text style={styles.shareButtonText}>Compartilhar Código</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  qrContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
    ...theme.shadows.medium,
  },
  studentName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 20,
  },
  qrCodeWrapper: {
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 20,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  codeLabel: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    marginRight: 10,
  },
  codeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
    letterSpacing: 2,
  },
  instructions: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  shareButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 15,
    borderRadius: 10,
  },
  shareButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});