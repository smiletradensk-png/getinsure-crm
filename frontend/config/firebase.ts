// Firebase Configuration
// NOTE: This app currently uses MOCKED OTP authentication (OTP: 123456)
// When you have real Firebase credentials, add them to your .env file and uncomment the code below

import { Platform } from 'react-native';

// Firebase config from environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || ""
};

// Check if Firebase is configured
export const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey !== "" && firebaseConfig.projectId !== "";
};

// Placeholder exports for when Firebase is not configured
// The app uses MOCKED authentication by default
let app: any = null;
let auth: any = null;

// Only initialize Firebase if credentials are provided
if (isFirebaseConfigured() && Platform.OS !== 'web') {
  try {
    const { initializeApp } = require('firebase/app');
    const { getAuth } = require('firebase/auth');
    
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    console.log('✅ Firebase initialized successfully');
  } catch (error) {
    console.log('⚠️ Firebase not initialized - using MOCKED authentication');
  }
} else {
  console.log('ℹ️ Firebase not configured - using MOCKED authentication (OTP: 123456)');
}

export { auth };
export default app;
