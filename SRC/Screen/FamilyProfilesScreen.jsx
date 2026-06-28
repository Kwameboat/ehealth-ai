import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import HealthFeatureLayout from '../Components/HealthFeatureLayout';
import { useMedTheme } from '../hooks/useMedTheme';
import { createFamilyProfile, deleteFamilyProfile, fetchFamilyProfiles } from '../services/healthApi';

export default function FamilyProfilesScreen({ navigation }) {
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);
  const [profiles, setProfiles] = useState([]);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [conditions, setConditions] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetchFamilyProfiles();
      setProfiles(res.profiles || []);
    } catch {
      setProfiles([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async () => {
    if (!name.trim()) return;
    try {
      await createFamilyProfile({
        displayName: name.trim(),
        relationship: relationship.trim() || undefined,
        phone: phone.trim() || undefined,
        conditions: conditions.trim() || undefined,
      });
      setName('');
      setRelationship('');
      setPhone('');
      setConditions('');
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const remove = (id) => {
    Alert.alert('Remove profile?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteFamilyProfile(id);
          load();
        },
      },
    ]);
  };

  return (
    <HealthFeatureLayout navigation={navigation} title="Family Profiles" subtitle="Track health for loved ones">
      <TextInput style={styles.input} placeholder="Name" placeholderTextColor={med.textMuted} value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Relationship (e.g. Mother)" placeholderTextColor={med.textMuted} value={relationship} onChangeText={setRelationship} />
      <TextInput style={styles.input} placeholder="Phone (optional)" placeholderTextColor={med.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextInput style={styles.input} placeholder="Conditions (optional)" placeholderTextColor={med.textMuted} value={conditions} onChangeText={setConditions} />
      <TouchableOpacity style={styles.btn} onPress={add}>
        <Text style={styles.btnText}>Add family member</Text>
      </TouchableOpacity>
      <FlatList
        data={profiles}
        keyExtractor={(p) => p.id}
        scrollEnabled={false}
        style={{ marginTop: 20 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.displayName}</Text>
              {item.relationship ? <Text style={styles.meta}>{item.relationship}</Text> : null}
              {item.conditions ? <Text style={styles.meta}>{item.conditions}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => remove(item.id)}>
              <Text style={styles.remove}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No family profiles yet</Text>}
      />
    </HealthFeatureLayout>
  );
}

const createStyles = (med) =>
  StyleSheet.create({
    input: {
      backgroundColor: med.card,
      borderWidth: 1,
      borderColor: med.cardBorder,
      borderRadius: 10,
      padding: 12,
      color: med.text,
      marginBottom: 8,
    },
    btn: { backgroundColor: med.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
    btnText: { color: '#fff', fontWeight: '700' },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: med.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: med.cardBorder,
    },
    cardTitle: { fontWeight: '700', color: med.text },
    meta: { color: med.textMuted, fontSize: 13, marginTop: 2 },
    remove: { color: '#EF4444', fontWeight: '600' },
    empty: { color: med.textMuted, marginTop: 12 },
  });
