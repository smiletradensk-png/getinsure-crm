import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { fmt12 } from '../utils/time12';

const QUICK = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'];

// Compact 12-hour time picker: type hour/minute, tap AM/PM, or pick a quick time.
export default function TimePickerModal({ visible, value, onSelect, onClose }: {
  visible: boolean; value?: string; onSelect: (v: string) => void; onClose: () => void;
}) {
  const [h, setH] = useState('10');
  const [m, setM] = useState('00');
  const [pm, setPm] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const mm = /^(\d{1,2}):(\d{2})/.exec(value || '10:00');
    const H = mm ? parseInt(mm[1], 10) : 10;
    setPm(H >= 12);
    setH(String(H % 12 || 12));
    setM(mm ? mm[2] : '00');
  }, [visible, value]);

  const clean = (s: string, max: number) => s.replace(/\D/g, '').slice(0, 2);
  const hh = Math.min(12, Math.max(1, parseInt(h || '12', 10) || 12));
  const mn = Math.min(59, Math.max(0, parseInt(m || '0', 10) || 0));
  const out24 = () => {
    let H = hh % 12;
    if (pm) H += 12;
    return `${String(H).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <Text style={s.title}>Select time</Text>
          <View style={s.row}>
            <TextInput style={s.box} value={h} onChangeText={t => setH(clean(t, 12))} keyboardType="number-pad" maxLength={2} selectTextOnFocus />
            <Text style={s.colon}>:</Text>
            <TextInput style={s.box} value={m} onChangeText={t => setM(clean(t, 59))} keyboardType="number-pad" maxLength={2} selectTextOnFocus
              onBlur={() => setM(String(mn).padStart(2, '0'))} />
            <View style={s.ampm}>
              {['AM', 'PM'].map(x => {
                const on = (x === 'PM') === pm;
                return (
                  <TouchableOpacity key={x} onPress={() => setPm(x === 'PM')} style={[s.ampmBtn, on && s.ampmOn]}>
                    <Text style={[s.ampmTxt, on && { color: '#fff' }]}>{x}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={s.quickRow}>
            {QUICK.map(q => (
              <TouchableOpacity key={q} style={s.chip} onPress={() => onSelect(q)}>
                <Text style={s.chipTxt}>{fmt12(q)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.actions}>
            <TouchableOpacity onPress={onClose} style={s.actBtn}><Text style={s.cancel}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => onSelect(out24())} style={[s.actBtn, s.okBtn]}><Text style={s.okTxt}>OK</Text></TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  card: { width: 300, backgroundColor: '#fff', borderRadius: 18, padding: 18 },
  title: { fontSize: 16, fontWeight: '700', color: '#1A237E', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  box: { width: 64, height: 56, borderRadius: 12, backgroundColor: '#EEF1FA', textAlign: 'center', fontSize: 26, fontWeight: '700', color: '#1A237E', padding: 0 },
  colon: { fontSize: 26, fontWeight: '700', marginHorizontal: 6, color: '#1A237E' },
  ampm: { marginLeft: 12, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#C5CAE9' },
  ampmBtn: { paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#fff' },
  ampmOn: { backgroundColor: '#1A237E' },
  ampmTxt: { fontWeight: '700', color: '#1A237E', fontSize: 14 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#F1F3F8', borderWidth: 1, borderColor: '#D6DAE3' },
  chipTxt: { fontSize: 12, color: '#424242', fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 8 },
  actBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  cancel: { color: '#757575', fontWeight: '700' },
  okBtn: { backgroundColor: '#1A237E' },
  okTxt: { color: '#fff', fontWeight: '700' },
});
