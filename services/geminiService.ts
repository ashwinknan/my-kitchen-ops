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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are a professional chef. I need to cook ${recipes.length} dishes with ${cooks} people and ${stoves} stove burners.
    
    RECIPES:
    ${recipes.map(r => `- ${r.dishName}: ${JSON.stringify(r.steps)}`).join('\n')}
    
    TASK:
    - Create a step-by-step cooking timeline.
    - Group chopping/prep at the start.
    - Assign each step to a cook (1 to ${cooks}).
    - Max ${stoves} stove burners at any time.
    - Return a logical timeline where 'timeOffset' is the start minute.
    
    Return exactly this JSON structure:
    {
      "timeline": [{"timeOffset": number, "action": string, "involvedRecipes": string[], "assignees": number[], "isParallel": boolean}],
      "totalDuration": number,
      "criticalWarnings": string[]
    }
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

  const jsonStr = response.text?.trim() || "{}";
  return JSON.parse(jsonStr) as OptimizedSchedule;
};

/**
 * Suggests a meal plan based on inventory constraints using Gemini 3 Flash for efficiency.
 */
export const suggestMealPlan = async (
    allRecipes: Recipe[],
    fridgeVeggies: string,
    days: number
  ): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
      Recipes: ${allRecipes.map(r => `${r.dishName} (${r.category})`).join(', ')}
      Fridge has: "${fridgeVeggies}"
      
      Pick recipes for a ${days}-day plan (Breakfast, Lunch/Dinner, Snack). 
      ONLY use the exact names from the list above. 
      Return names only, separated by commas.
    `;
  
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });
  
    const text = response.text || "";
    return text.split(',').map(s => s.trim()).filter(s => s.length > 0);
  };