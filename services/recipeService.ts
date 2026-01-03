import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, RECIPES_COLLECTION, authReady } from '../firebase';
import { Recipe } from '../types';

export const fetchAllRecipes = async (): Promise<{ data: Recipe[], isLive: boolean, error?: string }> => {
  try {
    // 1. Wait for Auth to resolve (Anonymous sign-in)
    const user = await authReady;
    if (!user) {
      return { data: [], isLive: false, error: "Firebase Auth failed to initialize." };
    }

    // 2. Query exactly what the security rules allow: 
    // Fetch recipes belonging to the current session's UID
    const q = query(
      collection(db, RECIPES_COLLECTION), 
      where('ownerId', '==', user.uid)
    );
    
    const querySnapshot = await getDocs(q);
    const recipes: Recipe[] = [];
    
    querySnapshot.forEach((doc) => {
      recipes.push({ id: doc.id, ...doc.data() } as Recipe);
    });

    return { 
      data: recipes, 
      isLive: true, 
      error: recipes.length === 0 ? `Connected! No recipes found for your ID: ${user.uid}. Ensure you have data in Firestore with this ownerId.` : undefined 
    };
    
  } catch (error: any) {
    console.error("Firestore Error:", error);
    return { 
      data: [], 
      isLive: false, 
      error: `[${error.code}] ${error.message}` 
    };
  }
};