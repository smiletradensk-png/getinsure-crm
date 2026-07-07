import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllLeadsLocal, initializeDatabase } from '../../utils/database';
import { C } from '../theme';

interface Lead { id: string; name: string; mobile: string; status: string; product: string; }

const STAGES = [
  { name:'New',          color:'#1565C0', bgColor:'#E3F2FD', icon:'account-plus-outline',    gradient:['#1565C0','#1976D2'] as [string,string] },
  { name:'Interested',   color:'#2E7D32', bgColor:'#E8F5E9', icon:'thumb-up-outline',         gradient:['#2E7D32','#388E3C'] as [string,string] },
  { name:'Follow-up',    color:'#E65100', bgColor:'#FFF3E0', icon:'calendar-clock',            gradient:['#E65100','#F57C00'] as [string,string] },
  { name:'Pipeline',     color:'#6A1B9A', bgColor:'#F3E5F5', icon:'trending-up',              gradient:['#6A1B9A','#7B1FA2'] as [string,string] },
  { name:'Closed',       color:'#00695C', bgColor:'#E0F2F1', icon:'check-decagram-outline',   gradient:['#00695C','#00796B'] as [string,string] },
];

function getInitials(name: string) {
  return name.split(' ').slice(0,2).map(w => w[0]?.toUpperCase()||'').join('');
}

export default function PipelineScreen() {
  const [leads, setLeads]         = useState<Lead[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeads = async () => {
    try {
      await initializeDatabase();
      const email = await AsyncStorage.getItem('user_email') ?? '';
      setLeads(getAllLeadsLocal(email));
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchLeads(); }, []));

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color={C.navy} /></View>;

  const total = leads.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={[C.navyDark, C.navy]} style={styles.header}>
        <Text style={styles.headerTitle}>Pipeline</Text>
        <Text style={styles.headerSub}>{total} lead{total !== 1 ? 's' : ''} in pipeline</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLeads(); }} colors={[C.navy]} />}
      >
        {/* Summary bar */}
        <View style={styles.summaryBar}>
          {STAGES.map(stage => {
            const count = leads.filter(l => l.status === stage.name).length;
            const pct = total > 0 ? count / total : 0;
            return (
              <View key={stage.name} style={[styles.summaryItem, { flex: Math.max(pct, 0.05) }]}>
                <View style={[styles.summaryFill, { backgroundColor: stage.color }]} />
              </View>
            );
          })}
        </View>

        <View style={styles.body}>
          {STAGES.map(stage => {
            const stageLeads = leads.filter(l => l.status === stage.name);
            return (
              <View key={stage.name} style={styles.stageSection}>
                {/* Stage header */}
                <View style={styles.stageHeader}>
                  <LinearGradient colors={stage.gradient} style={styles.stageIconWrap}>
                    <MaterialCommunityIcons name={stage.icon as any} size={18} color={C.white} />
                  </LinearGradient>
                  <Text style={[styles.stageName, { color: stage.color }]}>{stage.name}</Text>
                  <View style={[styles.stageCount, { backgroundColor: stage.color }]}>
                    <Text style={styles.stageCountText}>{stageLeads.length}</Text>
                  </View>
                  {stageLeads.length > 0 && (
                    <View style={styles.stagePct}>
                      <Text style={[styles.stagePctText, { color: stage.color }]}>
                        {total > 0 ? Math.round((stageLeads.length/total)*100) : 0}%
                      </Text>
                    </View>
                  )}
                </View>

                {/* Lead cards */}
                {stageLeads.length === 0 ? (
                  <View style={[styles.emptyStage, { backgroundColor: stage.bgColor }]}>
                    <Text style={[styles.emptyStageText, { color: stage.color }]}>No leads here</Text>
                  </View>
                ) : (
                  <View style={styles.leadsWrap}>
                    {stageLeads.slice(0, 4).map(lead => (
                      <TouchableOpacity
                        key={lead.id}
                        style={[styles.leadCard, { borderLeftColor: stage.color }]}
                        onPress={() => router.push({ pathname: '/lead-detail', params: { id: lead.id } })}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.leadAvatar, { backgroundColor: stage.bgColor }]}>
                          <Text style={[styles.leadAvatarText, { color: stage.color }]}>{getInitials(lead.name)}</Text>
                        </View>
                        <View style={styles.leadInfo}>
                          <Text style={styles.leadName} numberOfLines={1}>{lead.name}</Text>
                          <Text style={styles.leadSub}>{lead.product} · {lead.mobile}</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={stage.color} />
                      </TouchableOpacity>
                    ))}
                    {stageLeads.length > 4 && (
                      <TouchableOpacity style={[styles.moreBtn, { borderColor: stage.color }]} onPress={() => router.push('/(tabs)/leads')}>
                        <Text style={[styles.moreBtnText, { color: stage.color }]}>+{stageLeads.length - 4} more → View All</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {/* Not Interested summary */}
          {(() => {
            const niCount = leads.filter(l => l.status === 'Not Interested').length;
            return niCount > 0 ? (
              <View style={styles.niRow}>
                <MaterialCommunityIcons name="thumb-down-outline" size={16} color={C.textLight} />
                <Text style={styles.niText}>{niCount} Not Interested</Text>
              </View>
            ) : null;
          })()}
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

  summaryBar: { flexDirection:'row', height:6, marginHorizontal:16, marginTop:16, borderRadius:4, overflow:'hidden', gap:2 },
  summaryItem: { borderRadius:4 },
  summaryFill: { flex:1, borderRadius:4 },

  scroll: { flex:1 },
  body: { padding:16, gap:16 },

  stageSection: { backgroundColor: C.white, borderRadius:16, overflow:'hidden', elevation:3, shadowColor: C.navy, shadowOpacity:0.07, shadowRadius:8, shadowOffset:{width:0,height:2} },
  stageHeader: { flexDirection:'row', alignItems:'center', padding:14, gap:10, borderBottomWidth:1, borderBottomColor: C.border },
  stageIconWrap: { width:34, height:34, borderRadius:10, justifyContent:'center', alignItems:'center' },
  stageName: { flex:1, fontSize:16, fontWeight:'700' },
  stageCount: { width:30, height:30, borderRadius:10, justifyContent:'center', alignItems:'center' },
  stageCountText: { color: C.white, fontWeight:'800', fontSize:14 },
  stagePct: { paddingHorizontal:8, paddingVertical:4, borderRadius:8, backgroundColor: C.bg },
  stagePctText: { fontSize:12, fontWeight:'700' },

  emptyStage: { margin:12, padding:16, borderRadius:12, alignItems:'center' },
  emptyStageText: { fontSize:13, fontWeight:'600' },

  leadsWrap: { padding:10, gap:8 },
  leadCard: { flexDirection:'row', alignItems:'center', padding:12, borderRadius:12, backgroundColor: C.bg, borderLeftWidth:3, gap:10 },
  leadAvatar: { width:38, height:38, borderRadius:10, justifyContent:'center', alignItems:'center' },
  leadAvatarText: { fontSize:13, fontWeight:'800' },
  leadInfo: { flex:1 },
  leadName: { fontSize:14, fontWeight:'700', color: C.textPrimary },
  leadSub: { fontSize:12, color: C.textMid, marginTop:2 },

  moreBtn: { margin:4, padding:10, borderRadius:10, borderWidth:1, borderStyle:'dashed', alignItems:'center' },
  moreBtnText: { fontSize:12, fontWeight:'700' },

  niRow: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, padding:12, backgroundColor: C.white, borderRadius:12 },
  niText: { fontSize:13, color: C.textLight, fontWeight:'600' },
});
