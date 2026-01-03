import { GoogleGenAI, Type } from "@google/genai";
import { Recipe, OptimizedSchedule } from "../types";

/**
 * Robustly retrieves the API key from the environment.
 */
const getApiKey = () => {
  const key = (window as any).process?.env?.API_KEY || process.env.API_KEY || "";
  return key;
};

/**
 * Helper to robustly extract JSON from a model response string.
 */
const extractJson = (text: string) => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return match[0];
    return text;
  } catch (e) {
    return text;
  }
};

/**
 * Optimizes cooking operations using Gemini 3 Pro.
 */
export const optimizeCookingOps = async (
  recipes: Recipe[], 
  cooks: number, 
  stoves: number
): Promise<OptimizedSchedule> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });

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
    
    Return EXACTLY this JSON structure:
    {
      "timeline": [{"timeOffset": number, "action": string, "involvedRecipes": string[], "assignees": number[], "isParallel": boolean}],
      "totalDuration": number,
      "criticalWarnings": string[]
    }
  `;

  try {
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

    const jsonStr = extractJson(response.text || "{}");
    return JSON.parse(jsonStr) as OptimizedSchedule;
  } catch (error: any) {
    console.error("Gemini Error:", error);
    if (error.message?.includes("Requested entity was not found")) {
      throw new Error("Project mismatch. Ensure your API key is from a project with billing enabled.");
    }
    throw new Error(error.message || "Failed to generate cooking plan.");
  }
};

/**
 * Suggests a meal plan using Gemini 3 Flash.
 */
export const suggestMealPlan = async (
    allRecipes: Recipe[],
    fridgeVeggies: string,
    days: number
  ): Promise<string[]> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      Recipes: ${allRecipes.map(r => `${r.dishName} (${r.category})`).join(', ')}
      Fridge has: "${fridgeVeggies}"
      
      Pick recipes for a ${days}-day plan (Breakfast, Lunch/Dinner, Snack). 
      ONLY use the exact names from the list above. 
      Return names only, separated by commas.
    `;
  
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
    
      const text = response.text || "";
      return text.split(',').map(s => s.trim()).filter(s => s.length > 0);
    } catch (error: any) {
      console.error("Gemini Error:", error);
      throw new Error(error.message || "Failed to suggest recipes.");
    }
  };