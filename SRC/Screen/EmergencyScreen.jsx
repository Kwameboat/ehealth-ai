import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import ScreenHeaderBar from '../Components/ScreenHeaderBar';
import { useTheme } from '../Context/ThemeContext';
import {
  fetchNearbyHospitals,
  getCurrentCoordinates,
  GHANA_EMERGENCY_NUMBERS,
} from '../services/nearbyHospitals';
import { openDirections, openHospitalMapSearch, openMapsSearchUrl } from '../utils/mapsLinks';

const { width, height } = Dimensions.get('window');

const EmergencyScreen = ({ navigation }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalling, setIsCalling] = useState(false);
  const [mapsSearchUrl, setMapsSearchUrl] = useState(null);

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
    setIsLoading(true);
    setErrorMsg(null);
    setHospitals([]);

    try {
      const coords = await getCurrentCoordinates();
      setLocation(coords);

      const data = await fetchNearbyHospitals(coords.latitude, coords.longitude);
      setHospitals(data.hospitals || []);
      setMapsSearchUrl(data.mapsSearchUrl || null);
    } catch (error) {
      console.error('Emergency lookup error:', error);
      setErrorMsg(error.message || 'Failed to get your location or find hospitals');
      if (error.mapsSearchUrl) setMapsSearchUrl(error.mapsSearchUrl);
    } finally {
      setIsLoading(false);
    }
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
          text: 'Call',
          onPress: () => {
            const dial = String(number).replace(/[^\d+]/g, '');
            Linking.openURL(`tel:${dial}`).catch(() =>
              Alert.alert('Cannot call', 'Use your phone dialer to call ' + number)
            );
            setTimeout(() => setIsCalling(false), 2000);
          },
        },
      ]
    );
  };

  const getDirections = (hospital) => {
    openDirections({
      latitude: hospital.latitude,
      longitude: hospital.longitude,
      address: hospital.address,
      name: hospital.name,
    }).catch(() => Alert.alert('Error', 'Unable to open maps'));
  };

  const callHospital = (phone) => {
    if (!phone) {
      Alert.alert('No phone number', 'Use Directions to navigate to this facility.');
      return;
    }
    callEmergency(phone);
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
          {hospital.waitTime ? <Text style={styles.waitTime}>{hospital.waitTime}</Text> : null}
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
            onPress={() => callHospital(hospital.phone)}
          >
            <Ionicons name="call" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Call</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.colors.accent }]}
            onPress={() => getDirections(hospital)}
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
      <ScreenHeaderBar
        title="Emergency Assistance"
        rightAdornment={
          <TouchableOpacity
            onPress={getLocationAndFindHospitals}
            style={styles.refreshHeaderBtn}
            accessibilityLabel="Refresh hospitals"
          >
            <Ionicons name="refresh" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
        }
      />

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
            Ghana emergency lines — tap to call. Allow location access to find real hospitals near you.
          </Text>

          <View style={styles.emergencyNumberRow}>
            {GHANA_EMERGENCY_NUMBERS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.emergencyQuickBtn, { backgroundColor: theme.colors.danger }]}
                onPress={() => callEmergency(item.number)}
                activeOpacity={0.85}
              >
                <Ionicons name="call" size={22} color="#fff" />
                <Text style={styles.emergencyQuickLabel}>{item.label}</Text>
                <Text style={styles.emergencyQuickNumber}>{item.number}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
              <Text style={styles.loadingSubtext}>Searching OpenStreetMap for hospitals near you</Text>
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
              {(mapsSearchUrl || location) && (
                <TouchableOpacity
                  style={[styles.retryButton, styles.mapsFallbackBtn, { borderColor: theme.colors.primary }]}
                  onPress={() =>
                    location
                      ? openHospitalMapSearch(location.latitude, location.longitude).catch(() =>
                          mapsSearchUrl && openMapsSearchUrl(mapsSearchUrl)
                        )
                      : mapsSearchUrl && openMapsSearchUrl(mapsSearchUrl)
                  }
                >
                  <Text style={[styles.retryButtonText, { color: theme.colors.primary }]}>
                    Open in Google Maps
                  </Text>
                </TouchableOpacity>
              )}
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
              {location && (
                <TouchableOpacity
                  style={[styles.retryButton, styles.mapsFallbackBtn, { borderColor: theme.colors.primary }]}
                  onPress={() => openHospitalMapSearch(location.latitude, location.longitude)}
                >
                  <Text style={[styles.retryButtonText, { color: theme.colors.primary }]}>
                    Open hospitals in Google Maps
                  </Text>
                </TouchableOpacity>
              )}
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
              <Text style={styles.tipTitle}>Call 112 or 193 immediately for:</Text>
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
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.contactsGrid}>
            {GHANA_EMERGENCY_NUMBERS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.contactButton, { backgroundColor: theme.colors.card }]}
                onPress={() => callEmergency(item.number)}
              >
                <View style={[styles.contactIcon, { backgroundColor: theme.colors.danger + '20' }]}>
                  <Ionicons name="call" size={24} color={theme.colors.danger} />
                </View>
                <Text style={styles.contactText}>{item.label}</Text>
                <Text style={styles.contactSubtext}>{item.number}</Text>
              </TouchableOpacity>
            ))}
            {location ? (
              <TouchableOpacity
                style={[styles.contactButton, { backgroundColor: theme.colors.card }]}
                onPress={() => openHospitalMapSearch(location.latitude, location.longitude)}
              >
                <View style={[styles.contactIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                  <Ionicons name="map" size={24} color={theme.colors.primary} />
                </View>
                <Text style={styles.contactText}>Map search</Text>
                <Text style={styles.contactSubtext}>Google Maps</Text>
              </TouchableOpacity>
            ) : null}
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
  refreshHeaderBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyNumberRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  emergencyQuickBtn: {
    flex: 1,
    minWidth: '30%',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  emergencyQuickLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  emergencyQuickNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  mapsFallbackBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    marginTop: 10,
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
  contactSubtext: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
});

export default EmergencyScreen;