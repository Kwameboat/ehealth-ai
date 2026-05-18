// ChestPainScreen.js
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent
} from 'expo-speech-recognition';
import React, { useEffect, useState } from 'react';
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

const ChestPainScreen = ({ navigation }) => {
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
  const [painType, setPainType] = useState(''); // 'sharp', 'dull', 'burning', 'pressure'

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
      setUserNotes(prev => prev ? `${prev} ${transcript}` : transcript);
      setShowSpeechModal(false);
    } catch (error) {
      console.error('Stop recognition error:', error);
    }
  };

  // Submit Voice Notes to Gemini
  const submitVoiceNotes = async () => {
    if (!userNotes.trim()) {
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
      const prompt = `The user is describing chest pain symptoms: "${text}". 
      Please provide a detailed analysis of potential causes, severity, 
      and whether this might be a medical emergency. Include information about 
      cardiac vs. non-cardiac causes, when to seek immediate medical attention, 
      and general recommendations. Format your response with clear sections for 
      Analysis, Potential Causes, Immediate Actions, and When to Seek Emergency Help.
      Be compassionate but direct about potential seriousness.`;
      
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
        
        // Try to detect the type of pain
        const resultLower = resultText.toLowerCase();
        if (resultLower.includes('sharp') || resultLower.includes('stabbing')) {
          setPainType('sharp');
        } else if (resultLower.includes('dull') || resultLower.includes('aching')) {
          setPainType('dull');
        } else if (resultLower.includes('burning') || resultLower.includes('acid')) {
          setPainType('burning');
        } else if (resultLower.includes('pressure') || resultLower.includes('tight')) {
          setPainType('pressure');
        }
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
      
      const prompt = `Analyze this image related to chest pain or discomfort. 
      Provide a detailed analysis of potential causes, severity, 
      and whether this might be a medical emergency. Include information about 
      cardiac vs. non-cardiac causes, when to seek immediate medical attention, 
      and general recommendations. Format your response with clear sections for 
      Analysis, Potential Causes, Immediate Actions, and When to Seek Emergency Help.
      Be compassionate but direct about potential seriousness.`;
      
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
        
        // Try to detect the type of pain
        const resultLower = resultText.toLowerCase();
        if (resultLower.includes('sharp') || resultLower.includes('stabbing')) {
          setPainType('sharp');
        } else if (resultLower.includes('dull') || resultLower.includes('aching')) {
          setPainType('dull');
        } else if (resultLower.includes('burning') || resultLower.includes('acid')) {
          setPainType('burning');
        } else if (resultLower.includes('pressure') || resultLower.includes('tight')) {
          setPainType('pressure');
        }
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
      
      if (section.includes('Potential Causes:')) {
        return (
          <View key={index} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Potential Causes</Text>
            <Text style={styles.resultText}>
              {section.replace('Potential Causes:', '').trim()}
            </Text>
          </View>
        );
      }
      
      if (section.includes('Immediate Actions:')) {
        return (
          <View key={index} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Immediate Actions</Text>
            <Text style={styles.resultText}>
              {section.replace('Immediate Actions:', '').trim()}
            </Text>
          </View>
        );
      }
      
      if (section.includes('When to Seek Emergency Help:')) {
        return (
          <View key={index} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>When to Seek Emergency Help</Text>
            <Text style={styles.resultText}>
              {section.replace('When to Seek Emergency Help:', '').trim()}
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
        <Text style={styles.headerTitle}>Chest Pain Analysis</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Pain Type Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Describe Your Pain Type</Text>
          <View style={styles.painButtons}>
            <TouchableOpacity 
              style={[
                styles.painButton, 
                painType === 'sharp' && { backgroundColor: theme.colors.primary + '20' }
              ]}
              onPress={() => setPainType('sharp')}
            >
              <Ionicons 
                name="flash" 
                size={24} 
                color={painType === 'sharp' ? theme.colors.primary : theme.colors.textSecondary} 
              />
              <Text style={[
                styles.painButtonText, 
                { color: painType === 'sharp' ? theme.colors.primary : theme.colors.text }
              ]}>
                Sharp
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.painButton, 
                painType === 'dull' && { backgroundColor: theme.colors.primary + '20' }
              ]}
              onPress={() => setPainType('dull')}
            >
              <Ionicons 
                name="pulse" 
                size={24} 
                color={painType === 'dull' ? theme.colors.primary : theme.colors.textSecondary} 
              />
              <Text style={[
                styles.painButtonText, 
                { color: painType === 'dull' ? theme.colors.primary : theme.colors.text }
              ]}>
                Dull
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.painButton, 
                painType === 'burning' && { backgroundColor: theme.colors.primary + '20' }
              ]}
              onPress={() => setPainType('burning')}
            >
              <Ionicons 
                name="flame" 
                size={24} 
                color={painType === 'burning' ? theme.colors.primary : theme.colors.textSecondary} 
              />
              <Text style={[
                styles.painButtonText, 
                { color: painType === 'burning' ? theme.colors.primary : theme.colors.text }
              ]}>
                Burning
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.painButton, 
                painType === 'pressure' && { backgroundColor: theme.colors.primary + '20' }
              ]}
              onPress={() => setPainType('pressure')}
            >
              <Ionicons 
                name="compress" 
                size={24} 
                color={painType === 'pressure' ? theme.colors.primary : theme.colors.textSecondary} 
              />
              <Text style={[
                styles.painButtonText, 
                { color: painType === 'pressure' ? theme.colors.primary : theme.colors.text }
              ]}>
                Pressure
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Symptoms Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Describe Your Symptoms</Text>
          <TextInput
            style={styles.input}
            placeholder="Describe your chest pain (location, intensity, duration, triggers, associated symptoms like shortness of breath, etc.)..."
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
              onPress={submitVoiceNotes}
              disabled={isAnalyzing}
            >
              <Text style={[styles.submitButtonText, { color: theme.colors.buttonText }]}>
                Submit Symptoms
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Image Upload */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visual Analysis</Text>
          <Text style={styles.sectionSubtitle}>Upload or take a photo if relevant to your symptoms</Text>
          
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

        {/* Emergency Warning */}
        <View style={[styles.warningContainer, { backgroundColor: theme.colors.danger + '20' }]}>
          <Ionicons name="warning" size={24} color={theme.colors.danger} />
          <Text style={[styles.warningText, { color: theme.colors.danger }]}>
            Chest pain can be serious. If you experience severe pain, shortness of breath, or pain radiating to your arm or jaw, seek emergency medical attention immediately.
          </Text>
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
              name="heartbeat" 
              size={80} 
              color={theme.colors.primary} 
            />
            <Text style={[styles.placeholderText, { color: theme.colors.text }]}>
              Describe your symptoms or upload an image to get started
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
              Describe Your Symptoms
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
  painButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  painButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: '48%',
    marginBottom: 10,
    justifyContent: 'center',
  },
  painButtonText: {
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 14,
  },
  input: {
    backgroundColor: theme.colors.background, 
    borderRadius: 15,
    padding: 15, 
    minHeight: 120, 
    textAlignVertical: 'top',
    color: theme.colors.text, 
    fontSize: 16, 
    marginBottom: 15,
    borderWidth: 1, 
    borderColor: theme.colors.border,
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
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 15,
    marginBottom: 30,
  },
  warningText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
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
    backgroundColor: 'rgba(0,0,0,0.5)', 
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

export default ChestPainScreen;