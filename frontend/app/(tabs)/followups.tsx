import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Linking } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllLeadsLocal, initializeDatabase } from '../../utils/database';
import { C } from '../theme';

interface Lead {
  id: string; name: string; mobile: string; product: string;
  status: string; next_followup_date?: string; next_followup_time?: string;
}

type Filter = 'overdue' | 'today' | 'upcoming';

const FILTERS: { key: Filter; label: string; icon: string; activeColors: [string,string]; dot: string }[] = [
  { key: 'overdue',  label: 'Overdue',  icon: 'alert-circle-outline', activeColors: ['#B71C1C','#C62828'], dot: C.danger },
  { key: 'today',    label: 'Today',    icon: 'calendar-today',        activeColors: ['#E65100','#F57C00'], dot: C.warning },
  { key: 'upcoming', label: 'Upcoming', icon: 'calendar-arrow-right',  activeColors: ['#1B5E20','#2E7D32'], dot: C.success },
];

function getInitials(name: string) {
  return name.split(' ').slice(0,2).map(w => w[0]?.toUpperCase()||'').join('');
}
function fmtDate(d: string) {
  const [y,m,dd] = d.split('-'); return `${dd}-${m}-${y}`;
}
function fmtPhone(p: string) {
  const c = p.replace(/[^0-9]/g,'');
  return c.length===10 ? '91'+c : c;
}

