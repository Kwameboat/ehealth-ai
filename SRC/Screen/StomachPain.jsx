// StomachPainScreen.js
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
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

import { generateContent } from '../services/geminiClient';

const StomachPainScreen = ({ navigation }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const [selectedImage, setSelectedImage] = useState(null);
  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userNotes, setUserNotes] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [showSpeechModal, setShowSpeechModal] = useState(false);
  const [painType, setPainType] = useState('');
  const [painLocation, setPainLocation] = useState('');
  const [painSeverity, setPainSeverity] = useState('');

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
    if (!userNotes.trim() && !painType && !painLocation) {
      Alert.alert('Input Required', 'Please describe your stomach pain first');
      return;
    }
    
    const symptomsText = `Pain Type: ${painType || 'Not provided'}\n
    Pain Location: ${painLocation || 'Not provided'}\n
    Pain Severity: ${painSeverity || 'Not provided'}\n
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
      const prompt = `The user is experiencing stomach pain with these details:
      ${text}
      
      Please provide a detailed medical analysis including:
      1. Potential causes and diagnosis
      2. Recommended treatments and medications
      3. Home care remedies and dietary recommendations
      4. Warning signs for when to seek medical help
      5. Prevention tips and lifestyle changes
      
      Format your response with clear sections and use medical terminology where appropriate.`;
      
      const data = await generateContent({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
      });
      if (data.candidates && data.candidates.length > 0) {
        const resultText = data.candidates[0].content.parts[0].text;
        setAnalysisResult(resultText);
      } else {
        throw new Error('No response from Gemini API');
      }
    } catch (error) {
      console.error('Gemini API error:', error);
      Alert.alert("Analysis Error", "Failed to analyze your symptoms. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Analyze Image with Gemini
  const analyzeImageWithGemini = async (imageUri) => {
    setIsAnalyzing(true);
    setAnalysisResult('');
    
    try {
      // Read image as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const mimeType = 'image/jpeg';
      
      const prompt = `Analyze this medical image related to stomach pain. 
      Provide a detailed analysis including:
      1. Potential diagnosis based on visual indicators
      2. Severity assessment
      3. Recommended medical interventions
      4. When to seek emergency care
      
      Format your response with clear sections.`;
      
      const data = await generateContent({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64
                }
              }
            ]
          }]
      });
      if (data.candidates && data.candidates.length > 0) {
        const resultText = data.candidates[0].content.parts[0].text;
        setAnalysisResult(resultText);
      } else {
        throw new Error('No response from Gemini API');
      }
    } catch (error) {
      console.error('Gemini API error:', error);
      Alert.alert("Analysis Error", "Failed to analyze the image. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Pick Image
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setSelectedImage(result.assets[0].uri);
      analyzeImageWithGemini(result.assets[0].uri);
    }
  };

  // Take Photo
  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setSelectedImage(result.assets[0].uri);
      analyzeImageWithGemini(result.assets[0].uri);
    }
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
    
    const sections = analysisResult.split('\n\n');
    return sections.map((section, index) => {
      if (section.includes('Diagnosis:') || section.includes('Potential Causes:')) {
        return (
          <View key={index} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Diagnosis & Causes</Text>
            <Text style={styles.resultText}>
              {section.replace('Diagnosis:', '').replace('Potential Causes:', '').trim()}
            </Text>
          </View>
        );
      }
      
      if (section.includes('Treatment:') || section.includes('Medications:')) {
        return (
          <View key={index} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Treatment & Medications</Text>
            <Text style={styles.resultText}>
              {section.replace('Treatment:', '').replace('Medications:', '').trim()}
            </Text>
          </View>
        );
      }
      
      if (section.includes('Home Care:')) {
        return (
          <View key={index} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Home Care & Diet</Text>
            <Text style={styles.resultText}>
              {section.replace('Home Care:', '').trim()}
            </Text>
          </View>
        );
      }
      
      if (section.includes('When to Seek Help:')) {
        return (
          <View key={index} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Emergency Warning Signs</Text>
            <Text style={[styles.resultText, styles.warningText]}>
              {section.replace('When to Seek Help:', '').trim()}
            </Text>
          </View>
        );
      }
      
      if (section.includes('Prevention:')) {
        return (
          <View key={index} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Prevention Tips</Text>
            <Text style={styles.resultText}>
              {section.replace('Prevention:', '').trim()}
            </Text>
          </View>
        );
      }
      
      return (
        <Text key={index} style={styles.resultText}>
          {section}
        </Text>
      );
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stomach Pain Analysis</Text>
        <FontAwesome5 name="stomach" size={24} color={theme.colors.text} style={styles.headerIcon} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Stomach Pain-specific input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stomach Pain Details</Text>
          
          <View style={styles.row}>
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Pain Type</Text>
              <TextInput
                style={[styles.smallInput, { 
                  backgroundColor: theme.colors.background, 
                  color: theme.colors.text,
                  borderColor: theme.colors.border 
                }]}
                placeholder="Cramping, sharp, dull..."
                placeholderTextColor={theme.colors.textSecondary}
                value={painType}
                onChangeText={setPainType}
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Pain Location</Text>
              <TextInput
                style={[styles.smallInput, { 
                  backgroundColor: theme.colors.background, 
                  color: theme.colors.text,
                  borderColor: theme.colors.border 
                }]}
                placeholder="Upper, lower, left, right..."
                placeholderTextColor={theme.colors.textSecondary}
                value={painLocation}
                onChangeText={setPainLocation}
              />
            </View>
          </View>
          
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Pain Severity (1-10)</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.colors.background, 
              color: theme.colors.text,
              borderColor: theme.colors.border 
            }]}
            placeholder="Rate your pain from 1 to 10"
            placeholderTextColor={theme.colors.textSecondary}
            keyboardType="numeric"
            value={painSeverity}
            onChangeText={setPainSeverity}
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
            placeholder="Describe your stomach pain in detail..."
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
            Upload any relevant photos for AI analysis
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

          {selectedImage && (
            <View style={styles.imagePreviewContainer}>
              <Image 
                source={{ uri: selectedImage }} 
                style={[styles.imagePreview, { borderColor: theme.colors.border }]} 
                resizeMode="cover"
              />
            </View>
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
                Medical Analysis
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
              name="stomach" 
              size={80} 
              color={theme.colors.primary} 
            />
            <Text style={[styles.placeholderText, { color: theme.colors.text }]}>
              Describe your stomach pain or upload an image to get started
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
              Describe Your Stomach Pain
            </Text>
            
            {isRecognizing ? (
              <View style={styles.recordingContainer}>
                <View style={[styles.pulseCircle, { backgroundColor: theme.colors.danger, opacity: 0.2 }]} />
                <Ionicons name="mic" size={60} color={theme.colors.danger} />
                <Text style={[styles.recordingText, { color: theme.colors.text }]}>
                  Listening... Describe your stomach pain
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.header,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  headerIcon: {
    marginLeft: 10
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

export default StomachPainScreen;