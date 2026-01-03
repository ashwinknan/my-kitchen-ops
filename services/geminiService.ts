import { GoogleGenAI, Type } from "@google/genai";
import { Recipe, OptimizedSchedule } from "../types";

/**
 * Optimizes cooking operations using Gemini 3 Pro for complex resource interleaving.
 */
export const optimizeCookingOps = async (
  recipes: Recipe[], 
  cooks: number, 
  stoves: number
): Promise<OptimizedSchedule> => {
  // Always initialize with the named parameter apiKey and use the process.env.API_KEY directly
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are a professional kitchen operations consultant. 
    I have ${recipes.length} recipes to cook at the same time.
    Available Resources: ${cooks} cooks and ${stoves} stove burners.
    
    RECIPE DATA FROM DATABASE (Use these exact steps and durations):
    ${recipes.map(r => `- DISH: ${r.dishName}\n  STEPS: ${JSON.stringify(r.steps)}`).join('\n')}
    
    TASK:
    1. Create an interleaved schedule using the EXACT steps provided above. 
    2. Group preparation tasks (chopping, washing) together at the beginning.
    3. Maximize parallel work by assigning different steps to available cooks (IDs 1 to ${cooks}).
    4. Ensure no more than ${stoves} steps using a 'stove' burner happen at once.
    5. Return a logical timeline where 'timeOffset' is the minute each task starts.
    
    Return the schedule in JSON format.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          timeline: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                timeOffset: { type: Type.NUMBER },
                action: { type: Type.STRING },
                involvedRecipes: { type: Type.ARRAY, items: { type: Type.STRING } },
                assignees: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                resourceUsed: { type: Type.STRING },
                isParallel: { type: Type.BOOLEAN }
              },
              required: ["timeOffset", "action", "involvedRecipes", "assignees", "isParallel"]
            }
          },
          totalDuration: { type: Type.NUMBER },
          criticalWarnings: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["timeline", "totalDuration", "criticalWarnings"]
      }
    }
  });

  // Extract text directly from the response object
  const jsonStr = response.text?.trim() || "{}";
  return JSON.parse(jsonStr) as OptimizedSchedule;
};

/**
 * Suggests a meal plan based on inventory constraints using Gemini 3 Pro.
 */
export const suggestMealPlan = async (
    allRecipes: Recipe[],
    fridgeVeggies: string,
    days: number
  ): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
      Database Recipes:
      ${allRecipes.map(r => `- ${r.dishName} (${r.category})`).join('\n')}
      
      Fridge Contents: "${fridgeVeggies}"
      
      Suggest a ${days}-day plan (Breakfast, Lunch/Dinner, Snack for each day). 
      ONLY use dishNames found in the list above. 
      Return as a comma-separated list of EXACT dish names.
    `;
  
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt
    });
  
    const text = response.text || "";
    return text.split(',').map(s => s.trim()).filter(s => s.length > 0);
  };