export default function FollowupsScreen() {
  const [leads, setLeads]         = useState<Lead[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState<Filter>('today');

  const fetchFollowups = async (f: Filter) => {
    try {
      await initializeDatabase();
      const email = await AsyncStorage.getItem('user_email') ?? '';
      const all = getAllLeadsLocal(email);
      const today = new Date().toISOString().split('T')[0];
      const res = all.filter((l: Lead) => {
        if (!l.next_followup_date) return false;
        const fd = l.next_followup_date;
        if (f === 'today')    return fd === today;
        if (f === 'overdue')  return fd < today && !['Closed','Not Interested'].includes(l.status);
        if (f === 'upcoming') return fd > today;
        return false;
      });
      setLeads(res);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchFollowups(filter); }, [filter]));

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color={C.navy} /></View>;

  const active = FILTERS.find(f => f.key === filter)!;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={[C.navyDark, C.navy]} style={styles.header}>
        <Text style={styles.headerTitle}>Follow-ups</Text>
        <Text style={styles.headerSub}>{leads.length} task{leads.length !== 1 ? 's' : ''}</Text>
      </LinearGradient>

      {/* Filter tabs */}
      <View style={styles.filterWrap}>
        {FILTERS.map(f => {
          const isActive = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterTab, isActive && styles.filterTabActive]}
              onPress={() => { setFilter(f.key); fetchFollowups(f.key); }}
              activeOpacity={0.8}
            >
              {isActive ? (
                <LinearGradient colors={f.activeColors} style={styles.filterGradient}>
                  <MaterialCommunityIcons name={f.icon as any} size={16} color={C.white} />
                  <Text style={[styles.filterLabel, { color: C.white }]}>{f.label}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.filterGradient}>
                  <MaterialCommunityIcons name={f.icon as any} size={16} color={C.textMid} />
                  <Text style={[styles.filterLabel, { color: C.textMid }]}>{f.label}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFollowups(filter); }} colors={[C.navy]} />}
      >
        <View style={styles.list}>
          {leads.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="calendar-check-outline" size={64} color={C.border} />
              <Text style={styles.emptyText}>
                {filter === 'today' ? 'Clear today!' :
                 filter === 'overdue' ? 'No overdue tasks' : 'No upcoming tasks'}
              </Text>
              <Text style={styles.emptySub}>
                {filter === 'today' ? 'No follow-ups scheduled for today' :
                 filter === 'overdue' ? 'Great — you\'re all caught up!' :
                 'No future follow-ups yet'}
              </Text>
            </View>
          ) : leads.map(lead => (
            <View key={lead.id} style={styles.card}>
              <View style={[styles.cardAccent, { backgroundColor: active.dot }]} />
              <View style={styles.cardBody}>
                {/* Top row */}
                <View style={styles.cardTop}>
                  <View style={[styles.avatar, { backgroundColor: active.dot + '18' }]}>
                    <Text style={[styles.avatarText, { color: active.dot }]}>{getInitials(lead.name)}</Text>
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.name}>{lead.name}</Text>
                    <Text style={styles.mobile}>{lead.mobile}</Text>
                  </View>
                  <View style={styles.tags}>
                    <View style={[styles.badge, { backgroundColor: active.dot }]}>
                      <Text style={styles.badgeText}>{lead.status}</Text>
                    </View>
                  </View>
                </View>

                {/* Date row */}
                <View style={styles.dateRow}>
                  <MaterialCommunityIcons name="calendar-clock" size={15} color={active.dot} />
                  <Text style={[styles.dateText, { color: active.dot }]}>
                    {lead.next_followup_date ? fmtDate(lead.next_followup_date) : ''}
                    {lead.next_followup_time ? `  at ${lead.next_followup_time}` : ''}
                  </Text>
                  <View style={[styles.productPill, { marginLeft: 'auto' }]}>
                    <Text style={styles.productText}>{lead.product}</Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.actBtns}>
                  <TouchableOpacity style={[styles.actBtn, { backgroundColor: '#E8F5E9' }]} onPress={() => Linking.openURL(`tel:${lead.mobile}`)}>
                    <MaterialCommunityIcons name="phone" size={16} color="#2E7D32" />
                    <Text style={[styles.actText, { color:'#2E7D32' }]}>Call</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actBtn, { backgroundColor:'#E8F5E9' }]} onPress={() => Linking.openURL(`https://wa.me/${fmtPhone(lead.mobile)}`)}>
                    <MaterialCommunityIcons name="whatsapp" size={16} color="#2E7D32" />
                    <Text style={[styles.actText, { color:'#2E7D32' }]}>WhatsApp</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actBtn, { backgroundColor: C.navy+'15' }]} onPress={() => router.push({ pathname:'/lead-detail', params:{ id: lead.id } })}>
                    <MaterialCommunityIcons name="eye-outline" size={16} color={C.navy} />
                    <Text style={[styles.actText, { color: C.navy }]}>View</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor: C.bg },
  loader: { flex:1, justifyContent:'center', alignItems:'center', backgroundColor: C.bg },

  header: { paddingHorizontal:20, paddingTop:12, paddingBottom:20 },
  headerTitle: { fontSize:24, fontWeight:'800', color: C.white },
  headerSub: { fontSize:13, color:'rgba(255,255,255,0.65)', marginTop:3 },

  filterWrap: { flexDirection:'row', padding:12, gap:8, backgroundColor: C.white, borderBottomWidth:1, borderBottomColor: C.border },
  filterTab: { flex:1, borderRadius:12, overflow:'hidden', borderWidth:1, borderColor: C.border },
  filterTabActive: { borderColor:'transparent' },
  filterGradient: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:5, paddingVertical:10, paddingHorizontal:6 },
  filterLabel: { fontSize:12, fontWeight:'700' },

  scroll: { flex:1 },
  list: { padding:12, gap:10 },
  empty: { alignItems:'center', paddingVertical:60 },
  emptyText: { fontSize:16, fontWeight:'700', color: C.textMid, marginTop:16 },
  emptySub: { fontSize:13, color: C.textLight, marginTop:6, textAlign:'center' },

  card: { flexDirection:'row', backgroundColor: C.white, borderRadius:16, elevation:3, shadowColor: C.navy, shadowOpacity:0.08, shadowRadius:8, shadowOffset:{width:0,height:2}, overflow:'hidden' },
  cardAccent: { width:4 },
  cardBody: { flex:1, padding:14 },

  cardTop: { flexDirection:'row', alignItems:'center', marginBottom:10 },
  avatar: { width:42, height:42, borderRadius:12, justifyContent:'center', alignItems:'center', marginRight:12 },
  avatarText: { fontSize:15, fontWeight:'800' },
  info: { flex:1 },
  name: { fontSize:16, fontWeight:'700', color: C.textPrimary },
  mobile: { fontSize:13, color: C.textMid, marginTop:2 },
  tags: {},
  badge: { paddingHorizontal:10, paddingVertical:4, borderRadius:20 },
  badgeText: { fontSize:11, color: C.white, fontWeight:'700' },

  dateRow: { flexDirection:'row', alignItems:'center', marginBottom:12, gap:6 },
  dateText: { fontSize:13, fontWeight:'700' },
  productPill: { paddingHorizontal:10, paddingVertical:3, borderRadius:20, backgroundColor: C.bg, borderWidth:1, borderColor: C.border },
  productText: { fontSize:11, color: C.textMid, fontWeight:'600' },

  actBtns: { flexDirection:'row', gap:8 },
  actBtn: { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:4, paddingVertical:8, borderRadius:10 },
  actText: { fontSize:12, fontWeight:'700' },
});
