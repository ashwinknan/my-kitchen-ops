
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

// A promise that resolves when we have a valid auth state
export const authReady = new Promise<User | null>((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    console.log("Firebase Auth State Changed:", user?.uid || "Not Authenticated");
    resolve(user);
    // Note: We don't unsubscribe immediately to allow UI to react to changes if needed
  });
});

// Auto-trigger anonymous sign-in for the Ops app
signInAnonymously(auth).catch((err) => {
  console.error("Firebase Anonymous Auth failed:", err.message);
});

export const RECIPES_COLLECTION = 'recipes';
export const USER_UID = 'kg6Lv5lXacPqbWsjZAYr0WrEx0e2';
