import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

// Import all your screens
import OnboardingScreen from '../onboardingscreens/OnboardingScreen';
import AllergiesScreen from '../Screen/AllergiesScreen';
import BreathingProblems from '../Screen/BreathingProblems';
import ChestPainScreen from '../Screen/ChestPainScreen';
import CoughColdScreen from '../Screen/CoughColdScreen';
import DentalPainScreen from '../Screen/DentalPainScreen';
import DiarrheaConstipationScreen from '../Screen/DiarrheaConstipationScreen';
import EmergencyScreen from '../Screen/EmergencyScreen';
import EyeProblems from '../Screen/EyeProblems';
import FeverChillsScreen from '../Screen/FeverChillsScreen';
import GeneralFatigueScreen from '../Screen/GeneralFatigueScreen';
import HeadacheMigraineScreen from '../Screen/HeadacheMigraineScreen';
import JointMusclePainScreen from '../Screen/JointMusclePainScreen';
import AccountScreen from '../Screen/AccountScreen';
import AuthScreen from '../Screen/AuthScreen';
import BuyPointsScreen from '../Screen/BuyPointsScreen';
import MedicalHomeScreen from '../Screen/MedicalHomeScreen';
import { useAuth } from '../Context/AuthContext';
import MedicalChatScreen from '../Screen/MedicalChatScreen';
import MedicalVoiceAgentScreen from '../Screen/MedicalVoiceAgentScreen';
import LabResultsScreen from '../Screen/LabResultsScreen';
import MedicineRecognitionScreen from '../Screen/MedicineRecognitionScreen';
import MedicalHealth from '../Screen/MentalHealthScreen';
import SkinProblems from '../Screen/SkinIssuesScreen';
import StomachPain from '../Screen/StomachPain';
import VomitingNauseaScreen from '../Screen/VomitingNauseaScreen';



const Stack = createNativeStackNavigator();

const StackNavigation = () => {
  const [initialRoute, setInitialRoute] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { loading: authLoading, backendRequired, isAuthenticated } = useAuth();

  useEffect(() => {
    const resolveInitialRoute = async () => {
      try {
        const hasSeen = await AsyncStorage.getItem('hasSeenOnboarding');
        if (hasSeen !== 'true') {
          setInitialRoute('Onboarding');
        } else if (backendRequired && !isAuthenticated) {
          setInitialRoute('Auth');
        } else {
          setInitialRoute('MedicalHome');
        }
      } catch (e) {
        console.error('Error reading onboarding status:', e);
        setInitialRoute('MedicalHome');
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) {
      resolveInitialRoute();
    }
  }, [authLoading, backendRequired, isAuthenticated]);

  if (isLoading || authLoading || !initialRoute) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      {/* Onboarding Screen - Only shown if hasn't been seen */}
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="BuyPoints" component={BuyPointsScreen} />
      {/* Main App Screens */}
      <Stack.Screen name="Allergies" component={AllergiesScreen} />
      <Stack.Screen name="HeadacheMigraine" component={HeadacheMigraineScreen} />
      <Stack.Screen name="MedicalHome" component={MedicalHomeScreen} />
      <Stack.Screen name="ChestPain" component={ChestPainScreen} />
      <Stack.Screen name="DentalPain" component={DentalPainScreen} />
      <Stack.Screen name="EyeProblems" component={EyeProblems} />
      <Stack.Screen name="SkinProblems" component={SkinProblems} />
      <Stack.Screen name="BreathingProblems" component={BreathingProblems} />
      <Stack.Screen name="FeverChills" component={FeverChillsScreen} />
      <Stack.Screen name="GeneralFatigue" component={GeneralFatigueScreen} />
      <Stack.Screen name="JointMusclePain" component={JointMusclePainScreen} />
      <Stack.Screen name="StomachProblems" component={StomachPain} />
      <Stack.Screen name="VomitingNausea" component={VomitingNauseaScreen} />
      <Stack.Screen name="DiarrheaConstipation" component={DiarrheaConstipationScreen} />
      <Stack.Screen name="CoughCold" component={CoughColdScreen} />
      <Stack.Screen name="MedicalHealth" component={MedicalHealth} />
      <Stack.Screen name="Emergency" component={EmergencyScreen} />
      <Stack.Screen name="MedicineRecognition" component={MedicineRecognitionScreen} />
      <Stack.Screen name="LabResults" component={LabResultsScreen} />
      <Stack.Screen name="MedicalVoiceAgent" component={MedicalVoiceAgentScreen} />
      <Stack.Screen name="MedicalChat" component={MedicalChatScreen} />

     
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

export default StackNavigation;