import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useTheme } from '../Context/ThemeContext';

const { width, height } = Dimensions.get('window');
import { generateContent, GEMINI_MODEL_PRO } from '../services/geminiClient';

const EmergencyScreen = ({ navigation }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalling, setIsCalling] = useState(false);
  const [aiResponse, setAiResponse] = useState('');

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const emergencyBtnScale = useRef(new Animated.Value(1)).current;
  const cardAnimations = useRef([]).current;

  // Start animations
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 800,
          easing: Easing.ease,
          useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.ease,
          useNativeDriver: true
        })
      ])
    ).start();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true
      })
    ]).start();
  }, []);

  // Animate hospital cards when they load
  useEffect(() => {
    if (hospitals.length > 0) {
      hospitals.forEach((_, index) => {
        if (!cardAnimations[index]) {
          cardAnimations[index] = new Animated.Value(0);
        }
        
        setTimeout(() => {
          Animated.spring(cardAnimations[index], {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
            delay: index * 150
          }).start();
        }, 300);
      });
    }
  }, [hospitals]);

  useEffect(() => {
    getLocationAndFindHospitals();
  }, []);

  const getLocationAndFindHospitals = async () => {
    try {
      // Request location permission
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        setIsLoading(false);
        return;
      }

      // Get current location
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      setLocation(location.coords);
      
      // Find hospitals using Gemini AI
      await findHospitalsWithAI(location.coords);
    } catch (error) {
      console.error('Location error:', error);
      setErrorMsg('Failed to get your location');
      setIsLoading(false);
    }
  };

  const findHospitalsWithAI = async (coords) => {
    try {
      const prompt = `Find the nearest hospitals and emergency medical centers near latitude ${coords.latitude} and longitude ${coords.longitude}. 
      Provide the results in a structured JSON format with name, address, phone number, distance, and emergency services availability.
      Also provide a brief analysis of emergency medical services in this area.`;
      
      const data = await generateContent(
        {
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        },
        { model: GEMINI_MODEL_PRO, featureKey: 'emergency_lookup' }
      );
      if (data.candidates && data.candidates.length > 0) {
        const resultText = data.candidates[0].content.parts[0].text;
        setAiResponse(resultText);
        
        // Parse the AI response to extract hospital information
        // In a real app, you would implement proper parsing logic
        // For now, we'll use mock data as a fallback
        parseHospitalData(resultText, coords);
      } else {
        throw new Error('No response from Gemini API');
      }
    } catch (error) {
      console.error('Gemini API error:', error);
      // Fallback to mock data if API fails
      useMockHospitalData();
    }
  };

  const parseHospitalData = (text, coords) => {
    // This is a simplified parser - in a real app, you would implement
    // more robust parsing based on the AI response format
    try {
      // Try to find JSON in the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const hospitalData = JSON.parse(jsonMatch[0]);
        setHospitals(hospitalData.hospitals || []);
      } else {
        // If no JSON found, use mock data
        useMockHospitalData();
      }
    } catch (error) {
      console.error('Error parsing AI response:', error);
      useMockHospitalData();
    } finally {
      setIsLoading(false);
    }
  };

  const useMockHospitalData = () => {
    // Mock hospital data as fallback
    const mockHospitals = [
      {
        id: 1,
        name: 'City General Hospital',
        address: '123 Medical Center Dr, Cityville',
        distance: '0.8 mi',
        phone: '+1-555-0123',
        emergency: true,
        waitTime: '15 min'
      },
      {
        id: 2,
        name: 'Community Medical Center',
        address: '456 Health Ave, Townsville',
        distance: '1.2 mi',
        phone: '+1-555-0456',
        emergency: true,
        waitTime: '25 min'
      },
      {
        id: 3,
        name: 'Urgent Care Clinic',
        address: '789 Wellness St, Villagetown',
        distance: '2.1 mi',
        phone: '+1-555-0789',
        emergency: false,
        waitTime: '10 min'
      }
    ];
    
    setHospitals(mockHospitals);
    setIsLoading(false);
  };

  const callEmergency = (number) => {
    setIsCalling(true);
    
    // Button press animation
    Animated.sequence([
      Animated.timing(emergencyBtnScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(emergencyBtnScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true
      })
    ]).start();

    Alert.alert(
      "Emergency Call",
      `Are you sure you want to call ${number}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => setIsCalling(false)
        },
        { 
          text: "Call", 
          onPress: () => {
            Linking.openURL(`tel:${number}`);
            setTimeout(() => setIsCalling(false), 2000);
          }
        }
      ]
    );
  };

  const openMaps = (address) => {
    const url = Platform.select({
      ios: `maps://?q=${encodeURIComponent(address)}`,
      android: `geo://?q=${encodeURIComponent(address)}`
    });
    
    Linking.openURL(url).catch(err => 
      Alert.alert('Error', 'Unable to open maps application')
    );
  };

  const getDirections = (address) => {
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${encodeURIComponent(address)}`,
      android: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
    });
    
    Linking.openURL(url).catch(err => 
      Alert.alert('Error', 'Unable to open directions')
    );
  };

  const renderHospitalItem = (hospital, index) => {
    // Initialize animation value if it doesn't exist
    if (!cardAnimations[index]) {
      cardAnimations[index] = new Animated.Value(0);
    }
    
    return (
      <Animated.View 
        key={hospital.id} 
        style={[
          styles.hospitalCard,
          {
            opacity: cardAnimations[index],
            transform: [
              {
                translateY: cardAnimations[index].interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0]
                })
              }
            ]
          }
        ]}
      >
        <View style={styles.hospitalHeader}>
          <View style={styles.hospitalTitleContainer}>
            <Text style={styles.hospitalName}>{hospital.name}</Text>
            {hospital.emergency && (
              <View style={styles.emergencyBadge}>
                <Ionicons name="warning" size={12} color="#fff" />
                <Text style={styles.emergencyBadgeText}>24/7 ER</Text>
              </View>
            )}
          </View>
          <Text style={styles.waitTime}>{hospital.waitTime}</Text>
        </View>
        
        <View style={styles.hospitalDetails}>
          <Ionicons name="location" size={16} color={theme.colors.textSecondary} />
          <Text style={styles.hospitalAddress}>{hospital.address}</Text>
        </View>
        
        <View style={styles.hospitalDetails}>
          <Ionicons name="navigate" size={16} color={theme.colors.textSecondary} />
          <Text style={styles.hospitalDistance}>{hospital.distance} away</Text>
        </View>
        
        <View style={styles.hospitalActions}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => callEmergency(hospital.phone)}
          >
            <Ionicons name="call" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Call</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.colors.accent }]}
            onPress={() => getDirections(hospital.address)}
          >
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Directions</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emergency Assistance</Text>
        <TouchableOpacity onPress={getLocationAndFindHospitals} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </Animated.View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Emergency Call Button */}
        <Animated.View 
          style={[
            styles.emergencySection, 
            { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }
          ]}
        >
          <Text style={styles.sectionTitle}>Emergency Services</Text>
          <Text style={styles.sectionSubtitle}>
            Tap below to immediately connect to emergency services
          </Text>
          
          <Animated.View style={{ transform: [{ scale: emergencyBtnScale }] }}>
            <TouchableOpacity 
              style={[styles.emergencyButton, { backgroundColor: theme.colors.danger }]}
              onPress={() => callEmergency('911')}
              activeOpacity={0.8}
            >
              <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
              <View style={styles.emergencyButtonContent}>
                {isCalling ? (
                  <ActivityIndicator size="large" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="call" size={32} color="#fff" />
                    <Text style={styles.emergencyButtonText}>Call 911</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {/* Location Status */}
        <Animated.View 
          style={[
            styles.locationSection, 
            { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }
          ]}
        >
          <Text style={styles.sectionTitle}>Your Location</Text>
          
          {isLoading ? (
            <View style={styles.locationPlaceholder}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Detecting your location...</Text>
              <Text style={styles.loadingSubtext}>Using AI to find nearest hospitals</Text>
            </View>
          ) : errorMsg ? (
            <View style={styles.errorContainer}>
              <Ionicons name="location-off" size={40} color={theme.colors.textSecondary} />
              <Text style={styles.errorText}>{errorMsg}</Text>
              <TouchableOpacity 
                style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
                onPress={getLocationAndFindHospitals}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.locationInfo}>
              <Ionicons name="location" size={24} color={theme.colors.primary} />
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationText}>Location Detected</Text>
                <Text style={styles.coordinates}>
                  {location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Unknown'}
                </Text>
              </View>
            </View>
          )}
        </Animated.View>

        {/* AI Analysis */}
        {aiResponse ? (
          <Animated.View 
            style={[
              styles.aiSection, 
              { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }
            ]}
          >
            <View style={styles.sectionHeader}>
              <Ionicons name="sparkles" size={20} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>AI Analysis</Text>
            </View>
            <View style={styles.aiResponseContainer}>
              <Text style={styles.aiResponseText}>{aiResponse}</Text>
            </View>
          </Animated.View>
        ) : null}

        {/* Hospital List */}
        <Animated.View 
          style={[
            styles.hospitalsSection, 
            { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearby Medical Facilities</Text>
            <Text style={styles.hospitalCount}>{hospitals.length} found</Text>
          </View>
          
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Finding nearby hospitals...</Text>
            </View>
          ) : hospitals.length > 0 ? (
            hospitals.map((hospital, index) => renderHospitalItem(hospital, index))
          ) : (
            <View style={styles.noResultsContainer}>
              <Ionicons name="medkit-outline" size={60} color={theme.colors.textSecondary} />
              <Text style={styles.noResultsText}>No hospitals found nearby</Text>
              <TouchableOpacity 
                style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
                onPress={getLocationAndFindHospitals}
              >
                <Text style={styles.retryButtonText}>Search Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        {/* Emergency Instructions */}
        <Animated.View 
          style={[
            styles.infoSection, 
            { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }
          ]}
        >
          <Text style={styles.sectionTitle}>In Case of Emergency</Text>
          
          <View style={styles.tipCard}>
            <View style={[styles.tipIconContainer, { backgroundColor: theme.colors.warning + '20' }]}>
              <Ionicons name="warning" size={24} color={theme.colors.warning} />
            </View>
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Call 911 Immediately For:</Text>
              <View style={styles.tipList}>
                <Text style={styles.tipText}>• Chest pain or pressure</Text>
                <Text style={styles.tipText}>• Difficulty breathing</Text>
                <Text style={styles.tipText}>• Severe bleeding</Text>
                <Text style={styles.tipText}>• Sudden weakness or numbness</Text>
                <Text style={styles.tipText}>• Severe allergic reactions</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.tipCard}>
            <View style={[styles.tipIconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
              <Ionicons name="information-circle" size={24} color={theme.colors.primary} />
            </View>
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>When You Call:</Text>
              <View style={styles.tipList}>
                <Text style={styles.tipText}>• Stay calm and speak clearly</Text>
                <Text style={styles.tipText}>• Provide your exact location</Text>
                <Text style={styles.tipText}>• Describe the emergency</Text>
                <Text style={styles.tipText}>• Follow all instructions</Text>
                <Text style={styles.tipText}>• Don't hang up until told to do so</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Emergency Contacts */}
        <Animated.View 
          style={[
            styles.contactsSection, 
            { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }
          ]}
        >
          <Text style={styles.sectionTitle}>Emergency Contacts</Text>
          <View style={styles.contactsGrid}>
            <TouchableOpacity 
              style={[styles.contactButton, { backgroundColor: theme.colors.card }]}
              onPress={() => callEmergency('911')}
            >
              <View style={[styles.contactIcon, { backgroundColor: theme.colors.danger + '20' }]}>
                <Ionicons name="alert-circle" size={24} color={theme.colors.danger} />
              </View>
              <Text style={styles.contactText}>Emergency</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.contactButton, { backgroundColor: theme.colors.card }]}
              onPress={() => callEmergency('1-800-222-1222')}
            >
              <View style={[styles.contactIcon, { backgroundColor: theme.colors.warning + '20' }]}>
                <Ionicons name="flask" size={24} color={theme.colors.warning} />
              </View>
              <Text style={styles.contactText}>Poison Control</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.contactButton, { backgroundColor: theme.colors.card }]}
              onPress={() => callEmergency('1-800-273-8255')}
            >
              <View style={[styles.contactIcon, { backgroundColor: theme.colors.accent + '20' }]}>
                <Ionicons name="heart" size={24} color={theme.colors.accent} />
              </View>
              <Text style={styles.contactText}>Suicide Prevention</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.contactButton, { backgroundColor: theme.colors.card }]}
              onPress={() => Linking.openURL('tel:411')}
            >
              <View style={[styles.contactIcon, { backgroundColor: theme.colors.textSecondary + '20' }]}>
                <Ionicons name="information" size={24} color={theme.colors.textSecondary} />
              </View>
              <Text style={styles.contactText}>Directory Assistance</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
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
  refreshButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  scrollView: {
    flex: 1,
  },
  emergencySection: {
    padding: 20,
    backgroundColor: theme.colors.card,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 20,
  },
  emergencyButton: {
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  pulseRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  emergencyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emergencyButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 10,
  },
  locationSection: {
    padding: 20,
    backgroundColor: theme.colors.card,
    marginBottom: 10,
  },
  locationPlaceholder: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 15,
    marginTop: 10,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '600',
  },
  loadingSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 5,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 15,
    padding: 15,
    marginTop: 10,
  },
  locationTextContainer: {
    marginLeft: 10,
  },
  locationText: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '600',
  },
  coordinates: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: theme.colors.background,
    borderRadius: 15,
    marginTop: 10,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 15,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  aiSection: {
    padding: 20,
    backgroundColor: theme.colors.card,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  aiResponseContainer: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 15,
  },
  aiResponseText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  hospitalsSection: {
    padding: 20,
    backgroundColor: theme.colors.card,
    marginBottom: 10,
  },
  hospitalCount: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  hospitalCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  hospitalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  hospitalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  hospitalName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginRight: 10,
  },
  emergencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.danger,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  emergencyBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  waitTime: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  hospitalDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  hospitalAddress: {
    fontSize: 14,
    color: theme.colors.text,
    marginLeft: 8,
    flex: 1,
  },
  hospitalDistance: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginLeft: 8,
  },
  hospitalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 15,
    width: '48%',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 5,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    marginTop: 10,
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 15,
  },
  infoSection: {
    padding: 20,
    backgroundColor: theme.colors.card,
    marginBottom: 10,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tipIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  tipList: {
    marginLeft: 5,
  },
  tipText: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 4,
  },
  contactsSection: {
    padding: 20,
    backgroundColor: theme.colors.card,
    marginBottom: 30,
  },
  contactsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  contactButton: {
    width: '48%',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  contactIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  contactText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
  },
});

export default EmergencyScreen;