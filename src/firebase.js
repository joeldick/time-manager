import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { GoogleAuthProvider } from 'firebase/auth';

// Note: API key is loaded from environment variable for security
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "gimmetime.firebaseapp.com",
  projectId: "gimmetime",
  storageBucket: "gimmetime.firebasestorage.app",
  messagingSenderId: "306905926127",
  appId: "1:306905926127:web:f6f0a252d1a2d0e0c38e1a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
