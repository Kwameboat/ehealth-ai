import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ClinicalAnalysisView from '../Components/ClinicalAnalysisView';
import { useTheme } from '../Context/ThemeContext';
import { analyzeLabFromImage, analyzeLabFromPdf } from '../services/labAnalysis';
import { pickPdfDocument } from '../services/pickPdf';

const LabResultsScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const styles = createStyles(theme);

  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    ImagePicker.requestCameraPermissionsAsync();
    ImagePicker.requestMediaLibraryPermissionsAsync();
  }, []);

  const runAnalysis = async (imageUri, pdfAsset) => {
    setIsAnalyzing(true);
    setAnalysisResult('');
    try {
      if (pdfAsset?.uri) {
        const base64 = await FileSystem.readAsStringAsync(pdfAsset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const text = await analyzeLabFromPdf({ base64 });
        setAnalysisResult(text);
      } else if (imageUri) {
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const text = await analyzeLabFromImage({
          base64,
          mimeType: 'image/jpeg',
        });
        setAnalysisResult(text);
      }
    } catch (e) {
      console.error('Lab analysis error:', e);
      Alert.alert('Analysis Error', e.message || 'Failed to analyze your lab report. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setSelectedPdf(null);
      setSelectedImage(result.assets[0].uri);
      setAnalysisResult('');
      runAnalysis(result.assets[0].uri, null);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to photograph your lab report.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setSelectedPdf(null);
      setSelectedImage(result.assets[0].uri);
      setAnalysisResult('');
      runAnalysis(result.assets[0].uri, null);
    }
  };

  const pickPdf = async () => {
    const result = await pickPdfDocument();
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setSelectedImage(null);
    setSelectedPdf(asset);
    setAnalysisResult('');
    runAnalysis(null, asset);
  };

  const clearSelection = () => {
    setSelectedImage(null);
    setSelectedPdf(null);
    setAnalysisResult('');
  };

  const hasSelection = selectedImage || selectedPdf;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lab Results</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {!hasSelection ? (
          <View style={styles.uploadSection}>
            <View style={styles.illustrationContainer}>
              <MaterialCommunityIcons name="microscope" size={80} color={theme.colors.primary} />
              <Text style={styles.illustrationText}>Understand Your Lab Report</Text>
              <Text style={styles.illustrationSubtext}>
                Upload a photo or PDF of your lab results for a clear explanation
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
                <Text style={[styles.uploadButtonText, { color: theme.colors.text }]}>Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.uploadButton, { backgroundColor: theme.colors.card }]}
                onPress={pickPdf}
              >
                <FontAwesome5 name="file-pdf" size={28} color={theme.colors.primary} />
                <Text style={[styles.uploadButtonText, { color: theme.colors.text }]}>PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.analysisSection}>
            {selectedImage ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
                <TouchableOpacity style={styles.clearButton} onPress={clearSelection}>
                  <Ionicons name="close-circle" size={32} color={theme.colors.danger} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.pdfChip, { backgroundColor: theme.colors.card }]}>
                <FontAwesome5 name="file-pdf" size={24} color={theme.colors.primary} />
                <Text style={[styles.pdfName, { color: theme.colors.text }]} numberOfLines={2}>
                  {selectedPdf?.name || 'Lab report.pdf'}
                </Text>
                <TouchableOpacity onPress={clearSelection}>
                  <Ionicons name="close-circle" size={28} color={theme.colors.danger} />
                </TouchableOpacity>
              </View>
            )}

            {isAnalyzing ? (
              <View style={styles.analyzingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={[styles.analyzingText, { color: theme.colors.text }]}>
                  Analyzing your lab report…
                </Text>
              </View>
            ) : analysisResult ? (
              <View style={[styles.resultsContainer, { backgroundColor: theme.colors.card }]}>
                <Text style={[styles.resultsTitle, { color: theme.colors.text }]}>Analysis Results</Text>
                <ClinicalAnalysisView
                  text={analysisResult}
                  sectionTitleStyle={styles.sectionTitle}
                  bodyStyle={styles.resultText}
                  sectionStyle={styles.sectionBlock}
                />
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
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
    backButton: { width: 40 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
    scrollContainer: { padding: 20, paddingBottom: 40 },
    uploadSection: { alignItems: 'center' },
    illustrationContainer: { alignItems: 'center', marginBottom: 32, marginTop: 20 },
    illustrationText: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.text,
      marginTop: 16,
      textAlign: 'center',
    },
    illustrationSubtext: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
      paddingHorizontal: 20,
    },
    uploadButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 12,
      width: '100%',
    },
    uploadButton: {
      width: '30%',
      minWidth: 100,
      aspectRatio: 1,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 8,
    },
    uploadButtonText: { marginTop: 8, fontSize: 13, fontWeight: '600', textAlign: 'center' },
    analysisSection: { width: '100%' },
    imagePreviewContainer: { position: 'relative', marginBottom: 20 },
    imagePreview: {
      width: '100%',
      height: 220,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    clearButton: { position: 'absolute', top: 8, right: 8 },
    pdfChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: 12,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    pdfName: { flex: 1, fontSize: 15 },
    analyzingContainer: { alignItems: 'center', padding: 24 },
    analyzingText: { marginTop: 12, fontSize: 16 },
    resultsContainer: {
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    resultsTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
    sectionBlock: { marginBottom: 14 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.primary, marginBottom: 6 },
    resultText: { fontSize: 15, lineHeight: 22, color: theme.colors.text },
  });

export default LabResultsScreen;
