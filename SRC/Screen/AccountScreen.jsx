import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import PasswordInput from '../Components/PasswordInput';
import ThemeToggleButton from '../Components/ThemeToggleButton';
import { useAuth } from '../Context/AuthContext';
import { useMedTheme } from '../hooks/useMedTheme';
import { resetToRoute } from '../utils/navigationHelpers';

export default function AccountScreen() {
  const navigation = useNavigation();
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);
  const { user, pointsEnabled, logout, updateProfile, deleteAccount, refreshUser } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const saveProfile = async () => {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        email: email.trim(),
      };
      if (newPassword) {
        payload.password = newPassword;
        payload.currentPassword = currentPassword;
      }
      await updateProfile(payload);
      setCurrentPassword('');
      setNewPassword('');
      setMessage('Profile updated successfully.');
    } catch (e) {
      setError(e.message || 'Could not update profile');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    resetToRoute(navigation, 'Auth');
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete account',
      'This permanently removes your account and points history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setError('');
            setBusy(true);
            try {
              await deleteAccount(deletePassword);
              resetToRoute(navigation, 'Auth');
            } catch (e) {
              setError(e.message || 'Could not delete account');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={26} color={med.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Account</Text>
        <ThemeToggleButton compact />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {pointsEnabled && (
            <View style={styles.pointsCard}>
              <Ionicons name="star" size={20} color={med.accent} />
              <Text style={styles.pointsText}>{user?.pointsBalance ?? 0} points balance</Text>
              <TouchableOpacity onPress={() => navigation.navigate('BuyPoints')}>
                <Text style={styles.link}>Buy points</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.sectionLabel}>Profile</Text>
          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor={med.textMuted}
            value={fullName}
            onChangeText={setFullName}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={med.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.sectionLabel}>Change password (optional)</Text>
          <PasswordInput
            med={med}
            placeholder="Current password"
            placeholderTextColor={med.textMuted}
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
          <PasswordInput
            med={med}
            placeholder="New password (min 6 characters)"
            placeholderTextColor={med.textMuted}
            value={newPassword}
            onChangeText={setNewPassword}
          />

          {message ? <Text style={styles.success}>{message}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.primaryBtn} onPress={saveProfile} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Save changes</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.outlineBtn} onPress={handleSignOut} disabled={busy}>
            <Ionicons name="log-out-outline" size={20} color={med.primary} />
            <Text style={styles.outlineBtnText}>Sign out</Text>
          </TouchableOpacity>

          <View style={styles.dangerZone}>
            <Text style={styles.dangerTitle}>Delete account</Text>
            <Text style={styles.dangerSub}>
              Enter your password to permanently delete your account.
            </Text>
            <PasswordInput
              med={med}
              placeholder="Password to confirm deletion"
              placeholderTextColor={med.textMuted}
              value={deletePassword}
              onChangeText={setDeletePassword}
            />
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={confirmDelete}
              disabled={busy || !deletePassword}
            >
              <Text style={styles.dangerBtnText}>Delete my account</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => refreshUser()} style={styles.refreshLink}>
            <Text style={styles.link}>Refresh account data</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (med) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: med.bg },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: med.cardBorder,
    },
    headerBtn: { width: 40 },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: med.text,
      textAlign: 'center',
    },
    scroll: { padding: 20, paddingBottom: 40 },
    pointsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: med.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: med.cardBorder,
    },
    pointsText: { flex: 1, color: med.text, fontWeight: '600' },
    link: { color: med.primary, fontWeight: '600', fontSize: 14 },
    sectionLabel: {
      color: med.textMuted,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.8,
      marginBottom: 10,
      marginTop: 8,
    },
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
    primaryBtn: {
      backgroundColor: med.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    outlineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 14,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: med.cardBorder,
    },
    outlineBtnText: { color: med.primary, fontWeight: '600', fontSize: 16 },
    dangerZone: {
      marginTop: 32,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.35)',
      backgroundColor: 'rgba(239, 68, 68, 0.08)',
    },
    dangerTitle: { color: med.danger, fontWeight: '700', fontSize: 16, marginBottom: 6 },
    dangerSub: { color: med.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 12 },
    dangerBtn: {
      backgroundColor: med.danger,
      borderRadius: 10,
      padding: 14,
      alignItems: 'center',
    },
    dangerBtnText: { color: '#fff', fontWeight: '700' },
    success: { color: med.success, marginBottom: 8 },
    error: { color: med.danger, marginBottom: 8 },
    refreshLink: { marginTop: 20, alignItems: 'center' },
  });
