
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDPzDlzh-OUhXszAGJqkVDMgtULKqmuqgk",
  authDomain: "cooking-ops.firebaseapp.com",
  projectId: "cooking-ops",
  storageBucket: "cooking-ops.firebasestorage.app",
  messagingSenderId: "24169553276",
  appId: "1:24169553276:web:649431c1d2eb94bf9c58f9"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Global state for auth initialization
let authInitialized = false;
let authError: string | null = null;

export const authReady = new Promise<User | null>((resolve) => {
  onAuthStateChanged(auth, (user) => {
    authInitialized = true;
    resolve(user);
  });
  
  // Also resolve if anonymous sign-in fails specifically
  signInAnonymously(auth).catch((err) => {
    console.error("Firebase Anonymous Auth failed:", err.code, err.message);
    authError = err.code;
    // Resolve with null so the app can continue to the error UI
    if (!authInitialized) resolve(null);
  });
});

export const getAuthError = () => authError;
export const RECIPES_COLLECTION = 'recipes';
export const USER_UID = 'kg6Lv5lXacPqbWsjZAYr0WrEx0e2';
