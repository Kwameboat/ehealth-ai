import { LinearGradient } from "expo-linear-gradient";
import * as Speech from "expo-speech";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Easing,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

import { generateContent } from '../services/geminiClient';

const MAX_TURNS = 30;

const MedicalVoiceAssistantScreen = ({ navigation }) => {
  // --- State ---
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [conversation, setConversation] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // --- Anims/Refs ---
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef(null);
  const transcriptRef = useRef("");
  const greetedRef = useRef(false);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      // Stop all speech and recognition when component unmounts
      Speech.stop();
      if (ExpoSpeechRecognitionModule && ExpoSpeechRecognitionModule.stop) {
        ExpoSpeechRecognitionModule.stop();
      }
    };
  }, []);

  // --- Back handler (prevents accidental exit while speaking/listening) ---
  useEffect(() => {
    const onBack = () => {
      if (isListening || isSpeaking || isLoading) {
        Alert.alert(
          "Busy",
          "Voice is active right now. Stop speaking/playing first."
        );
        return true;
      }
      // Stop speech and recognition before going back
      Speech.stop();
      if (ExpoSpeechRecognitionModule && ExpoSpeechRecognitionModule.stop) {
        ExpoSpeechRecognitionModule.stop();
      }
      return false;
    };
    
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [isListening, isSpeaking, isLoading]);

  // --- Initial greeting (once) ---
  useEffect(() => {
    if (greetedRef.current) return;
    greetedRef.current = true;
    const greet =
      "Hello, I'm your medical voice assistant. How can I care for you today?";
    appendAssistant(greet);
    speak(greet);
  }, []);

  // --- Animations ---
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();
    return () => fadeAnim.setValue(0);
  }, []);

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      pulseAnim.setValue(1);
      waveAnim.setValue(0);
    }
  }, [isListening]);

  // --- Auto-scroll chat ---
  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => scrollRef.current.scrollToEnd({ animated: true }), 80);
    }
  }, [conversation, isLoading]);

  const getResultText = (event) => {
    const results = event?.results || [];
    const joined = results
      .map((r) => r?.transcript || "")
      .filter(Boolean)
      .join(" ")
      .trim();
    return joined || results[0]?.transcript || "";
  };

  // --- STT Events ---
  useSpeechRecognitionEvent("start", () => setIsListening(true));
  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    const finalText = (transcriptRef.current || "").trim();
    if (finalText) setTranscript(finalText);
    transcriptRef.current = "";
  });
  useSpeechRecognitionEvent("speechend", () => {
    stopListening();
  });
  useSpeechRecognitionEvent("result", (e) => {
    const text = getResultText(e);
    if (text) {
      transcriptRef.current = text;
      setTranscript(text);
    }
    if (e?.isFinal) {
      stopListening();
    }
  });
  useSpeechRecognitionEvent("error", (e) => {
    console.warn("STT error:", e?.error, e?.message);
    if (e?.message && e.message !== "aborted") {
      Alert.alert("Voice Error", e.message || "Speech recognition failed.");
    }
    stopListening();
  });

  // --- Helpers: append messages ---
  const appendUser = (text) =>
    setConversation((prev) => [...prev, { role: "user", text, ts: new Date() }]);
  const appendAssistant = (text) =>
    setConversation((prev) => [
      ...prev,
      { role: "assistant", text, ts: new Date() },
    ]);

  // --- Permissions (Android mic) ---
  const ensureMicPermission = async () => {
    if (Platform.OS !== "android") return true;
    try {
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: "Microphone Permission",
          message: "Medical Assistant needs access to your microphone.",
          buttonPositive: "OK",
        }
      );
      return res === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      console.warn("Mic perm error:", e);
      return false;
    }
  };

  // --- Start/Stop listening ---
  const startListening = async () => {
    try {
      const ok = await ensureMicPermission();
      if (!ok) {
        Alert.alert("Permission Needed", "Microphone access is required.");
        return;
      }
      Speech.stop();
      setTranscript("");
      transcriptRef.current = "";
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm?.granted) {
        Alert.alert("Permission Needed", "Speech recognition permission denied.");
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        continuous: Platform.OS === "android",
        iosVoiceProcessingEnabled: Platform.OS === "ios",
      });
    } catch (e) {
      console.error("Start STT error:", e);
      Alert.alert("Error", "Could not start listening.");
    }
  };

  const stopListening = () => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {}
    setIsListening(false);
    const finalText = (transcriptRef.current || "").trim();
    if (finalText) setTranscript(finalText);
  };

  // --- TTS ---
  const speak = (text) => {
    Speech.stop();
    Speech.speak(text, {
      language: "en-US",
      rate: 0.95,
      pitch: 1.0,
      onStart: () => setIsSpeaking(true),
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  // --- Send message to Gemini ---
  const sendToGemini = async (userText) => {
    setIsLoading(true);
    try {
      // Build safe, concise medical prompt with context
      const { MEDICAL_CHAT_SYSTEM_PROMPT } = await import('../Config/medicalChatPrompt');
      const systemPreamble = MEDICAL_CHAT_SYSTEM_PROMPT;

      // Convert recent convo (trim to last ~12 turns for token control)
      const recent = conversation.slice(-12).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.text }],
      }));

      const contents = [
        { role: "user", parts: [{ text: systemPreamble }] },
        ...recent,
        { role: "user", parts: [{ text: userText }] },
      ];

      const data = await generateContent({ contents }, { featureKey: 'voice_consultation' });

      const reply =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "I'm having trouble right now. Please try again.";

      appendAssistant(reply);
      speak(reply);
    } catch (e) {
      console.error("Gemini error:", e);
      const fallback =
        "Sorry—something went wrong connecting to my medical knowledge. Please try again.";
      appendAssistant(fallback);
      speak(fallback);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Submit (from mic or text box) ---
  const handleSend = async () => {
    const text = (transcript || "").trim();
    if (!text) {
      Alert.alert("Empty", "Please say or type your health question.");
      return;
    }
    stopListening();
    setTranscript("");
    appendUser(text);
    await sendToGemini(text);
  };

  // --- Quick symptom chips (optional helpers) ---
  const quickTopics = [
    "I have a fever and sore throat.",
    "Chest tightness when I exercise.",
    "Migraine with light sensitivity.",
    "Stomach pain after eating.",
    "Anxiety and trouble sleeping.",
  ];
  const onQuickTap = async (t) => {
    appendUser(t);
    await sendToGemini(t);
  };

  // --- Wave bars ---
  const renderWave = () => {
    const items = [];
    for (let i = 0; i < 5; i++) {
      items.push(
        <Animated.View
          key={i}
          style={[
            styles.wave,
            {
              transform: [
                {
                  scale: waveAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.5],
                  }),
                },
                {
                  translateY: waveAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -8],
                  }),
                },
              ],
              opacity: waveAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.3, 0.8, 0.3],
              }),
            },
          ]}
        />
      );
    }
    return items;
  };

  // Handle navigation back with cleanup
  const handleBack = () => {
    // Stop all speech and recognition
    Speech.stop();
    if (ExpoSpeechRecognitionModule && ExpoSpeechRecognitionModule.stop) {
      ExpoSpeechRecognitionModule.stop();
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Header with Back Button */}
        <LinearGradient
          colors={["#1a237e", "#4a148c"]}
          style={styles.headerGradient}
        >
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBack}
          >
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.headerTextContainer}>
            <Text style={styles.appTitle}>Medical Voice Assistant</Text>
            <Text style={styles.appSubtitle}>
              Ask about symptoms, self-care, and when to seek help
            </Text>
          </View>
        </LinearGradient>

        {/* Quick topics */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickRow}
        >
          {quickTopics.map((t, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.chip}
              onPress={() => onQuickTap(t)}
              disabled={isLoading || isListening}
            >
              <Icon name="flash" size={16} color="#fff" />
              <Text style={styles.chipText}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Conversation */}
        <ScrollView
          ref={scrollRef}
          style={styles.conversation}
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          {conversation.map((m, idx) => {
            const isAI = m.role === "assistant";
            return (
              <View
                key={idx}
                style={[
                  styles.messageRow,
                  isAI ? styles.left : styles.right,
                ]}
              >
                <LinearGradient
                  colors={
                    isAI ? ["#e3f2fd", "#bbdefb"] : ["#e8f5e9", "#c8e6c9"]
                  }
                  style={styles.avatar}
                >
                  <Icon
                    name={isAI ? "stethoscope" : "account"}
                    size={24}
                    color={isAI ? "#1565c0" : "#2e7d32"}
                  />
                </LinearGradient>

                <LinearGradient
                  colors={
                    isAI ? ["#e3f2fd", "#bbdefb"] : ["#e8f5e9", "#c8e6c9"]
                  }
                  style={styles.bubble}
                >
                  <Text
                    style={[
                      styles.msgText,
                      isAI ? styles.aiText : styles.userText,
                    ]}
                  >
                    {m.text}
                  </Text>
                </LinearGradient>
              </View>
            );
          })}

          {isLoading && (
            <View style={[styles.messageRow, styles.left]}>
              <LinearGradient
                colors={["#e3f2fd", "#bbdefb"]}
                style={styles.avatar}
              >
                <Icon name="stethoscope" size={24} color="#1565c0" />
              </LinearGradient>
              <LinearGradient
                colors={["#e3f2fd", "#bbdefb"]}
                style={styles.bubbleThinking}
              >
                <ActivityIndicator size="small" color="#0d47a1" />
                <Text style={styles.thinking}>Thinking...</Text>
              </LinearGradient>
            </View>
          )}
        </ScrollView>

        {/* Input / Controls */}
        <View style={styles.inputSection}>
          <TextInput
            style={styles.input}
            placeholder={isListening ? "Listening..." : "Describe your symptoms"}
            placeholderTextColor="#666"
            value={transcript}
            onChangeText={setTranscript}
            editable={!isLoading}
            multiline
          />

          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={styles.replayButton}
              onPress={() => {
                const lastAI = [...conversation]
                  .reverse()
                  .find((m) => m.role === "assistant");
                if (lastAI) speak(lastAI.text);
              }}
              disabled={isSpeaking}
            >
              <Icon name="replay" size={22} color="#fff" />
            </TouchableOpacity>

            <Animated.View
              style={[
                styles.micButton,
                isListening && styles.recording,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <TouchableOpacity
                style={styles.micInner}
                onPress={isListening ? stopListening : startListening}
              >
                <Icon
                  name={isListening ? "microphone" : "microphone-outline"}
                  size={26}
                  color="#fff"
                />
                {isListening && (
                  <View style={styles.waveWrap}>{renderWave()}</View>
                )}
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSend}
              disabled={isLoading}
            >
              <Icon name="send" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.disclaimer}
            activeOpacity={0.8}
            onPress={() =>
              Alert.alert(
                "Important",
                "This assistant provides general information and is not a substitute for professional medical advice. Call emergency services for urgent symptoms."
              )
            }
          >
            <Icon name="alert-circle-outline" size={18} color="#546e7a" />
            <Text style={styles.disclaimerText}>
              Educational only — not a diagnosis. Seek urgent care for severe
              symptoms.
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

// --- Styles with fixed black text ---
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5f7fa" },
  container: { flex: 1 },
  headerGradient: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTextContainer: {
    flex: 1,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff", // White text on dark background
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)", // Semi-transparent white
  },

  quickRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#5e35b1",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
  },
  chipText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  conversation: { flex: 1, paddingHorizontal: 14, backgroundColor: "#f5f7fa" },
  messageRow: {
    flexDirection: "row",
    marginBottom: 14,
    maxWidth: "92%",
  },
  left: { alignSelf: "flex-start" },
  right: { alignSelf: "flex-end", flexDirection: "row-reverse" },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
  bubble: {
    borderRadius: 16,
    padding: 12,
    maxWidth: "82%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  bubbleThinking: {
    borderRadius: 16,
    padding: 12,
    maxWidth: "82%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  msgText: { 
    fontSize: 16, 
    lineHeight: 22,
    color: "#000", // Fixed black text
  },
  aiText: { color: "#000" }, // Fixed black text
  userText: { color: "#000" }, // Fixed black text
  thinking: { 
    color: "#000", // Fixed black text
    fontStyle: "italic" 
  },

  inputSection: {
    padding: 14,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
  },
  input: {
    backgroundColor: "#f5f7fa",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    minHeight: 68,
    fontSize: 16,
    marginBottom: 12,
    textAlignVertical: "top",
    color: "#000", // Fixed black text
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  replayButton: {
    backgroundColor: "#78909c",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  micButton: {
    backgroundColor: "#5e35b1",
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    position: "relative",
  },
  recording: { backgroundColor: "#e53935" },
  micInner: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  waveWrap: {
    position: "absolute",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
    zIndex: -1,
  },
  wave: {
    width: 5,
    height: 18,
    backgroundColor: "rgba(255,255,255,0.6)",
    marginHorizontal: 2,
    borderRadius: 3,
  },
  sendButton: {
    backgroundColor: "#43a047",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  disclaimer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#f5f7fa",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  disclaimerText: { 
    color: "#000", // Fixed black text
    fontSize: 12, 
    flex: 1 
  },
});

export default MedicalVoiceAssistantScreen;