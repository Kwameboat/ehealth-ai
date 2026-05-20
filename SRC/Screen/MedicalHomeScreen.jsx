import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useState } from 'react';
import ThemeToggleButton from '../Components/ThemeToggleButton';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppBottomNav from '../Components/AppBottomNav';
import AppLogo from '../Components/AppLogo';
import { AI_ASSISTANT_NAME, APP_TAGLINE, getUserFirstName } from '../constants/branding';
import ChatInputBar from '../Components/ChatInputBar';
import ResponsiveContainer from '../Components/ResponsiveContainer';
import SymptomMenuModal from '../Components/SymptomMenuModal';
import { useMedTheme } from '../hooks/useMedTheme';
import { QUICK_ACTIONS, SYMPTOM_CATEGORIES } from '../constants/symptomCategories';
import { useAuth } from '../Context/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import { useChatVoiceInput } from '../hooks/useChatVoiceInput';
import { stashAttachments } from '../services/attachmentBridge';
import { pickChatAttachments } from '../services/chatAttachmentPicker';

const MedicalHomeScreen = ({ navigation }) => {
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);
  const r = useResponsive();
  const { user, backendRequired, pointsEnabled, isAuthenticated } = useAuth();
  const firstName = getUserFirstName(user);
  const [greeting, setGreeting] = useState('GOOD MORNING');
  const [homeInput, setHomeInput] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('MedicalHealth');
  const [chatFocusMode, setChatFocusMode] = useState(false);

  const voice = useChatVoiceInput({
    onTranscript: (text) => {
      setHomeInput(text);
      if (text?.trim()) setChatFocusMode(true);
    },
  });

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('GOOD MORNING');
    else if (hour < 18) setGreeting('GOOD AFTERNOON');
    else setGreeting('GOOD EVENING');
    ImagePicker.requestCameraPermissionsAsync();
    ImagePicker.requestMediaLibraryPermissionsAsync();
  }, []);

  const goToChat = (initialMessage = '', attachments = null) => {
    const list = Array.isArray(attachments) ? attachments : attachments ? [attachments] : [];
    if (list.length) stashAttachments(list);
    navigation.navigate('MedicalChat', {
      initialMessage: initialMessage.trim() || undefined,
      hasAttachment: list.length > 0,
    });
  };

  const handleHomeFilePicked = (attachments) => {
    setChatFocusMode(true);
    goToChat(homeInput, attachments);
    setHomeInput('');
  };

  const handleHomeAttach = async () => {
    try {
      const picked = await pickChatAttachments();
      if (picked?.length) handleHomeFilePicked(picked);
    } catch (e) {
      console.error('Attach error:', e);
    }
  };

  const handleHomeSend = () => {
    if (voice.isListening) voice.stop();
    if (!homeInput.trim()) {
      goToChat();
      return;
    }
    setChatFocusMode(true);
    goToChat(homeInput);
    setHomeInput('');
  };

  const handleQuickAction = (action) => {
    if (action.screen) {
      navigation.navigate(action.screen);
      return;
    }
    if (action.chatPrompt) {
      goToChat(action.chatPrompt);
    }
  };

  const Sidebar = () => (
    <View style={styles.sidebar}>
      <AppLogo size="small" showTagline={false} centered={false} />
      <Text style={styles.taglineSidebar}>{APP_TAGLINE}</Text>

      <TouchableOpacity
        style={styles.profileCard}
        onPress={() => backendRequired && isAuthenticated && navigation.navigate('Account')}
        disabled={!backendRequired || !isAuthenticated}
        activeOpacity={0.85}
      >
        <Text style={styles.profileTitle}>
          {user?.fullName?.trim() || 'My Account'}
        </Text>
        <Text style={styles.profileSub}>
          {user?.email || 'Tap to manage profile & sign out'}
        </Text>
        {backendRequired && isAuthenticated ? (
          <Text style={styles.profileLink}>Account settings →</Text>
        ) : null}
      </TouchableOpacity>

      <Text style={styles.sidebarSection}>Symptom Categories</Text>
      <ScrollView style={styles.sidebarList} showsVerticalScrollIndicator={false}>
        {SYMPTOM_CATEGORIES.map((cat) => {
          const active = activeCategory === cat.screen;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.sidebarItem, active && styles.sidebarItemActive]}
              onPress={() => {
                setActiveCategory(cat.screen);
                navigation.navigate(cat.screen);
              }}
            >
              <MaterialCommunityIcons
                name={cat.icon}
                size={20}
                color={active ? '#fff' : med.textMuted}
              />
              <Text style={[styles.sidebarItemText, active && styles.sidebarItemTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.sidebarSection}>Recent Chats</Text>
      {[
        'Chest pain after exercise…',
        'Knee joint swelling report',
        'Sleep tracking analysis',
      ].map((label) => (
        <TouchableOpacity key={label} style={styles.recentChat} onPress={() => goToChat(label)}>
          <Text style={styles.recentChatText} numberOfLines={1}>
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const QuickCard = ({ action, cardWidth }) => (
    <TouchableOpacity
      style={[styles.quickCard, { width: cardWidth }, r.useQuickGrid && styles.quickCardGrid]}
      onPress={() => handleQuickAction(action)}
      activeOpacity={0.88}
    >
      <View style={[styles.quickIcon, { backgroundColor: `${action.color}22` }]}>
        <MaterialCommunityIcons name={action.icon} size={26} color={action.color} />
      </View>
      <Text style={styles.quickTitle}>{action.title}</Text>
      <Text style={styles.quickDesc} numberOfLines={2}>
        {action.desc}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={[med.bg, med.bgGradientEnd, med.bg]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.layout}>
          {r.showSidebar && <Sidebar />}

          <View style={styles.main}>
            <View style={[styles.topBar, { paddingHorizontal: r.horizontalPadding }]}>
              <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuOpen(true)}>
                <Feather name="menu" size={24} color={med.text} />
              </TouchableOpacity>
              <Text
                style={[styles.topTitle, r.isSmallPhone && styles.topTitleSmall]}
                numberOfLines={1}
              >
                AI Medical Assistant
              </Text>
              <View style={styles.topRight}>
                {backendRequired && user && pointsEnabled && (
                  <TouchableOpacity
                    style={styles.pointsPill}
                    onPress={() => navigation.navigate('BuyPoints')}
                  >
                    <MaterialCommunityIcons name="star-circle" size={16} color="#00C9A7" />
                    <Text style={styles.pointsText}>{user.pointsBalance ?? 0} pts</Text>
                  </TouchableOpacity>
                )}
                {r.showOnlinePill && (
                  <View style={[styles.onlinePill, r.isTablet && styles.onlinePillTablet]}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.onlineText} numberOfLines={1}>
                      {AI_ASSISTANT_NAME.toUpperCase()} ONLINE
                    </Text>
                  </View>
                )}
                <ThemeToggleButton compact />
                <TouchableOpacity
                  style={styles.avatar}
                  onPress={() => backendRequired && isAuthenticated && navigation.navigate('Account')}
                  disabled={!backendRequired || !isAuthenticated}
                  accessibilityLabel="My account"
                >
                  <Ionicons name="person" size={18} color={med.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <ResponsiveContainer maxWidth={r.contentMaxWidth} style={styles.contentArea}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  styles.scrollContent,
                  chatFocusMode && styles.scrollContentCompact,
                  { paddingHorizontal: r.horizontalPadding },
                ]}
                keyboardShouldPersistTaps="handled"
              >
                {chatFocusMode && r.showBottomNav ? (
                  <View style={styles.focusChatHeader}>
                    <Text style={styles.focusChatTitle}>Health Chat</Text>
                    <TouchableOpacity
                      onPress={() => setChatFocusMode(false)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.showSymptomsLink}>Show symptoms</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Text style={styles.greetingLabel}>
                      {firstName ? `${greeting}, ${firstName.toUpperCase()}` : greeting}
                    </Text>
                    <Text
                      style={[
                        styles.heroTitle,
                        { fontSize: r.heroTitleSize, lineHeight: r.heroLineHeight },
                      ]}
                    >
                      {firstName
                        ? `How can ${AI_ASSISTANT_NAME} help you today?`
                        : `How can ${AI_ASSISTANT_NAME} help with your health today?`}
                    </Text>
                    <Text style={[styles.heroSub, { fontSize: r.heroSubSize }]}>
                      Describe your symptoms or ask a medical question. {AI_ASSISTANT_NAME} is here
                      to analyze and guide your health journey.
                    </Text>

                    {r.useQuickGrid ? (
                      <View style={styles.quickGrid}>
                        {QUICK_ACTIONS.map((action) => (
                          <QuickCard
                            key={action.id}
                            action={action}
                            cardWidth={r.quickCardWidth}
                          />
                        ))}
                      </View>
                    ) : (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.quickRow}
                      >
                        {QUICK_ACTIONS.map((action) => (
                          <QuickCard
                            key={action.id}
                            action={action}
                            cardWidth={r.quickCardWidth}
                          />
                        ))}
                      </ScrollView>
                    )}

                    {r.showBottomNav && (
                      <View style={styles.mobileTools}>
                        <TouchableOpacity
                          style={styles.toolBtn}
                          onPress={() => navigation.navigate('Emergency')}
                        >
                          <MaterialCommunityIcons
                            name="ambulance"
                            size={20}
                            color={med.danger}
                          />
                          <Text style={styles.toolBtnText}>Emergency</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.toolBtn}
                          onPress={() => setMenuOpen(true)}
                        >
                          <MaterialCommunityIcons
                            name="view-grid"
                            size={20}
                            color={med.primary}
                          />
                          <Text style={styles.toolBtnText}>All Symptoms</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}
              </ScrollView>

              <View style={{ paddingHorizontal: r.horizontalPadding }}>
                <ChatInputBar
                  value={homeInput}
                  onChangeText={setHomeInput}
                  onSend={handleHomeSend}
                  onAttach={handleHomeAttach}
                  onMic={() => voice.toggle()}
                  isListening={voice.isListening}
                />
              </View>

              {r.showBottomNav && (
                <AppBottomNav
                  active="chat"
                  onChat={() => goToChat()}
                  onVoice={() => navigation.navigate('MedicalVoiceAgent')}
                  onRecords={() => setMenuOpen(true)}
                />
              )}
            </ResponsiveContainer>
          </View>
        </View>

        <SymptomMenuModal
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          categories={SYMPTOM_CATEGORIES}
          onSelect={(screen) => navigation.navigate(screen)}
        />
      </SafeAreaView>
    </View>
  );
};

const createStyles = (med) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: med.bg },
  safe: { flex: 1 },
  layout: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: med.sidebarWidth,
    backgroundColor: med.bgElevated,
    borderRightWidth: 1,
    borderRightColor: med.cardBorder,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { fontSize: 18, fontWeight: '700', color: med.text },
  taglineSidebar: {
    fontSize: 10,
    color: med.textMuted,
    marginBottom: 16,
    lineHeight: 14,
    fontStyle: 'italic',
  },
  profileCard: {
    backgroundColor: med.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: med.cardBorder,
  },
  profileTitle: { color: med.text, fontWeight: '700', fontSize: 15 },
  profileSub: { color: med.textMuted, fontSize: 12, marginTop: 4 },
  profileLink: { color: med.primary, fontSize: 12, fontWeight: '600', marginTop: 10 },
  sidebarSection: {
    color: med.textDim,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 8,
  },
  sidebarList: { maxHeight: 280 },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  sidebarItemActive: { backgroundColor: med.accent },
  sidebarItemText: { color: med.textMuted, fontSize: 14, flex: 1 },
  sidebarItemTextActive: { color: '#fff', fontWeight: '600' },
  recentChat: { paddingVertical: 8, paddingHorizontal: 4 },
  recentChatText: { color: med.textMuted, fontSize: 13 },
  main: { flex: 1 },
  contentArea: { flex: 1, width: '100%' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  menuBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: med.text,
    textAlign: 'center',
  },
  topTitleSmall: { fontSize: 15 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34,197,94,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    maxWidth: 160,
  },
  onlinePillTablet: { maxWidth: 200 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: med.success },
  onlineText: {
    color: med.success,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: med.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: med.cardBorder,
  },
  scrollContent: {
    paddingBottom: 16,
    flexGrow: 1,
  },
  scrollContentCompact: {
    flexGrow: 0,
    paddingBottom: 8,
  },
  focusChatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 4,
  },
  focusChatTitle: {
    color: med.text,
    fontSize: 18,
    fontWeight: '700',
  },
  showSymptomsLink: {
    color: med.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  greetingLabel: {
    color: med.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 8,
  },
  heroTitle: {
    color: med.text,
    fontWeight: '800',
    marginTop: 8,
    maxWidth: 560,
  },
  heroSub: {
    color: med.textMuted,
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 520,
  },
  quickRow: { paddingVertical: 24, gap: 14, paddingRight: 20 },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 24,
    justifyContent: 'space-between',
  },
  quickCard: {
    backgroundColor: med.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: med.cardBorder,
    marginRight: 14,
  },
  quickCardGrid: {
    marginRight: 0,
  },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  quickTitle: { color: med.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  quickDesc: { color: med.textMuted, fontSize: 13, lineHeight: 20 },
  mobileTools: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  toolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: med.surface,
    borderWidth: 1,
    borderColor: med.cardBorder,
  },
  toolBtnText: { color: med.text, fontSize: 14, fontWeight: '600' },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  pointsText: { color: '#00C9A7', fontSize: 12, fontWeight: '700' },
});

export default MedicalHomeScreen;
