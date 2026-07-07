import React, { useState, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
  Linking, Alert, Modal, Platform,
} from 'react-native';
import {
  Text, FAB, ActivityIndicator, Searchbar,
  Checkbox, Button, TextInput, ProgressBar,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllLeadsLocal, deleteLeadLocal, initializeDatabase } from '../../utils/database';
import { C } from '../theme';

interface Lead {
  id: string; name: string; mobile: string; product: string;
  status: string; source: string; city: string;
  next_followup_date?: string; notes: string;
}

const STATUS_COLORS: Record<string, string> = {
  New:           '#1565C0',
  Interested:    '#2E7D32',
  'Follow-up':   '#E65100',
  Pipeline:      '#6A1B9A',
  Closed:        '#00695C',
  'Not Interested': '#546E7A',
};

const STATUSES = ['All', 'New', 'Interested', 'Not Interested', 'Follow-up', 'Pipeline', 'Closed'];

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

function fmtPhone(phone: string) {
  let c = phone.replace(/[^0-9]/g, '');
  if (c.startsWith('0')) c = c.substring(1);
  if (c.length === 10) c = '91' + c;
  return c;
}

export default function LeadsScreen() {
  const [leads, setLeads]               = useState<Lead[]>([]);
  const [filtered, setFiltered]         = useState<Lead[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [search, setSearch]             = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [showWAModal, setShowWAModal]   = useState(false);
  const [bulkMsg, setBulkMsg]           = useState('Hi [Name], your insurance quote is ready!');
  const [sending, setSending]           = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [statusFilter, setStatusFilter] = useState('All');
  const [userEmail, setUserEmail]       = useState('');

  const fetchLeads = async () => {
    try {
      await initializeDatabase();
      const email = await AsyncStorage.getItem('user_email') ?? '';
      setUserEmail(email);
      const data = getAllLeadsLocal(email);
      setLeads(data);
      applyFilters(search, statusFilter, data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchLeads(); }, []));

  const applyFilters = (q: string, s: string, data: Lead[] = leads) => {
    let f = data;
    if (s !== 'All') f = f.filter(l => l.status === s);
    if (q) f = f.filter(l =>
      l.name.toLowerCase().includes(q.toLowerCase()) ||
      l.mobile.includes(q) ||
      (l.city||'').toLowerCase().includes(q.toLowerCase())
    );
    setFiltered(f);
  };

  const toggleSel = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Lead', 'Delete this lead?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteLeadLocal(id); fetchLeads(); } },
    ]);
  };

  const handleBulkDelete = () => {
    Alert.alert('Delete', `Delete ${selected.size} lead(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        selected.forEach(id => deleteLeadLocal(id));
        setSelected(new Set()); setSelectionMode(false); fetchLeads();
      }},
    ]);
  };

  const sendBulkWhatsApp = async () => {
    const list = leads.filter(l => selected.has(l.id));
    Alert.alert('Send WhatsApp', `Send to ${list.length} lead(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start', onPress: async () => {
        setSending(true);
        for (let i = 0; i < list.length; i++) {
          const msg = bulkMsg.replace(/\[Name\]/g, list[i].name);
          await Clipboard.setStringAsync(msg);
          await Linking.openURL(`https://wa.me/${fmtPhone(list[i].mobile)}?text=${encodeURIComponent(msg)}`);
          setSendProgress(((i+1)/list.length)*100);
          Alert.alert(`${i+1}/${list.length}`, `WhatsApp opened for ${list[i].name}. Tap Send, then return.`, [{text:'Next'}], {cancelable:true});
          await new Promise(r => setTimeout(r, 3000));
        }
        setSending(false); setSendProgress(0); setShowWAModal(false);
        setSelectionMode(false); setSelected(new Set());
        Alert.alert('Done', `Sent to ${list.length} leads!`);
      }},
    ]);
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color={C.navy} /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={[C.navyDark, C.navy]} style={styles.header}>
        <Text style={styles.headerTitle}>Leads</Text>
        <Text style={styles.headerSub}>{filtered.length} of {leads.length} leads</Text>
      </LinearGradient>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Searchbar
          placeholder="Search name, mobile, city…"
          onChangeText={q => { setSearch(q); applyFilters(q, statusFilter); }}
          value={search}
          style={styles.searchBar}
          inputStyle={{ fontSize: 14 }}
          iconColor={C.navy}
        />
      </View>

      {/* Status filters */}
      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {STATUSES.map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, statusFilter === s && styles.chipActive]}
              onPress={() => { setStatusFilter(s); applyFilters(search, s); }}
            >
              <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>
                {s} ({s === 'All' ? leads.length : leads.filter(l=>l.status===s).length})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Selection bar */}
      {selectionMode && (
        <View style={styles.selBar}>
          <View style={styles.selLeft}>
            <Checkbox
              status={selected.size === filtered.length ? 'checked' : 'unchecked'}
              onPress={() => selected.size === filtered.length ? setSelected(new Set()) : setSelected(new Set(filtered.map(l=>l.id)))}
              color={C.navy}
            />
            <Text style={styles.selText}>{selected.size} selected</Text>
          </View>
          <View style={styles.selActions}>
            <Button mode="contained" onPress={() => setShowWAModal(true)} disabled={selected.size===0} icon="whatsapp" buttonColor="#25D366" compact>WA</Button>
            <Button mode="contained" onPress={handleBulkDelete}  disabled={selected.size===0} icon="delete"   buttonColor={C.danger}   compact>Del</Button>
            <Button mode="outlined"  onPress={() => { setSelectionMode(false); setSelected(new Set()); }} textColor={C.navy} compact>Done</Button>
          </View>
        </View>
      )}

      {!selectionMode && filtered.length > 0 && (
        <View style={styles.selectRow}>
          <TouchableOpacity onPress={() => setSelectionMode(true)} style={styles.selBtn}>
            <MaterialCommunityIcons name="checkbox-marked-outline" size={16} color={C.navy} />
            <Text style={styles.selBtnText}>Select</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLeads(); }} colors={[C.navy]} />}
      >
        <View style={styles.list}>
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="account-search-outline" size={64} color={C.border} />
              <Text style={styles.emptyText}>No leads found</Text>
              <Text style={styles.emptySub}>Add your first lead to get started</Text>
            </View>
          ) : filtered.map(lead => {
            const statusColor = STATUS_COLORS[lead.status] || C.textMid;
            return (
              <TouchableOpacity
                key={lead.id}
                style={styles.card}
                onPress={() => selectionMode ? toggleSel(lead.id) : router.push({ pathname: '/lead-detail', params: { id: lead.id } })}
                activeOpacity={0.8}
              >
                {/* Colored left bar */}
                <View style={[styles.cardBar, { backgroundColor: statusColor }]} />

                <View style={styles.cardBody}>
                  {/* Row: avatar + info + actions */}
                  <View style={styles.cardTop}>
                    {selectionMode ? (
                      <Checkbox status={selected.has(lead.id) ? 'checked' : 'unchecked'} onPress={() => toggleSel(lead.id)} color={C.navy} />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: statusColor + '22' }]}>
                        <Text style={[styles.avatarText, { color: statusColor }]}>{getInitials(lead.name)}</Text>
                      </View>
                    )}
                    <View style={styles.info}>
                      <Text style={styles.name} numberOfLines={1}>{lead.name}</Text>
                      <Text style={styles.mobile}>{lead.mobile}</Text>
                      {lead.city ? <Text style={styles.city}>{lead.city}</Text> : null}
                    </View>
                    {!selectionMode && (
                      <TouchableOpacity onPress={() => handleDelete(lead.id)} style={styles.deleteBtn} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color={C.danger} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Tags row */}
                  <View style={styles.tagsRow}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                      <Text style={styles.statusBadgeText}>{lead.status}</Text>
                    </View>
                    <View style={styles.productBadge}>
                      <Text style={styles.productBadgeText}>{lead.product}</Text>
                    </View>
                  </View>

                  {lead.next_followup_date && (
                    <View style={styles.followupRow}>
                      <MaterialCommunityIcons name="calendar-clock" size={14} color={C.warning} />
                      <Text style={styles.followupText}> {lead.next_followup_date.split('-').reverse().join('-')}</Text>
                    </View>
                  )}

                  {/* Action buttons */}
                  {!selectionMode && (
                    <View style={styles.actBtns}>
                      <TouchableOpacity style={[styles.actBtn, { backgroundColor: '#E3F2FD' }]} onPress={() => Linking.openURL(`tel:${lead.mobile}`)}>
                        <MaterialCommunityIcons name="phone" size={16} color="#1565C0" />
                        <Text style={[styles.actBtnText, { color: '#1565C0' }]}>Call</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actBtn, { backgroundColor: '#E8F5E9' }]} onPress={() => Linking.openURL(`https://wa.me/${fmtPhone(lead.mobile)}`)}>
                        <MaterialCommunityIcons name="whatsapp" size={16} color="#2E7D32" />
                        <Text style={[styles.actBtnText, { color: '#2E7D32' }]}>WhatsApp</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actBtn, { backgroundColor: C.navy + '15' }]} onPress={() => router.push({ pathname: '/add-lead', params: { id: lead.id, mode: 'edit' } })}>
                        <MaterialCommunityIcons name="pencil-outline" size={16} color={C.navy} />
                        <Text style={[styles.actBtnText, { color: C.navy }]}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* FAB removed — use center tab bar button */}

      {/* Bulk WhatsApp Modal */}
      <Modal visible={showWAModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Bulk WhatsApp</Text>
            <Text style={styles.modalSub}>{selected.size} leads selected</Text>
            <Text style={styles.modalLabel}>Message Template</Text>
            <TextInput value={bulkMsg} onChangeText={setBulkMsg} mode="outlined" multiline numberOfLines={4}
              style={styles.msgInput} outlineColor={C.border} activeOutlineColor={C.navy} />
            <Text style={styles.hintText}>Use [Name] to personalise</Text>
            {sending && (
              <View style={styles.progressWrap}>
                <ProgressBar progress={sendProgress/100} color={C.navy} style={styles.progressBar} />
                <Text style={styles.progressText}>{Math.round(sendProgress)}%</Text>
              </View>
            )}
            <View style={styles.modalBtns}>
              <Button mode="outlined" onPress={() => setShowWAModal(false)} textColor={C.navy} style={styles.modalBtn}>Cancel</Button>
              <Button mode="contained" onPress={sendBulkWhatsApp} buttonColor="#25D366" style={styles.modalBtn} disabled={sending}>
                {sending ? 'Sending…' : 'Send All'}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loader: { flex: 1, justifyContent:'center', alignItems:'center', backgroundColor: C.bg },

  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: C.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 3 },

  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, backgroundColor: C.white },
  searchBar: { elevation: 0, backgroundColor: C.bg, borderRadius: 12 },

  filterWrap: { backgroundColor: C.white, paddingBottom: 10 },
  filterRow: { paddingHorizontal: 16, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.navy, borderColor: C.navy },
  chipText: { fontSize: 12, fontWeight: '600', color: C.textMid },
  chipTextActive: { color: C.white },

  selBar: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:12, paddingVertical:8, backgroundColor:'#EEF2FF', borderBottomWidth:1, borderBottomColor:C.border },
  selLeft: { flexDirection:'row', alignItems:'center' },
  selText: { fontSize:14, fontWeight:'600', color:C.navy, marginLeft:4 },
  selActions: { flexDirection:'row', gap:6 },

  selectRow: { flexDirection:'row', justifyContent:'flex-end', paddingHorizontal:16, paddingVertical:6, backgroundColor:C.white, borderBottomWidth:1, borderBottomColor:C.border },
  selBtn: { flexDirection:'row', alignItems:'center', gap:4, paddingVertical:4, paddingHorizontal:10, borderRadius:8, backgroundColor:'#EEF2FF' },
  selBtnText: { fontSize:12, fontWeight:'700', color:C.navy },

  scroll: { flex:1 },
  list: { padding:12, gap:10 },
  empty: { alignItems:'center', paddingVertical:60 },
  emptyText: { fontSize:16, color:C.textMid, fontWeight:'600', marginTop:16 },
  emptySub: { fontSize:13, color:C.textLight, marginTop:6 },

  card: { flexDirection:'row', backgroundColor:C.white, borderRadius:16, elevation:3, shadowColor:C.navy, shadowOpacity:0.08, shadowRadius:8, shadowOffset:{width:0,height:2}, overflow:'hidden' },
  cardBar: { width:4 },
  cardBody: { flex:1, padding:14 },

  cardTop: { flexDirection:'row', alignItems:'flex-start', marginBottom:10 },
  avatar: { width:44, height:44, borderRadius:14, justifyContent:'center', alignItems:'center', marginRight:12 },
  avatarText: { fontSize:15, fontWeight:'800' },
  info: { flex:1 },
  name: { fontSize:16, fontWeight:'700', color:C.textPrimary },
  mobile: { fontSize:13, color:C.textMid, marginTop:2 },
  city: { fontSize:12, color:C.textLight, marginTop:1 },
  deleteBtn: { padding:2 },

  tagsRow: { flexDirection:'row', gap:8, marginBottom:8 },
  statusBadge: { paddingHorizontal:10, paddingVertical:4, borderRadius:20 },
  statusBadgeText: { fontSize:11, color:C.white, fontWeight:'700' },
  productBadge: { paddingHorizontal:10, paddingVertical:4, borderRadius:20, backgroundColor:C.bg, borderWidth:1, borderColor:C.border },
  productBadgeText: { fontSize:11, color:C.textMid, fontWeight:'600' },

  followupRow: { flexDirection:'row', alignItems:'center', marginBottom:8 },
  followupText: { fontSize:12, color:C.warning, fontWeight:'600' },

  actBtns: { flexDirection:'row', gap:8 },
  actBtn: { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:4, paddingVertical:8, borderRadius:10 },
  actBtnText: { fontSize:12, fontWeight:'700' },

  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'flex-end' },
  modalCard: { backgroundColor:C.white, borderTopLeftRadius:24, borderTopRightRadius:24, padding:24 },
  modalTitle: { fontSize:20, fontWeight:'800', color:C.navy, marginBottom:4 },
  modalSub: { fontSize:13, color:C.textMid, marginBottom:16 },
  modalLabel: { fontSize:13, fontWeight:'700', color:C.navy, marginBottom:8 },
  msgInput: { marginBottom:8 },
  hintText: { fontSize:12, color:C.textLight, marginBottom:12 },
  progressWrap: { marginBottom:12 },
  progressBar: { height:6, borderRadius:4 },
  progressText: { fontSize:12, color:C.textMid, marginTop:4, textAlign:'center' },
  modalBtns: { flexDirection:'row', gap:12 },
  modalBtn: { flex:1 },
});
