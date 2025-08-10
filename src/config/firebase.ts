// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validate required environment variables
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !import.meta.env[envVar]);

if (missingEnvVars.length > 0) {
  console.warn('Missing required Firebase environment variables:', missingEnvVars);
  console.warn('Please check your .env file and ensure all Firebase config values are set.');
  console.warn('The app will continue with localStorage-only functionality until Firebase is configured.');
}

// Initialize Firebase only if all required config is present
let app: any = null;
let auth: any = null;
let db: any = null;
let analytics: any = null;

try {
  if (missingEnvVars.length === 0) {
    // Initialize Firebase
    app = initializeApp(firebaseConfig);

    // Initialize Firebase Authentication and get a reference to the service
    auth = getAuth(app);

    // Initialize Cloud Firestore and get a reference to the service
    db = getFirestore(app);

    // Initialize Analytics (optional)
    analytics = typeof window !== 'undefined' && import.meta.env.VITE_FIREBASE_MEASUREMENT_ID 
      ? getAnalytics(app) 
      : null;
    // Connect to emulators in development (optional)
    if (process.env.NODE_ENV === 'development') {
      // Uncomment these lines if you want to use Firebase emulators for local development
      // connectAuthEmulator(auth, 'http://localhost:9099');
      // connectFirestoreEmulator(db, 'localhost', 8080);
    }
  } else {
    console.warn('Firebase not initialized due to missing environment variables. Using localStorage fallback.');
  }
} catch (error) {
  console.error('Failed to initialize Firebase:', error);
  console.warn('Falling back to localStorage-only functionality.');
}

// Export Firebase services (may be null if not initialized)
export { auth, db, analytics };
export default app;