import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppLogo from '../Components/AppLogo';
import PasswordInput from '../Components/PasswordInput';
import ThemeToggleButton from '../Components/ThemeToggleButton';
import { APP_TAGLINE } from '../constants/branding';
import { useNavigation } from '@react-navigation/native';
import { useMedTheme } from '../hooks/useMedTheme';
import { useAuth } from '../Context/AuthContext';
import { resetToRoute } from '../utils/navigationHelpers';

const AuthScreen = () => {
  const navigation = useNavigation();
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, fullName.trim() || undefined);
      }
      resetToRoute(navigation, 'MedicalHome');
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[med.bg, med.bgGradientEnd, med.bg]} style={StyleSheet.absoluteFill} />
      <View style={styles.themeRow}>
        <ThemeToggleButton compact />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <AppLogo size="medium" showTagline />
          <Text style={styles.subtitle}>
            {mode === 'login' ? 'Sign in to use AI health features' : 'Create an account — get welcome points'}
          </Text>
          <Text style={styles.disclaimer}>{APP_TAGLINE}</Text>

          {mode === 'register' && (
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor={med.textMuted}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={med.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <PasswordInput
            med={med}
            placeholder="Password (min 6 characters)"
            placeholderTextColor={med.textMuted}
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.primaryBtn} onPress={submit} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
            <Text style={styles.switch}>
              {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign in'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.hint}>Points are deducted per feature. Buy more points anytime via Paystack.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (med) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: med.bg },
  flex: { flex: 1 },
  themeRow: { position: 'absolute', top: 12, right: 16, zIndex: 10 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 28, maxWidth: 420, alignSelf: 'center', width: '100%' },
  subtitle: { color: med.textMuted, marginBottom: 28, lineHeight: 22 },
  input: {
    backgroundColor: med.inputBg,
    borderWidth: 1,
    borderColor: med.cardBorder,
    borderRadius: 12,
    padding: 14,
    color: med.text,
    marginBottom: 12,
    fontSize: 16,
  },
  error: { color: '#f87171', marginBottom: 12 },
  primaryBtn: {
    backgroundColor: med.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  switch: { color: med.primary, textAlign: 'center', marginTop: 20 },
  hint: { color: med.textMuted, fontSize: 12, textAlign: 'center', marginTop: 24, lineHeight: 18 },
  disclaimer: {
    color: med.textDim,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
});

export default AuthScreen;
