import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, RECIPES_COLLECTION, authReady } from '../firebase';
import { Recipe } from '../types';

// The specific ownerId allowed for READ operations in security rules
const CMS_OWNER_ID = "kg6Lv5lXacPqbWsjZAYr0WrEx0e2";

export const fetchAllRecipes = async (): Promise<{ data: Recipe[], isLive: boolean, error?: string }> => {
  try {
    // 1. Wait for Auth to resolve (Anonymous sign-in)
    const user = await authReady;
    if (!user) {
      return { data: [], isLive: false, error: "Firebase Auth failed to initialize." };
    }

    // 2. Query exactly what the security rules allow: 
    // Fetch recipes belonging to the specific CMS owner ID
    const q = query(
      collection(db, RECIPES_COLLECTION), 
      where('ownerId', '==', CMS_OWNER_ID)
    );
    
    const querySnapshot = await getDocs(q);
    const recipes: Recipe[] = [];
    
    querySnapshot.forEach((doc) => {
      recipes.push({ id: doc.id, ...doc.data() } as Recipe);
    });

    return { 
      data: recipes, 
      isLive: true, 
      error: recipes.length === 0 ? `Connected as ${user.uid}! But no recipes found for ownerId: ${CMS_OWNER_ID}.` : undefined 
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