// JointMusclePainScreen.js
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

const JointMusclePainScreen = ({ navigation }) => {
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
  const [symptomDuration, setSymptomDuration] = useState('');
  const [painType, setPainType] = useState('');
  const [painSeverity, setPainSeverity] = useState('');
  const [affectedAreas, setAffectedAreas] = useState([]);
  const [associatedSymptoms, setAssociatedSymptoms] = useState([]);

  // Joint and muscle pain specific areas
  const bodyAreas = [
    'Neck',
    'Shoulders',
    'Upper back',
    'Lower back',
    'Hips',
    'Knees',
    'Ankles',
    'Elbows',
    'Wrists',
    'Multiple joints'
  ];

  // Joint and muscle pain specific symptoms
  const painSymptoms = [
    'Stiffness',
    'Swelling',
    'Redness',
    'Warmth',
    'Limited mobility',
    'Muscle weakness',
    'Fatigue',
    'Fever'
  ];

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

  // Toggle affected area
  const toggleArea = (area) => {
    if (affectedAreas.includes(area)) {
      setAffectedAreas(affectedAreas.filter(a => a !== area));
    } else {
      setAffectedAreas([...affectedAreas, area]);
    }
  };

  // Toggle associated symptom
  const toggleSymptom = (symptom) => {
    if (associatedSymptoms.includes(symptom)) {
      setAssociatedSymptoms(associatedSymptoms.filter(s => s !== symptom));
    } else {
      setAssociatedSymptoms([...associatedSymptoms, symptom]);
    }
  };

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
      setUserNotes(prev => prev ? `${prev} ${transcript}` : transcript);
      setShowSpeechModal(false);
    } catch (error) {
      console.error('Stop recognition error:', error);
    }
  };

  // Submit Symptoms to Gemini
  const submitSymptoms = async () => {
    if (!userNotes.trim() && affectedAreas.length === 0) {
      Alert.alert('Input Required', 'Please describe your symptoms first');
      return;
    }
    
    await analyzeTextWithGemini(userNotes);
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
      const prompt = `The user is describing joint and muscle pain: "${text}". 
      Duration: ${symptomDuration || 'Not specified'}
      Pain Type: ${painType || 'Not specified'}
      Pain Severity: ${painSeverity || 'Not specified'}
      Affected Areas: ${affectedAreas.join(', ') || 'Not specified'}
      Associated Symptoms: ${associatedSymptoms.join(', ') || 'None'}
      
      Please provide a detailed analysis of potential musculoskeletal conditions, 
      symptoms, causes, and recommendations for treatment and medication. 
      Also, suggest when to consult a doctor. Format your response with 
      clear sections for Analysis, Recommendations, and When to Seek Help.
      Pay special attention to potentially serious conditions like arthritis, 
      fibromyalgia, or injuries.`;
      
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
      
      const prompt = `Analyze this image of a musculoskeletal condition. 
      Provide a detailed analysis of potential joint and muscle pain causes, 
      symptoms, and recommendations for treatment and medication. Also, 
      suggest when to consult a doctor. Format your response with clear 
      sections for Analysis, Recommendations, and When to Seek Help.`;
      
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
      if (section.includes('Analysis:')) {
        return (
          <View key={index} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Analysis</Text>
            <Text style={styles.resultText}>
              {section.replace('Analysis:', '').trim()}
            </Text>
          </View>
        );
      }
      
      if (section.includes('Recommendations:')) {
        return (
          <View key={index} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Treatment & Medication</Text>
            <Text style={styles.resultText}>
              {section.replace('Recommendations:', '').trim()}
            </Text>
          </View>
        );
      }
      
      if (section.includes('When to Seek Help:')) {
        return (
          <View key={index} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>When to Consult a Doctor</Text>
            <Text style={styles.resultText}>
              {section.replace('When to Seek Help:', '').trim()}
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
        <Text style={styles.headerTitle}>Joint & Muscle Pain Analysis</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Symptoms Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Describe Your Pain</Text>
          
          {/* Duration Input */}
          <Text style={styles.inputLabel}>How long have you had this pain?</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 2 days, 1 week, etc."
            placeholderTextColor={theme.colors.textSecondary}
            value={symptomDuration}
            onChangeText={setSymptomDuration}
          />
          
          {/* Pain Type Input */}
          <Text style={styles.inputLabel}>What type of pain are you experiencing?</Text>
          <View style={styles.patternContainer}>
            {['Aching', 'Sharp', 'Burning', 'Throbbing', 'Stabbing'].map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.patternButton,
                  painType === type && { backgroundColor: theme.colors.primary }
                ]}
                onPress={() => setPainType(type)}
              >
                <Text style={[
                  styles.patternText,
                  painType === type && { color: theme.colors.buttonText }
                ]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Pain Severity Input */}
          <Text style={styles.inputLabel}>How severe is your pain?</Text>
          <View style={styles.severityContainer}>
            {['Mild', 'Moderate', 'Severe', 'Debilitating'].map(severity => (
              <TouchableOpacity
                key={severity}
                style={[
                  styles.severityButton,
                  painSeverity === severity && { backgroundColor: theme.colors.primary }
                ]}
                onPress={() => setPainSeverity(severity)}
              >
                <Text style={[
                  styles.severityText,
                  painSeverity === severity && { color: theme.colors.buttonText }
                ]}>
                  {severity}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Affected Areas */}
          <Text style={styles.inputLabel}>Select affected areas</Text>
          <View style={styles.symptomsGrid}>
            {bodyAreas.map(area => (
              <TouchableOpacity
                key={area}
                style={[
                  styles.symptomButton,
                  affectedAreas.includes(area) && { backgroundColor: theme.colors.primary }
                ]}
                onPress={() => toggleArea(area)}
              >
                <Text style={[
                  styles.symptomText,
                  affectedAreas.includes(area) && { color: theme.colors.buttonText }
                ]}>
                  {area}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Associated Symptoms */}
          <Text style={styles.inputLabel}>Select associated symptoms</Text>
          <View style={styles.symptomsGrid}>
            {painSymptoms.map(symptom => (
              <TouchableOpacity
                key={symptom}
                style={[
                  styles.symptomButton,
                  associatedSymptoms.includes(symptom) && { backgroundColor: theme.colors.primary }
                ]}
                onPress={() => toggleSymptom(symptom)}
              >
                <Text style={[
                  styles.symptomText,
                  associatedSymptoms.includes(symptom) && { color: theme.colors.buttonText }
                ]}>
                  {symptom}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <Text style={styles.inputLabel}>Describe your symptoms in detail</Text>
          <TextInput
            style={[styles.input, { minHeight: 120 }]}
            placeholder="Describe your pain, triggers, when it worsens, etc..."
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
                Submit Symptoms
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Emergency Warning */}
        <View style={[styles.warningContainer, { backgroundColor: theme.colors.danger + '20' }]}>
          <Ionicons name="warning" size={24} color={theme.colors.danger} />
          <Text style={[styles.warningText, { color: theme.colors.danger }]}>
            Seek immediate medical attention if experiencing severe pain after injury, joint deformity, inability to move a joint, or sudden severe swelling.
          </Text>
        </View>

        {/* Self-care Tips */}
        <View style={[styles.tipsContainer, { backgroundColor: theme.colors.card + '80' }]}>
          <Ionicons name="bulb" size={24} color={theme.colors.primary} />
          <Text style={[styles.tipsText, { color: theme.colors.text }]}>
            Try gentle stretching, applying heat or cold packs, and over-the-counter pain relievers for mild to moderate pain.
          </Text>
        </View>

        {/* Image Upload */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visual Analysis</Text>
          <Text style={styles.sectionSubtitle}>Upload or take a photo for AI analysis</Text>
          
          <View style={styles.imageButtons}>
            <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
              <Ionicons name="image" size={24} color={theme.colors.primary} />
              <Text style={[styles.imageButtonText, { color: theme.colors.text }]}>
                Gallery
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imageButton} onPress={takePhoto}>
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
                style={styles.imagePreview} 
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
            <View style={styles.resultsHeader}>
              <Text style={[styles.resultsTitle, { color: theme.colors.text }]}>
                Analysis Results
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
              name="bone" 
              size={80} 
              color={theme.colors.primary} 
            />
            <Text style={[styles.placeholderText, { color: theme.colors.text }]}>
              Describe your joint or muscle pain or upload an image to get started
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
              Describe Your Pain Symptoms
            </Text>
            
            {isRecognizing ? (
              <View style={styles.recordingContainer}>
                <View style={[styles.pulseCircle, { backgroundColor: theme.colors.danger, opacity: 0.2 }]} />
                <Ionicons name="mic" size={60} color={theme.colors.danger} />
                <Text style={[styles.recordingText, { color: theme.colors.text }]}>
                  Listening... Speak now
                </Text>
              </View>
            ) : (
              <Text style={[styles.transcribedText, { color: theme.colors.text }]}>
                {transcript || 'Your speech will appear here...'}
              </Text>
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

// Styles
const getStyles = (theme) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: theme.colors.background 
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
    marginRight: 15 
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: theme.colors.text 
  },
  scrollContainer: { 
    padding: 20, 
    paddingBottom: 50 
  },
  section: {
    marginBottom: 30, 
    backgroundColor: theme.colors.card,
    borderRadius: 20, 
    padding: 20, 
    elevation: 5,
  },
  sectionTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: theme.colors.text, 
    marginBottom: 15 
  },
  sectionSubtitle: { 
    fontSize: 14, 
    color: theme.colors.textSecondary, 
    marginBottom: 20 
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: theme.colors.background, 
    borderRadius: 15,
    padding: 15, 
    textAlignVertical: 'top',
    color: theme.colors.text, 
    fontSize: 16, 
    marginBottom: 15,
    borderWidth: 1, 
    borderColor: theme.colors.border,
  },
  patternContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  severityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  patternButton: {
    width: '48%',
    padding: 12,
    marginBottom: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  severityButton: {
    width: '48%',
    padding: 12,
    marginBottom: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  patternText: {
    fontWeight: '600',
    fontSize: 14,
    color: theme.colors.text,
    textAlign: 'center',
  },
  severityText: {
    fontWeight: '600',
    fontSize: 14,
    color: theme.colors.text,
    textAlign: 'center',
  },
  symptomsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  symptomButton: {
    width: '48%',
    padding: 12,
    marginBottom: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  symptomText: {
    fontWeight: '600',
    fontSize: 14,
    color: theme.colors.text,
    textAlign: 'center',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 15,
    marginBottom: 20,
  },
  warningText: {
    marginLeft: 10,
    flex: 1,
    fontWeight: '600',
    fontSize: 14,
  },
  tipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 15,
    marginBottom: 20,
  },
  tipsText: {
    marginLeft: 10,
    flex: 1,
    fontSize: 14,
    fontStyle: 'italic',
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
    marginLeft: 10 
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
    marginBottom: 20 
  },
  imageButton: {
    width: '48%', 
    backgroundColor: theme.colors.card, 
    borderRadius: 15,
    padding: 20, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1, 
    borderColor: theme.colors.border,
  },
  imageButtonText: { 
    marginTop: 10, 
    fontWeight: '600' 
  },
  imagePreviewContainer: { 
    alignItems: 'center', 
    marginTop: 10 
  },
  imagePreview: { 
    width: '100%', 
    height: 250, 
    borderRadius: 15, 
    borderWidth: 1, 
    borderColor: theme.colors.border 
  },
  analyzingContainer: { 
    marginTop: 20, 
    alignItems: 'center' 
  },
  analyzingText: { 
    marginTop: 10, 
    fontSize: 16 
  },
  resultsContainer: { 
    borderRadius: 20, 
    padding: 20, 
    elevation: 5 
  },
  resultsHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 15 
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
    lineHeight: 24 
  },
  placeholderContainer: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 40, 
    borderRadius: 20 
  },
  placeholderText: { 
    marginTop: 20, 
    fontSize: 16, 
    textAlign: 'center', 
    opacity: 0.7 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rg0,0,0,0.5)', 
    justifyContent: 'flex-end' 
  },
  modalContainer: { 
    borderTopLeftRadius: 30, 
    borderTopRightRadius: 30, 
    padding: 30, 
    paddingBottom: 40 
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    marginBottom: 20, 
    textAlign: 'center' 
  },
  recordingContainer: { 
    alignItems: 'center', 
    padding: 30 
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
    backgroundColor: theme.colors.background, 
    borderRadius: 15, 
    minHeight: 150 
  },
  modalCloseButton: { 
    borderRadius: 15, 
    padding: 15, 
    alignItems: 'center', 
    marginTop: 20 
  },
  modalCloseText: { 
    fontWeight: '600', 
    fontSize: 16 
  },
});

export default JointMusclePainScreen;