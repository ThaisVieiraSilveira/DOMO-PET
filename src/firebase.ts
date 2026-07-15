import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const env = (import.meta as any).env || {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyAkMBB7pguKUOA40_g84iU66CSQuGFMo0E",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "kahu-care-01.firebaseapp.com",
  databaseURL: env.VITE_FIREBASE_DATABASE_URL || "https://kahu-care-01-default-rtdb.firebaseio.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "kahu-care-01",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "kahu-care-01.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "297257489322",
  appId: env.VITE_FIREBASE_APP_ID || "1:297257489322:web:9ce2f6d1ee10b7b0d711d3",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "G-LXNXGN89YD"
};

const requiredKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId"
];

export const isFirebaseConfigured = requiredKeys.every(
  (key) => Boolean((firebaseConfig as any)[key])
);

export const missingKeys = requiredKeys.filter(
  (key) => !Boolean((firebaseConfig as any)[key])
);

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export { app };

console.log("Firebase projectId usado pelo app:", firebaseConfig.projectId);
console.log("Firebase configurado?", isFirebaseConfigured);
console.log("db existe?", !!db);
console.log("auth existe?", !!auth);

if (!isFirebaseConfigured) {
  console.log("Campos ausentes:", missingKeys);
}

