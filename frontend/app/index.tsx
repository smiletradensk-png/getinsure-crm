import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C } from './theme';

export default function Index() {
  const [ready, setReady]       = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet(['userLoggedIn', 'user_pin']).then(pairs => {
      const loggedInVal = pairs[0][1];
      const pinVal      = pairs[1][1];
      setLoggedIn(loggedInVal === 'true' && !!pinVal);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <View style={{ flex:1, backgroundColor: C.navyDark, justifyContent:'center', alignItems:'center' }}>
        <ActivityIndicator color={C.gold} size="large" />
      </View>
    );
  }

  return <Redirect href={loggedIn ? '/(tabs)' : '/login'} />;
}
