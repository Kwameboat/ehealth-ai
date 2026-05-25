// EyeProblemsScreen.js
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent
} from 'expo-speech-recognition';
import { useEffect, useState } from 'react';
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
  View
} from 'react-native';
import { useTheme } from '../Context/ThemeContext';

import ScreenHeaderBar from '../Components/ScreenHeaderBar';
import ClinicalAnalysisView from '../Components/ClinicalAnalysisView';
import MultiImagePreview from '../Components/MultiImagePreview';
import { analyzeSymptomFromText } from '../services/symptomAnalysis';
import { uploadSymptomCameraPhoto, uploadSymptomGalleryImages } from '../services/symptomScreenUpload';

const EyeProblemsScreen = ({ navigation }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const [selectedImages, setSelectedImages] = useState([]);
  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userNotes, setUserNotes] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [showSpeechModal, setShowSpeechModal] = useState(false);
  const [symptomType, setSymptomType] = useState('');
  const [severity, setSeverity] = useState('');
  const [duration, setDuration] = useState('');

  // Speech Recognition Events
  useSpeechRecognitionEvent('start', () => setIsRecognizing(true));
  useSpeechRecognitionEvent('end', () => setIsRecognizing(false));
  useSpeechRecognitionEvent('result', (event) => {
    setTranscript(event.results[0]?.transcript || '');
  });
  useSpeechRecognitionEvent('error', (event) => {
    console.error('Speech recognition error:', event.error, event.message);
    Alert.alert('Voice Error', event.message || 'Failed to recognize speech');
    stopSpeechRecognition();
  });

  // Start Recognition
  const handleStartSpeechRecognition = async () => {
    try {
      const res = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!res.granted) {
        Alert.alert('Permission denied', 'Microphone access is required for voice input');
        return;
      }

      setTranscript('');
      setShowSpeechModal(true);

      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
      });
    } catch (error) {
      console.error('Start recognition error:', error);
      Alert.alert('Error', 'Could not start speech recognition');
    }
  };

  // Stop Recognition
  const stopSpeechRecognition = () => {
    try {
      ExpoSpeechRecognitionModule.stop();
      if (transcript) {
        setUserNotes(prev => prev ? `${prev} ${transcript}` : transcript);
      }
      setShowSpeechModal(false);
    } catch (error) {
      console.error('Stop recognition error:', error);
    }
  };

  // Submit Symptoms to Gemini
  const submitSymptoms = async () => {
    if (!userNotes.trim() && !symptomType && !severity) {
      Alert.alert('Input Required', 'Please describe your eye symptoms first');
      return;
    }
    
    const symptomsText = `Symptom Type: ${symptomType || 'Not provided'}\n
    Severity: ${severity || 'Not provided'}\n
    Duration: ${duration || 'Not provided'}\n
    User Description: ${userNotes}`;
    
    await analyzeTextWithGemini(symptomsText);
  };

  // Request Permissions on Mount
  useEffect(() => {
    (async () => {
      await ImagePicker.requestCameraPermissionsAsync();
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    })();

    return () => {
      Speech.stop();
      ExpoSpeechRecognitionModule.stop();
    };
  }, []);

  // Analyze Text with Gemini
  const analyzeTextWithGemini = async (text) => {
    setIsAnalyzing(true);
    setAnalysisResult('');
    try {
      const resultText = await analyzeSymptomFromText({
        condition: 'Eye Problems',
        userText: text,
      });
      setAnalysisResult(resultText);
    } catch (error) {
      console.error('Clinical analysis error:', error);
      Alert.alert('Analysis Error', 'Failed to analyze your symptoms. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Pick Image
  const pickImage = async () => {
    await uploadSymptomGalleryImages({
      condition: 'Eye Problems',
      setIsAnalyzing,
      setAnalysisResult,
      setSelectedImages,
    });
  };

  const takePhoto = async () => {
    await uploadSymptomCameraPhoto({
      condition: 'Eye Problems',
      setIsAnalyzing,
      setAnalysisResult,
      setSelectedImages,
    });
  };

  // Speak Result
  const speakAnalysis = () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }
    if (analysisResult) {
      setIsSpeaking(true);
      Speech.speak(analysisResult, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
      });
    }
  };

  // Format analysis result with sections
  const renderAnalysisResult = () => {
    if (!analysisResult) return null;
    return (
      <ClinicalAnalysisView
        text={analysisResult}
        sectionStyle={styles.sectionContainer}
        sectionTitleStyle={styles.sectionTitle}
        bodyStyle={styles.resultText}
      />
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeaderBar title="Eye Problems Analysis" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Eye-specific input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Eye Problem Details</Text>
          
          <View style={styles.row}>
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Symptom Type</Text>
              <TextInput
                style={[styles.smallInput, { 
                  backgroundColor: theme.colors.background, 
                  color: theme.colors.text,
                  borderColor: theme.colors.border 
                }]}
                placeholder="Redness, pain, blurry vision..."
                placeholderTextColor={theme.colors.textSecondary}
                value={symptomType}
                onChangeText={setSymptomType}
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Severity</Text>
              <TextInput
                style={[styles.smallInput, { 
                  backgroundColor: theme.colors.background, 
                  color: theme.colors.text,
                  borderColor: theme.colors.border 
                }]}
                placeholder="Mild, moderate, severe"
                placeholderTextColor={theme.colors.textSecondary}
                value={severity}
                onChangeText={setSeverity}
              />
            </View>
          </View>
          
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Duration</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.colors.background, 
              color: theme.colors.text,
              borderColor: theme.colors.border 
            }]}
            placeholder="How long have you had these symptoms?"
            placeholderTextColor={theme.colors.textSecondary}
            value={duration}
            onChangeText={setDuration}
          />
        </View>

        {/* Symptoms Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Describe Your Experience</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.colors.background, 
              color: theme.colors.text,
              borderColor: theme.colors.border 
            }]}
            placeholder="Describe your eye symptoms in detail..."
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            value={userNotes}
            onChangeText={setUserNotes}
          />

          <View style={styles.buttonsRow}>
            <TouchableOpacity 
              style={[styles.voiceButton, { backgroundColor: theme.colors.buttonPrimaryBg }]}
              onPress={handleStartSpeechRecognition}
              disabled={isRecognizing}
            >
              <MaterialIcons 
                name={isRecognizing ? "mic-off" : "keyboard-voice"} 
                size={24} 
                color={theme.colors.buttonText} 
              />
              <Text style={[styles.voiceButtonText, { color: theme.colors.buttonText }]}>
                {isRecognizing ? "Listening..." : "Voice Input"}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: theme.colors.accent }]}
              onPress={submitSymptoms}
              disabled={isAnalyzing}
            >
              <Text style={[styles.submitButtonText, { color: theme.colors.buttonText }]}>
                Analyze Symptoms
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Image Upload */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visual Analysis</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
            Upload a photo of your eye for AI analysis
          </Text>
          
          <View style={styles.imageButtons}>
            <TouchableOpacity 
              style={[styles.imageButton, { 
                backgroundColor: theme.colors.card, 
                borderColor: theme.colors.border 
              }]}
              onPress={pickImage}
            >
              <Ionicons name="image" size={24} color={theme.colors.primary} />
              <Text style={[styles.imageButtonText, { color: theme.colors.text }]}>
                Gallery
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.imageButton, { 
                backgroundColor: theme.colors.card, 
                borderColor: theme.colors.border 
              }]}
              onPress={takePhoto}
            >
              <Ionicons name="camera" size={24} color={theme.colors.primary} />
              <Text style={[styles.imageButtonText, { color: theme.colors.text }]}>
                Camera
              </Text>
            </TouchableOpacity>
          </View>

          {selectedImages.length > 0 && (
            <MultiImagePreview uris={selectedImages} onClear={() => setSelectedImages([])} />
          )}

          {isAnalyzing && (
            <View style={styles.analyzingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.analyzingText, { color: theme.colors.text }]}>
                Analyzing with Gemini AI...
              </Text>
            </View>
          )}
        </View>

        {/* Results */}
        {analysisResult ? (
          <View style={[styles.resultsContainer, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.resultsHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.resultsTitle, { color: theme.colors.text }]}>
                Eye Health Analysis
              </Text>
              <TouchableOpacity onPress={speakAnalysis}>
                <MaterialIcons 
                  name={isSpeaking ? "volume-off" : "volume-up"} 
                  size={28} 
                  color={theme.colors.accent} 
                />
              </TouchableOpacity>
            </View>
            
            {renderAnalysisResult()}
          </View>
        ) : (
          <View style={[styles.placeholderContainer, { backgroundColor: theme.colors.card }]}>
            <FontAwesome5 
              name="eye" 
              size={80} 
              color={theme.colors.primary} 
            />
            <Text style={[styles.placeholderText, { color: theme.colors.text }]}>
              Describe your eye symptoms or upload an image to get started
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Voice Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showSpeechModal}
        onRequestClose={stopSpeechRecognition}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Describe Your Eye Symptoms
            </Text>
            
            {isRecognizing ? (
              <View style={styles.recordingContainer}>
                <View style={[styles.pulseCircle, { backgroundColor: theme.colors.danger, opacity: 0.2 }]} />
                <Ionicons name="mic" size={60} color={theme.colors.danger} />
                <Text style={[styles.recordingText, { color: theme.colors.text }]}>
                  Listening... Describe your eye problems
                </Text>
              </View>
            ) : (
              <View>
                {transcript ? (
                  <Text style={[styles.transcribedText, { 
                    color: theme.colors.text,
                    backgroundColor: theme.colors.background
                  }]}>
                    {transcript}
                  </Text>
                ) : (
                  <View style={styles.noSpeechContainer}>
                    <Ionicons name="mic-off" size={60} color={theme.colors.text} />
                    <Text style={[styles.noSpeechText, { color: theme.colors.text }]}>
                      No speech detected
                    </Text>
                  </View>
                )}
              </View>
            )}
            
            <TouchableOpacity 
              style={[styles.modalCloseButton, { backgroundColor: theme.colors.primary }]}
              onPress={stopSpeechRecognition}
            >
              <Text style={[styles.modalCloseText, { color: theme.colors.buttonText }]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Styles using theme colors
const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 50,
  },
  section: {
    marginBottom: 25,
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 20,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 15,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  inputContainer: {
    width: '48%'
  },
  inputLabel: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 5,
  },
  input: {
    borderRadius: 15,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
  },
  smallInput: {
    borderRadius: 15,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  voiceButton: {
    flexDirection: 'row',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 10,
  },
  voiceButtonText: {
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 10,
  },
  submitButton: {
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 150,
  },
  submitButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
  imageButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  imageButton: {
    width: '48%',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  imageButtonText: {
    marginTop: 10,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  imagePreview: {
    width: '100%',
    height: 250,
    borderRadius: 15,
    borderWidth: 1,
  },
  analyzingContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  analyzingText: {
    marginTop: 10,
    fontSize: 16,
  },
  resultsContainer: {
    borderRadius: 20,
    padding: 20,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    paddingBottom: 15,
  },
  resultsTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 8,
  },
  resultText: {
    fontSize: 16,
    color: theme.colors.text,
    lineHeight: 24,
  },
  warningText: {
    fontWeight: '600',
    color: theme.colors.danger,
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderRadius: 20,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  placeholderText: {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 30,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  recordingContainer: {
    alignItems: 'center',
    padding: 30,
  },
  pulseCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  recordingText: {
    marginTop: 20,
    fontSize: 18,
  },
  transcribedText: {
    fontSize: 16,
    lineHeight: 24,
    padding: 15,
    borderRadius: 15,
    minHeight: 150,
  },
  noSpeechContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noSpeechText: {
    marginTop: 20,
    fontSize: 18,
    opacity: 0.7,
  },
  modalCloseButton: {
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  modalCloseText: {
    fontWeight: '600',
    fontSize: 16,
  },
});

export default EyeProblemsScreen;