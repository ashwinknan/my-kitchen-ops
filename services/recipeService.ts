
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, RECIPES_COLLECTION, USER_UID, authReady } from '../firebase';
import { Recipe } from '../types';

export const fetchAllRecipes = async (): Promise<{ data: Recipe[], isLive: boolean }> => {
  try {
    // Wait for auth to be ready to avoid "Insufficient Permissions" on initial load
    await authReady;

    // Attempt 1: Targeted query
    const q = query(collection(db, RECIPES_COLLECTION), where('ownerId', '==', USER_UID));
    const querySnapshot = await getDocs(q);
    
    const recipes: Recipe[] = [];
    if (!querySnapshot.empty) {
      querySnapshot.forEach((doc) => {
        recipes.push({ id: doc.id, ...doc.data() } as Recipe);
      });
      return { data: recipes, isLive: true };
    }

    // Attempt 2: Fallback broad fetch (handles missing indexes)
    const allDocs = await getDocs(collection(db, RECIPES_COLLECTION));
    const filtered = allDocs.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Recipe))
      .filter(r => r.ownerId === USER_UID);
    
    if (filtered.length > 0) return { data: filtered, isLive: true };

    // If truly empty but no error, use mock
    return { data: getMockRecipes(), isLive: false };
    
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      console.error("CRITICAL: Firestore Permission Denied. Ensure rules allow read access and 'Anonymous Auth' is enabled.");
    } else {
      console.warn("Firestore fetch error:", error.message);
    }
    // Return mock data so the app remains usable
    return { data: getMockRecipes(), isLive: false };
  }
};

function getMockRecipes(): Recipe[] {
  return [
    {
      id: 'mock-1',
      dishName: 'Avocado Toast',
      category: 'breakfast',
      variations: ['Spicy', 'With Egg'],
      servings: 2,
      ingredients: [
        { name: 'Bread', kitchen: { value: 2, unit: 'slices' }, shopping: { value: 1, unit: 'loaf' } },
        { name: 'Avocado', kitchen: { value: 1, unit: 'pcs' }, shopping: { value: 2, unit: 'pcs' } }
      ],
      steps: [
        { instruction: 'Toast bread slices in toaster', durationMinutes: 3 },
        { instruction: 'Mash avocado with lime and salt', durationMinutes: 2 },
        { instruction: 'Spread mash on toast and top with chili flakes', durationMinutes: 1 }
      ],
      totalTimeMinutes: 6,
      ownerId: USER_UID
    },
    {
      id: 'mock-2',
      dishName: 'Chicken Stir Fry',
      category: 'lunch/dinner',
      variations: ['Tofu option', 'Extra Garlic'],
      servings: 4,
      ingredients: [
        { name: 'Chicken Breast', kitchen: { value: 500, unit: 'g' }, shopping: { value: 1, unit: 'kg' } },
        { name: 'Broccoli', kitchen: { value: 1, unit: 'head' }, shopping: { value: 1, unit: 'head' } },
        { name: 'Soy Sauce', kitchen: { value: 50, unit: 'ml' }, shopping: { value: 1, unit: 'bottle' } }
      ],
      steps: [
        { instruction: 'Chop chicken into cubes and slice broccoli', durationMinutes: 10 },
        { instruction: 'Sear chicken in hot wok with oil', durationMinutes: 7 },
        { instruction: 'Add broccoli and soy sauce, stir fry until tender', durationMinutes: 5 }
      ],
      totalTimeMinutes: 22,
      ownerId: USER_UID
    },
    {
        id: 'mock-3',
        dishName: 'Berry Smoothie Bowl',
        category: 'breakfast',
        variations: ['Vegan', 'High Protein'],
        servings: 1,
        ingredients: [
          { name: 'Frozen Berries', kitchen: { value: 150, unit: 'g' }, shopping: { value: 1, unit: 'bag' } },
          { name: 'Banana', kitchen: { value: 1, unit: 'pcs' }, shopping: { value: 1, unit: 'bunch' } },
          { name: 'Almond Milk', kitchen: { value: 100, unit: 'ml' }, shopping: { value: 1, unit: 'carton' } }
        ],
        steps: [
          { instruction: 'Blend frozen berries, banana, and milk until smooth', durationMinutes: 4 },
          { instruction: 'Pour into a bowl and add toppings', durationMinutes: 2 }
        ],
        totalTimeMinutes: 6,
        ownerId: USER_UID
      }
  ];
}
