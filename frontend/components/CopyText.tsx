import React from 'react';
import { ToastAndroid, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';

// Text that copies itself to the clipboard on long-press (works inside cards and buttons too).
export default function CopyText({ children, copyValue, ...props }: any) {
  const flat = React.Children.toArray(children)
    .filter(c => typeof c === 'string' || typeof c === 'number')
    .join('');

  const onLongPress = async () => {
    const v = String(copyValue ?? flat).replace(/^📍\s*/, '').trim();
    if (!v) return;
    try {
      await Clipboard.setStringAsync(v);
      if (Platform.OS === 'android') {
        ToastAndroid.show(`Copied: ${v.length > 40 ? v.slice(0, 40) + '…' : v}`, ToastAndroid.SHORT);
      }
    } catch {}
  };

  return <Text {...props} onLongPress={onLongPress}>{children}</Text>;
}
