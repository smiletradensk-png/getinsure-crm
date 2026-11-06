import React, { useState, useCallback, useRef } from 'react';
import {
  View, StyleSheet, ScrollView, RefreshControl, FlatList, InteractionManager, TouchableOpacity,
  Linking, Alert, Modal, Platform,
} from 'react-native';
import {
  Text, FAB, ActivityIndicator, Searchbar,
  Checkbox, Button, TextInput, ProgressBar,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { takePendingStatus } from '../../utils/navFilter';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllLeadsLocal, deleteLeadLocal, initializeDatabase, getInteractionTextByLead } from '../../utils/database';
import CopyText from '../../components/CopyText';
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


const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

const norm = (t: string) => (t || '').normalize('NFC').toLowerCase();

const dateWords = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  const mon = MONTHS[d.getMonth()];
  const h24 = d.getHours();
  const h12 = h24 % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, '0');
  const ap = h24 >= 12 ? 'pm' : 'am';
  return `${dd}-${mm}-${yyyy} ${dd}/${mm}/${yyyy} ${yyyy}-${mm}-${dd} ${dd} ${mon} ${mon.slice(0, 3)} ${yyyy} ${h12}:${min} ${ap} ${h12}:${min}${ap} ${String(h24).padStart(2, '0')}:${min}`;
};

const withinOneEdit = (a: string, b: string): boolean => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
};

const tokenMatches = (token: string, blob: string, words: string[]): boolean => {
  if (blob.includes(token)) return true;
  if (token.length < 4) return false;
  return words.some(w => w.length >= 3 && (withinOneEdit(token, w) || (w.length > token.length && withinOneEdit(token, w.slice(0, token.length)))));
};

const buildBlob = (l: any, interactionText: string): string => norm([
  l.name, l.mobile, l.city, l.product, l.status, l.source, l.notes,
  l.next_followup_date, l.next_followup_time, dateWords(l.created_at), dateWords(l.next_followup_date),
  l.product && /kanyadan/i.test(l.product) ? 'कन्यादान kanyadan' : '',
  l.product && /term/i.test(l.product) ? 'टर्म विमा term insurance' : '',
  l.status === 'New' ? 'नवीन' : '',
  interactionText,
].filter(Boolean).join(' '));

const LeadCard = React.memo(function LeadCard({ lead, selectionMode, isSelected, onToggle, onDelete }: {
  lead: any; selectionMode: boolean; isSelected: boolean; onToggle: (id: string) => void; onDelete: (id: string) => void;
}) {
  const statusColor = STATUS_COLORS[lead.status] || C.textMid;
  return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => selectionMode ? onToggle(lead.id) : router.push({ pathname: '/lead-detail', params: { id: lead.id } })}
                activeOpacity={0.8}
              >
                {/* Colored left bar */}
                <View style={[styles.cardBar, { backgroundColor: statusColor }]} />

                <View style={styles.cardBody}>
                  {/* Row: avatar + info + actions */}
                  <View style={styles.cardTop}>
                    {selectionMode ? (
                      <Checkbox status={isSelected ? 'checked' : 'unchecked'} onPress={() => onToggle(lead.id)} color={C.navy} />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: statusColor + '22' }]}>
                        <Text style={[styles.avatarText, { color: statusColor }]}>{getInitials(lead.name)}</Text>
                      </View>
                    )}
                    <View style={styles.info}>
                      <CopyText style={styles.name} numberOfLines={1}>{lead.name}</CopyText>
                      <CopyText style={styles.mobile}>{lead.mobile}</CopyText>
                      {lead.city ? <CopyText style={styles.city}>{lead.city}</CopyText> : null}
                      {lead.created_at && !isNaN(new Date(lead.created_at).getTime()) ? (
                        <CopyText style={styles.city}>
                          {new Date(lead.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                        </CopyText>
                      ) : null}
                    </View>
                    {!selectionMode && (
                      <TouchableOpacity onPress={() => onDelete(lead.id)} style={styles.deleteBtn} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
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
});

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
  const interactionRef = useRef<Record<string, string> | null>(null);
  const blobCache = useRef<Record<string, { blob: string; words: string[] }>>({});
  const searchTimer = useRef<any>(null);

  const fetchLeads = async (statusOverride?: string) => {
    try {
      await initializeDatabase();
      const email = await AsyncStorage.getItem('user_email') ?? '';
      setUserEmail(email);
      const data = getAllLeadsLocal(email);
      blobCache.current = {};
      interactionRef.current = null;
      setLeads(data);
      applyFilters(search, statusOverride ?? statusFilter, data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      const pending = takePendingStatus();
      if (pending) {
        setStatusFilter(pending);
        fetchLeads(pending);
      } else {
        fetchLeads();
      }
    });
    return () => task.cancel();
  }, []));

  const applyFilters = (q: string, s: string, data: Lead[] = leads, itextArg?: Record<string, string>) => {
    let f = data;
    if (s !== 'All') f = f.filter(l => l.status === s);
    const tokens = norm(q).split(/\s+/).filter(Boolean);
    if (tokens.length) {
      if (!interactionRef.current) interactionRef.current = itextArg || getInteractionTextByLead();
      const itext = interactionRef.current;
      f = f.filter(l => {
        let c = blobCache.current[l.id];
        if (!c) {
          const b0 = buildBlob(l, itext[l.id] || '');
          c = blobCache.current[l.id] = { blob: b0, words: b0.split(/[\s,.:;/()\-]+/).filter(Boolean) };
        }
        const blob = c.blob;
        const words = c.words;
        return tokens.every(t => tokenMatches(t, blob, words));
      });
    }
    setFiltered(f);
  };

  const toggleSel = useCallback((id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const fetchLeadsRef = useRef<() => void>(() => {});
  fetchLeadsRef.current = fetchLeads;

  const handleDelete = useCallback((id: string) => {
    Alert.alert('Delete Lead', 'Delete this lead?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteLeadLocal(id); fetchLeadsRef.current(); } },
    ]);
  }, []);

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
          placeholder="Search name, mobile, city, notes, date…"
          placeholderTextColor="#757575"
          onChangeText={q => { setSearch(q); if (searchTimer.current) clearTimeout(searchTimer.current); searchTimer.current = setTimeout(() => applyFilters(q, statusFilter), 250); }}
          value={search}
          style={styles.searchBar}
          inputStyle={{ fontSize: 14, color: '#111111' }}
          iconColor={C.navy}
          selectionColor={C.navy}
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

      <FlatList
        style={styles.scroll}
        contentContainerStyle={styles.list}
        data={filtered}
        keyExtractor={(l: any) => l.id}
        renderItem={({ item }) => (
          <LeadCard
            lead={item}
            selectionMode={selectionMode}
            isSelected={selected.has(item.id)}
            onToggle={toggleSel}
            onDelete={handleDelete}
          />
        )}
        extraData={[selectionMode, selected]}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); fetchLeads(); }}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <MaterialCommunityIcons name="account-search-outline" size={64} color={C.border} />
            <Text style={styles.emptyText}>No leads found</Text>
            <Text style={styles.emptySub}>Add your first lead to get started</Text>
          </View>
        )}
      />

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
  searchBar: { elevation: 0, backgroundColor: '#F1F3F8', borderRadius: 12 },

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
