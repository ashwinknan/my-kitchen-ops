
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, RECIPES_COLLECTION, USER_UID, authReady } from '../firebase';
import { Recipe } from '../types';

export const fetchAllRecipes = async (): Promise<{ data: Recipe[], isLive: boolean, error?: string }> => {
  try {
    // 1. Wait for Auth to resolve (Anonymous sign-in)
    const user = await authReady;
    if (!user) {
      return { data: [], isLive: false, error: "Firebase Auth failed to initialize." };
    }

    // 2. Query exactly what the security rules allow: 
    // "Read if resource.data.ownerId == USER_UID"
    // Note: Firestore requires the query filter to match the security rule exactly.
    const q = query(
      collection(db, RECIPES_COLLECTION), 
      where('ownerId', '==', USER_UID)
    );
    
    const querySnapshot = await getDocs(q);
    const recipes: Recipe[] = [];
    
    querySnapshot.forEach((doc) => {
      recipes.push({ id: doc.id, ...doc.data() } as Recipe);
    });

    return { 
      data: recipes, 
      isLive: true, 
      error: recipes.length === 0 ? `Connected! But no recipes found for ownerId: ${USER_UID}` : undefined 
    };
    
  } catch (error: any) {
    console.error("Firestore Error:", error);
    // This will catch the 'permission-denied' error specifically
    return { 
      data: [], 
      isLive: false, 
      error: `[${error.code}] ${error.message}` 
    };
  }
};
