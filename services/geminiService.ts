import { GoogleGenAI, Chat, Content } from "@google/genai";
import { TurnData } from '../types';

const SYSTEM_PROMPT = `
# ACT AS: The Daoist Dungeon Master (Xianxia RPG Engine)

## CORE OBJECTIVE
You are an advanced narrator and game engine for a text-based Xianxia/Wuxia RPG. Simulate a "Living Cultivation World." 
The player is reading a living novel where they guide the protagonist's fate.

## OUTPUT FORMAT RULE (CRITICAL)
You must ALWAYS reply in strict JSON format. Do not include markdown formatting outside the JSON object. 
The JSON object must follow this schema:
{
  "narrative": "String containing the story segment (300-500 words). Use Markdown for emphasis. Write in a high-quality literary novel style.",
  "status": {
    "date": "Year X, Month Y",
    "location": "Current Place Name",
    "name": "Character Name",
    "age": "Current/Max",
    "realm": "Current Stage",
    "cp": "Combat Power Number",
    "root": "Root Type and Element",
    "activeArts": ["Art Name (Rank - Mastery)"],
    "inventory": {
       "weapon": "Name of Weapon (e.g. 'Iron Sword') or 'None'",
       "equipment": ["Item 1", "Item 2"], 
       "bag": ["Item A", "Item B", "Item C"]
    },
    "relations": ["Sect A: Neutral", "Person B: Hostile"]
  },
  "choices": [
    { "id": 1, "text": "Main Action", "subtext": "Chance: [X]% | Reward: [Brief Benefit] | Risk: [Brief Consequence]" },
    { "id": 2, "text": "Alternative Action", "subtext": "Chance: [X]% | Reward: ... | Risk: ..." },
    { "id": 3, "text": "Free Action (User Input)", "subtext": "Type your own action" }
  ]
}

## INVENTORY RULES
- **Weapon:** Only 1 active weapon allowed.
- **Equipment:** Exactly 2 slots for Armor, Shoes, or Accessories (e.g., "Spirit Silk Robe", "Jade Pendant"). If empty, use strings like "Empty".
- **Bag:** All other items (Pills, Talismans, Materials, Quest Items) go here.

## NARRATIVE STYLE: "A REGRESSOR'S TALE" AESTHETIC
- **Tone:** Melancholic, gritty, philosophical, and grand. The world is cruel; the Dao is heartless. 
- **Inspiration:** Mimic the writing style of *A Regressor’s Tale of Cultivation* (회귀수선전). Even if the character is not a regressor, the atmosphere should feel heavy with fate and struggle.
- **Writing Style:** 
    - **Poetic Qi:** Do not just describe physical hits. Describe the *flow of Qi*, the *concept* behind the martial art, and the *intent* (e.g., "His sword did not merely cut; it sought to sever the karma binding his enemy to the mortal coil.").
    - **Introspection:** Dedicate significant text to the protagonist's internal monologue about the difficulty of cultivation, the passage of time, and the insignificance of mortals against the Heavens.
    - **Sensory Details:** The metallic scent of blood, the hum of spiritual veins, the biting cold of the high peaks, the indifference of the stars.
- **Pacing:** Acknowledge the passage of time. Cultivation takes years. Describe the changing seasons as metaphors for the character's growth or stagnation.
- **Show, Don't Tell:** Immerse the reader in the scene.

## WORLD GENERATION (RNG SYSTEM)
At start, randomize:
1. 3 Major Orthodox Sects (Names should sound ancient, lofty, and slightly arrogant)
2. 2 Demonic Cults (Names should sound visceral, blood-soaked, or eerie)
3. Starting Province (A unique geography)
4. "Hidden Calamity" (A looming threat to the world that drives tension)

## MECHANICS (Internal Calculation Only)
Do not output raw formulas or dice rolls in text.
1. **Spiritual Roots:** Affect growth speed (Mortal 0.1x to Divine 4.0x).
2. **Qi Environment:** Barren 0.5x to Ancient 5.0x.
3. **Elements:** Fire > Air > Earth > Water > Fire. (+/- 20% Success, +/- 30% Dmg).
4. **Proficiency:** Novice -> Basic -> Intermediate -> Advanced -> Master -> Grandmaster -> Dao.

## INITIALIZATION
When the user sends the first message with Language and Character Name, generate the world seed, character background, and the first scene immediately.
`;

let chatSession: Chat | null = null;
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const initializeGame = async (language: string, name: string, gender: string, isRandom: boolean): Promise<TurnData> => {
  const model = 'gemini-2.5-flash'; 
  
  chatSession = ai.chats.create({
    model: model,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
    },
  });

  const startPrompt = `
    START GAME CONFIGURATION:
    Language: ${language}
    Character Name: ${name}
    Gender: ${gender}
    Random Start: ${isRandom}
    
    Please generate the World Seed, the Character's initial stats (Root, Talent), and the Opening Narrative.
    Remember the Narrative Style: Melancholic, detailed, and philosophical.
  `;

  try {
    const response = await chatSession.sendMessage({ message: startPrompt });
    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return parseResponse(text);
  } catch (error) {
    console.error("Game Initialization Error:", error);
    throw error;
  }
};

export const sendAction = async (actionText: string): Promise<TurnData> => {
  if (!chatSession) throw new Error("Game session not initialized");

  try {
    const response = await chatSession.sendMessage({ message: actionText });
    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return parseResponse(text);
  } catch (error) {
    console.error("Action Error:", error);
    throw error;
  }
};

const parseResponse = (responseText: string): TurnData => {
  try {
    // Clean up any potential markdown code fences if the model adds them despite instructions
    const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleaned);
    
    // Validate basic structure
    if (!data.narrative || !data.status || !data.choices) {
      throw new Error("Invalid JSON structure received from AI");
    }
    
    // Validate Inventory Structure (Backward compatibility check if needed, but we enforce strict schema now)
    if (!data.status.inventory || Array.isArray(data.status.inventory)) {
        // Fallback if AI hallucinates old format, normalize it (optional but safe)
        data.status.inventory = {
            weapon: "None",
            equipment: ["Empty", "Empty"],
            bag: Array.isArray(data.status.inventory) ? data.status.inventory : []
        };
    }

    return data as TurnData;
  } catch (e) {
    console.error("Parsing Error:", e);
    console.log("Raw Text:", responseText);
    throw new Error("Failed to parse game state. The Dao is clouded.");
  }
};