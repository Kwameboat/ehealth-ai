import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
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
import { APP_TAGLINE } from '../constants/branding';
import { MED_THEME } from '../constants/appTheme';
import { useAuth } from '../Context/AuthContext';

const AuthScreen = ({ navigation }) => {
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
      navigation.replace('MedicalHome');
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#0f172a', '#1e293b', '#0b1220']} style={StyleSheet.absoluteFill} />
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
              placeholder="Full name (optional)"
              placeholderTextColor={MED_THEME.textMuted}
              value={fullName}
              onChangeText={setFullName}
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={MED_THEME.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password (min 6 characters)"
            placeholderTextColor={MED_THEME.textMuted}
            secureTextEntry
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: MED_THEME.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 28, maxWidth: 420, alignSelf: 'center', width: '100%' },
  title: { fontSize: 32, fontWeight: '800', color: '#fff', marginBottom: 8 },
  subtitle: { color: MED_THEME.textMuted, marginBottom: 28, lineHeight: 22 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    marginBottom: 12,
    fontSize: 16,
  },
  error: { color: '#f87171', marginBottom: 12 },
  primaryBtn: {
    backgroundColor: MED_THEME.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  switch: { color: MED_THEME.primary, textAlign: 'center', marginTop: 20 },
  hint: { color: MED_THEME.textMuted, fontSize: 12, textAlign: 'center', marginTop: 24, lineHeight: 18 },
  disclaimer: {
    color: MED_THEME.textDim,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
});

export default AuthScreen;
