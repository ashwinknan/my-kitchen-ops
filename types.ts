
export type RecipeCategory = 'breakfast' | 'lunch/dinner' | 'evening snack';

export interface Ingredient {
  name: string;
  kitchen: { value: number; unit: string };
  shopping: { value: number; unit: string };
}

export interface Step {
  instruction: string;
  durationMinutes: number;
}

export interface Recipe {
  id: string;
  dishName: string;
  category: RecipeCategory;
  variations: string[];
  servings: number;
  ingredients: Ingredient[];
  steps: Step[];
  totalTimeMinutes: number;
  ownerId: string;
}

export interface MealPlanDay {
  date: string;
  breakfast?: Recipe;
  lunchDinner?: Recipe;
  snack?: Recipe;
}

export interface OptimizedStep {
  timeOffset: number;
  action: string;
  involvedRecipes: string[];
  assignees: number[];
  resourceUsed?: string;
  isParallel: boolean;
}

export interface OptimizedSchedule {
  timeline: OptimizedStep[];
  totalDuration: number;
  criticalWarnings: string[];
}
