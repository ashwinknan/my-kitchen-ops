
import { GoogleGenAI, Type } from "@google/genai";
import { Recipe, OptimizedSchedule } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const optimizeCookingOps = async (
  recipes: Recipe[], 
  cooks: number, 
  stoves: number
): Promise<OptimizedSchedule> => {
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
    model: 'gemini-3-flash-preview',
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
                timeOffset: { type: Type.NUMBER, description: "Minutes from start" },
                action: { type: Type.STRING },
                involvedRecipes: { type: Type.ARRAY, items: { type: Type.STRING } },
                assignees: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "Cook ID (1 to N)" },
                resourceUsed: { type: Type.STRING, description: "e.g., Stove, Prep Station, Oven" },
                isParallel: { type: Type.BOOLEAN, description: "True if another cook is working simultaneously" }
              },
              required: ["timeOffset", "action", "involvedRecipes", "assignees", "isParallel"]
            }
          },
          totalDuration: { type: Type.NUMBER, description: "Total time from start to finish" },
          criticalWarnings: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Note any resource bottlenecks" }
        },
        required: ["timeline", "totalDuration", "criticalWarnings"]
      }
    }
  });

  return JSON.parse(response.text) as OptimizedSchedule;
};

export const suggestMealPlan = async (
    allRecipes: Recipe[],
    fridgeVeggies: string,
    days: number
  ): Promise<string[]> => {
    const prompt = `
      Database Recipes:
      ${allRecipes.map(r => `- ${r.dishName} (${r.category})`).join('\n')}
      
      Fridge Contents: "${fridgeVeggies}"
      
      Suggest a ${days}-day plan (Breakfast, Lunch/Dinner, Snack for each day). 
      ONLY use dishNames found in the list above. 
      Return as a comma-separated list of EXACT dish names.
    `;
  
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });
  
    return response.text.split(',').map(s => s.trim());
  };
