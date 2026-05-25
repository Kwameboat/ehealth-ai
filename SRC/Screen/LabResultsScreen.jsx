import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ScreenHeaderBar from '../Components/ScreenHeaderBar';
import ClinicalAnalysisView from '../Components/ClinicalAnalysisView';
import MultiImagePreview from '../Components/MultiImagePreview';
import { useTheme } from '../Context/ThemeContext';
import {
  pickClinicalGalleryImages,
  pickClinicalPdfDocuments,
  takeClinicalPhoto,
} from '../services/clinicalMediaPicker';
import { analyzeLabFromAssets } from '../services/labAnalysis';

const LabResultsScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const styles = createStyles(theme);

  const [imageUris, setImageUris] = useState([]);
  const [pdfAssets, setPdfAssets] = useState([]);
  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    import('expo-image-picker').then((ImagePicker) => {
      ImagePicker.requestCameraPermissionsAsync();
      ImagePicker.requestMediaLibraryPermissionsAsync();
    });
  }, []);

  const runAnalysis = async (assets) => {
    if (!assets?.length) return;
    setIsAnalyzing(true);
    setAnalysisResult('');
    try {
      const text = await analyzeLabFromAssets({ assets });
      setAnalysisResult(text);
    } catch (e) {
      console.error('Lab analysis error:', e);
      Alert.alert(
        'Analysis Error',
        e.message || 'Failed to analyze your lab report. Please try again.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyAssets = (assets) => {
    const images = assets.filter((a) => a.kind === 'image');
    const pdfs = assets.filter((a) => a.kind === 'pdf');
    setImageUris(images.map((a) => a.uri));
    setPdfAssets(pdfs);
    runAnalysis(assets);
  };

  const pickImage = async () => {
    const assets = await pickClinicalGalleryImages();
    if (assets.length) applyAssets(assets);
  };

  const takePhoto = async () => {
    const asset = await takeClinicalPhoto();
    if (!asset) {
      Alert.alert('Permission required', 'Camera access is needed to photograph your lab report.');
      return;
    }
    applyAssets([asset]);
  };

  const pickPdf = async () => {
    const assets = await pickClinicalPdfDocuments();
    if (assets.length) applyAssets(assets);
  };

  const clearSelection = () => {
    setImageUris([]);
    setPdfAssets([]);
    setAnalysisResult('');
  };

  const hasSelection = imageUris.length > 0 || pdfAssets.length > 0;

  return (
    <View style={styles.container}>
      <ScreenHeaderBar title="Lab Results" />

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {!hasSelection ? (
          <View style={styles.uploadSection}>
            <View style={styles.illustrationContainer}>
              <MaterialCommunityIcons name="microscope" size={80} color={theme.colors.primary} />
              <Text style={styles.illustrationText}>Understand Your Lab Report</Text>
              <Text style={styles.illustrationSubtext}>
                Upload one or more photos or PDFs of your lab results for a clear explanation
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
                <Ionicons name="images" size={32} color={theme.colors.primary} />
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
            {imageUris.length > 0 ? (
              <MultiImagePreview uris={imageUris} onClear={clearSelection} imageHeight={220} />
            ) : null}

            {pdfAssets.map((pdf) => (
              <View
                key={pdf.uri || pdf.name}
                style={[styles.pdfChip, { backgroundColor: theme.colors.card }]}
              >
                <FontAwesome5 name="file-pdf" size={24} color={theme.colors.primary} />
                <Text style={[styles.pdfName, { color: theme.colors.text }]} numberOfLines={2}>
                  {pdf.name || 'Lab report.pdf'}
                </Text>
                {!imageUris.length && pdfAssets.length === 1 ? (
                  <TouchableOpacity onPress={clearSelection}>
                    <Ionicons name="close-circle" size={28} color={theme.colors.danger} />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}

            {pdfAssets.length > 1 ? (
              <TouchableOpacity onPress={clearSelection} style={styles.clearLink}>
                <Text style={{ color: theme.colors.danger }}>Clear all</Text>
              </TouchableOpacity>
            ) : null}

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
    pdfChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    pdfName: { flex: 1, fontSize: 15 },
    clearLink: { alignSelf: 'flex-end', marginBottom: 12 },
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
