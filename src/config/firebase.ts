import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Fail fast with an actionable message when the environment is misconfigured,
// instead of letting the Firebase SDK throw a cryptic runtime error.
const missingKeys = (Object.entries(firebaseConfig) as [string, string | undefined][])
  .filter(([, value]) => !value)
  .map(([key]) => `VITE_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);

if (missingKeys.length > 0) {
  throw new Error(
    `Missing Firebase environment variables: ${missingKeys.join(', ')}. ` +
      'Copy .env.example to .env and fill in the values from the Firebase console.'
  );
}

// Initialize Firebase (guard against duplicate init on HMR)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// Connect to Firebase emulators in development
if (import.meta.env.DEV) {
  // Uncomment the lines below to use local emulators
  // connectFunctionsEmulator(functions, 'localhost', 5001);
  // connectFirestoreEmulator(db, 'localhost', 8080);
  // connectAuthEmulator(auth, 'http://localhost:9099');
}
