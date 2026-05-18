import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppLogo from '../Components/AppLogo';
import { APP_TAGLINE } from '../constants/branding';
import { MED_THEME } from '../constants/appTheme';
import { useAuth } from '../Context/AuthContext';
import {
  fetchPointPackages,
  getPendingPaymentReference,
  initializePayment,
  verifyPayment,
} from '../services/paymentsApi';

function formatMoney(amountMinor, currency = 'GHS', amountDisplay) {
  if (amountDisplay) return amountDisplay;
  const amount = amountMinor / 100;
  if (currency === 'GHS') return `GHC ${amount.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  if (currency === 'NGN') return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;
  return `${currency} ${amount.toFixed(2)}`;
}

const BuyPointsScreen = ({ navigation }) => {
  const { user, updatePointsBalance, refreshUser } = useAuth();
  const [packages, setPackages] = useState([]);
  const [paystackEnabled, setPaystackEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingRef, setPendingRef] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPointPackages();
      setPackages(data.packages || []);
      setPaystackEnabled(!!data.paystackEnabled);
      setPendingRef(await getPendingPaymentReference());
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleBuy = async (packageId) => {
    setBusy(true);
    try {
      const { authorizationUrl, reference, points } = await initializePayment(packageId);
      setPendingRef(reference);
      const opened = await Linking.openURL(authorizationUrl);
      if (!opened && Platform.OS === 'web') {
        window.open(authorizationUrl, '_blank');
      }
      Alert.alert(
        'Complete payment',
        `Pay with Paystack to receive ${points} points. When done, tap "Confirm payment" below.`,
        [{ text: 'OK' }]
      );
    } catch (e) {
      Alert.alert('Payment', e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setBusy(true);
    try {
      const result = await verifyPayment(pendingRef);
      updatePointsBalance(result.balance);
      await refreshUser();
      setPendingRef(null);
      Alert.alert('Success', `+${result.pointsAdded} points added. Balance: ${result.balance}`, [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Verification', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#0a1628', '#0B1220', '#0a0e17']} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <AppLogo size="small" showTagline />
        <Text style={styles.disclaimer}>{APP_TAGLINE}</Text>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Your balance</Text>
          <Text style={styles.balanceValue}>{user?.pointsBalance ?? 0} points</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={MED_THEME.primary} style={{ marginTop: 40 }} />
        ) : !paystackEnabled ? (
          <Text style={styles.hint}>Paystack is not configured on the server. Contact your administrator.</Text>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Buy more points</Text>
            {packages.map((pkg) => (
              <TouchableOpacity
                key={pkg.id}
                style={styles.packageCard}
                onPress={() => handleBuy(pkg.id)}
                disabled={busy}
              >
                <View>
                  <Text style={styles.pkgName}>{pkg.name}</Text>
                  <Text style={styles.pkgDesc}>{pkg.description}</Text>
                  <Text style={styles.pkgPoints}>{pkg.points} points</Text>
                </View>
                <Text style={styles.pkgPrice}>{formatMoney(pkg.amountMinor, pkg.currency, pkg.amountDisplay)}</Text>
              </TouchableOpacity>
            ))}

            {pendingRef && (
              <View style={styles.pendingBox}>
                <Text style={styles.pendingTitle}>Pending payment</Text>
                <Text style={styles.pendingRef}>Ref: {pendingRef.slice(0, 20)}…</Text>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleVerify} disabled={busy}>
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Confirm payment</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: MED_THEME.bg },
  scroll: { padding: 24, paddingBottom: 48 },
  back: { marginBottom: 16 },
  backText: { color: MED_THEME.primary, fontWeight: '600' },
  disclaimer: {
    textAlign: 'center',
    color: MED_THEME.textMuted,
    fontSize: 11,
    marginTop: 4,
    marginBottom: 24,
  },
  balanceCard: {
    backgroundColor: MED_THEME.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: MED_THEME.cardBorder,
    marginBottom: 28,
    alignItems: 'center',
  },
  balanceLabel: { color: MED_THEME.textMuted, fontSize: 13 },
  balanceValue: { color: '#00C9A7', fontSize: 32, fontWeight: '800', marginTop: 4 },
  sectionTitle: { color: MED_THEME.text, fontSize: 18, fontWeight: '700', marginBottom: 14 },
  packageCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: MED_THEME.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: MED_THEME.cardBorder,
  },
  pkgName: { color: MED_THEME.text, fontWeight: '700', fontSize: 16 },
  pkgDesc: { color: MED_THEME.textMuted, fontSize: 12, marginTop: 4, maxWidth: 220 },
  pkgPoints: { color: '#00C9A7', fontWeight: '700', marginTop: 8, fontSize: 14 },
  pkgPrice: { color: '#0052D4', fontWeight: '800', fontSize: 18 },
  pendingBox: {
    marginTop: 24,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 201, 167, 0.35)',
    backgroundColor: 'rgba(0, 201, 167, 0.08)',
  },
  pendingTitle: { color: MED_THEME.text, fontWeight: '700', marginBottom: 6 },
  pendingRef: { color: MED_THEME.textMuted, fontSize: 12, marginBottom: 14 },
  confirmBtn: {
    backgroundColor: '#00C9A7',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#0a0e17', fontWeight: '800' },
  hint: { color: MED_THEME.textMuted, textAlign: 'center', marginTop: 24, lineHeight: 22 },
});

export default BuyPointsScreen;
