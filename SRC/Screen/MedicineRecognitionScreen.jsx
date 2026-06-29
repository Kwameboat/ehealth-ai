import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { pickClinicalGalleryImages, takeClinicalPhoto } from '../services/clinicalMediaPicker';
import { attachmentToBase64, guessImageMimeType } from '../services/fileToBase64';
import { scanMedicine } from '../services/healthApi';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../Context/ThemeContext';

const MedicineRecognitionScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const styles = createStyles(theme);
  
  const [selectedImages, setSelectedImages] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const analyzeMedicineWithAI = async (imageUri) => {
    setIsAnalyzing(true);
    try {
      const base64 = await attachmentToBase64({
        uri: imageUri,
        mimeType: guessImageMimeType(imageUri),
      });
      const { result } = await scanMedicine(base64, guessImageMimeType(imageUri));
      setAnalysisResult(result);
      setHistory((prev) => [
        {
          id: Date.now(),
          name: result.name,
          image: imageUri,
          timestamp: new Date().toLocaleString(),
          result,
        },
        ...prev,
      ]);
    } catch (e) {
      Alert.alert('Scan failed', e.message || 'Could not analyze this image. Try a clearer photo.');
      setAnalysisResult(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runMockAnalysis = (uris) => {
    if (!uris.length) return;
    setSelectedImages(uris);
    setAnalysisResult(null);
    analyzeMedicineWithAI(uris[0]);
  };

  const pickImage = async () => {
    const assets = await pickClinicalGalleryImages();
    if (assets.length) runMockAnalysis(assets.map((a) => a.uri));
  };

  const takePhoto = async () => {
    const asset = await takeClinicalPhoto();
    if (!asset) {
      Alert.alert('Permission required', 'Camera access is needed to take photos of medications');
      return;
    }
    runMockAnalysis([asset.uri]);
  };

  const clearSelection = () => {
    setSelectedImages([]);
    setAnalysisResult(null);
  };

  const filteredHistory = history.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Medicine Recognition</Text>
        <TouchableOpacity onPress={() => setShowHistory(true)} style={styles.historyButton}>
          <Ionicons name="time-outline" size={28} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {!selectedImages.length ? (
          <View style={styles.uploadSection}>
            <View style={styles.illustrationContainer}>
              <FontAwesome5 name="pills" size={80} color={theme.colors.primary} />
              <Text style={styles.illustrationText}>Identify Your Medications</Text>
              <Text style={styles.illustrationSubtext}>
                Upload a clear image of your medicine pill, bottle, or packaging
              </Text>
            </View>

            <View style={styles.uploadButtons}>
              <TouchableOpacity 
                style={[styles.uploadButton, { backgroundColor: theme.colors.card }]} 
                onPress={takePhoto}
              >
                <Ionicons name="camera" size={32} color={theme.colors.primary} />
                <Text style={[styles.uploadButtonText, { color: theme.colors.text }]}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.uploadButton, { backgroundColor: theme.colors.card }]} 
                onPress={pickImage}
              >
                <Ionicons name="image" size={32} color={theme.colors.primary} />
                <Text style={[styles.uploadButtonText, { color: theme.colors.text }]}>From Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.analysisSection}>
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: selectedImages[0] }} style={styles.imagePreview} />
              <TouchableOpacity style={styles.clearButton} onPress={clearSelection}>
                <Ionicons name="close-circle" size={32} color={theme.colors.danger} />
              </TouchableOpacity>
            </View>

            {isAnalyzing ? (
              <View style={styles.analyzingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={[styles.analyzingText, { color: theme.colors.text }]}>Analyzing medication...</Text>
                <Text style={[styles.analyzingSubtext, { color: theme.colors.textSecondary }]}>
                  Agyenim AI is reading the label
                </Text>
              </View>
            ) : analysisResult ? (
              <View style={styles.resultsContainer}>
                <View style={styles.resultHeader}>
                  <Text style={[styles.medicineName, { color: theme.colors.text }]}>{analysisResult.name}</Text>
                  <View style={[styles.confidenceBadge, { backgroundColor: theme.colors.success + '20' }]}>
                    <Text style={[styles.confidenceText, { color: theme.colors.success }]}>
                      {analysisResult.confidence}% Match
                    </Text>
                  </View>
                </View>

                <Text style={[styles.medicineType, { color: theme.colors.primary }]}>{analysisResult.type}</Text>

                <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
                  <Text style={[styles.infoTitle, { color: theme.colors.text }]}>Uses</Text>
                  <Text style={[styles.infoText, { color: theme.colors.text }]}>{analysisResult.uses}</Text>
                </View>

                <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
                  <Text style={[styles.infoTitle, { color: theme.colors.text }]}>Dosage</Text>
                  <Text style={[styles.infoText, { color: theme.colors.text }]}>{analysisResult.dosage}</Text>
                </View>

                <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
                  <Text style={[styles.infoTitle, { color: theme.colors.text }]}>Side Effects</Text>
                  <Text style={[styles.infoText, { color: theme.colors.text }]}>{analysisResult.sideEffects}</Text>
                </View>

                <View style={[styles.warningCard, { 
                  backgroundColor: theme.colors.warning + '20',
                  borderLeftColor: theme.colors.warning 
                }]}>
                  <Text style={[styles.infoTitle, { color: theme.colors.text }]}>Warnings</Text>
                  <Text style={[styles.infoText, { color: theme.colors.text }]}>{analysisResult.warnings}</Text>
                </View>

                <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}>
                  <Ionicons name="bookmark-outline" size={20} color={theme.colors.buttonText || '#fff'} />
                  <Text style={[styles.saveButtonText, { color: theme.colors.buttonText || '#fff' }]}>
                    Save to Medicine Cabinet
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* History Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={showHistory}
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { 
            backgroundColor: theme.colors.card,
            borderBottomColor: theme.colors.border 
          }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Recognition History</Text>
            <TouchableOpacity onPress={() => setShowHistory(false)}>
              <Ionicons name="close" size={28} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchContainer, { 
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border
          }]}>
            <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Search history..."
              placeholderTextColor={theme.colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScrollView style={styles.historyList}>
            {filteredHistory.length > 0 ? (
              filteredHistory.map(item => (
                <TouchableOpacity 
                  key={item.id} 
                  style={[styles.historyItem, { 
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border
                  }]}
                  onPress={() => {
                    setSelectedImage(item.image);
                    setAnalysisResult(item.result);
                    setShowHistory(false);
                  }}
                >
                  <Image source={{ uri: item.image }} style={styles.historyImage} />
                  <View style={styles.historyDetails}>
                    <Text style={[styles.historyName, { color: theme.colors.text }]}>{item.name}</Text>
                    <Text style={[styles.historyTimestamp, { color: theme.colors.textSecondary }]}>{item.timestamp}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyHistory}>
                <Ionicons name="time-outline" size={60} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyHistoryText, { color: theme.colors.textSecondary }]}>
                  No recognition history yet
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 50,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  historyButton: {
    padding: 5,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  uploadSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  illustrationText: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 20,
    marginBottom: 10,
  },
  illustrationSubtext: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  uploadButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 15,
  },
  uploadButton: {
    flex: 1,
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  uploadButtonText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  analysisSection: {
    flex: 1,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  imagePreview: {
    width: '100%',
    height: 300,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  clearButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: theme.colors.card + 'CC',
    borderRadius: 16,
  },
  analyzingContainer: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: theme.colors.card,
    borderRadius: 15,
    marginVertical: 20,
  },
  analyzingText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 15,
  },
  analyzingSubtext: {
    fontSize: 14,
    marginTop: 5,
  },
  resultsContainer: {
    marginTop: 10,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  medicineName: {
    fontSize: 24,
    fontWeight: '700',
  },
  confidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  medicineType: {
    fontSize: 16,
    marginBottom: 20,
    fontWeight: '500',
  },
  infoCard: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  warningCard: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
  },
  saveButtonText: {
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 10,
  },
  modalContainer: {
    flex: 1,
    paddingTop: 50,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    marginBottom: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },
  historyList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  historyImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 15,
  },
  historyDetails: {
    flex: 1,
  },
  historyName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  historyTimestamp: {
    fontSize: 12,
  },
  emptyHistory: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyHistoryText: {
    fontSize: 16,
    marginTop: 15,
  },
});

export default MedicineRecognitionScreen;