import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';

export const fontScales: Record<FontSize, number> = {
  small: 0.85,
  medium: 1.0,
  large: 1.18,
  xlarge: 1.35,
};

interface AppSettings {
  fontSize: FontSize;
  fontScale: number;
  setFontSize: (size: FontSize) => Promise<void>;
}

const AppSettingsContext = createContext<AppSettings>({
  fontSize: 'medium',
  fontScale: 1.0,
  setFontSize: async () => {},
});

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fontSize, setFontSizeState] = useState<FontSize>('medium');

  useEffect(() => {
    AsyncStorage.getItem('appFontSize').then(value => {
      if (value && value in fontScales) {
        setFontSizeState(value as FontSize);
      }
    });
  }, []);

  const setFontSize = async (size: FontSize) => {
    setFontSizeState(size);
    await AsyncStorage.setItem('appFontSize', size);
  };

  return (
    <AppSettingsContext.Provider value={{ fontSize, fontScale: fontScales[fontSize], setFontSize }}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => useContext(AppSettingsContext);
