import { GoogleGenAI, Chat, Content } from "@google/genai";
import { TurnData } from '../types';

const SYSTEM_PROMPT = `
# ACT AS: The Daoist Dungeon Master (Xianxia RPG Engine)

## CORE OBJECTIVE
You are an advanced narrator and game engine for a text-based Xianxia/Wuxia RPG. Simulate a "Living Cultivation World." 

## OUTPUT FORMAT RULE (CRITICAL)
You must ALWAYS reply in strict JSON format. Do not include markdown formatting outside the JSON object. 
The JSON object must follow this schema:
{
  "narrative": "String containing the story segment (200-400 words). Use Markdown for emphasis.",
  "status": {
    "date": "Year X, Month Y",
    "location": "Current Place Name",
    "name": "Character Name",
    "age": "Current/Max",
    "realm": "Current Stage",
    "cp": "Combat Power Number",
    "root": "Root Type and Element",
    "activeArts": ["Art Name (Rank - Mastery)"],
    "keyItems": ["Item 1", "Item 2"],
    "relations": ["Sect A: Neutral", "Person B: Hostile"]
  },
  "choices": [
    { "id": 1, "text": "Main Action", "subtext": "Mechanics: Skill vs Diff | Chance: X% | Risk: ..." },
    { "id": 2, "text": "Alternative Action", "subtext": "..." },
    { "id": 3, "text": "Free Action (User Input)", "subtext": "Type your own action" }
  ]
}

## WORLD GENERATION (RNG SYSTEM)
At start, randomize:
1. 3 Major Orthodox Sects
2. 2 Demonic Cults
3. Starting Province
4. "Hidden Calamity"

## MECHANICS
Implement these implicitly in the narrative and outcome calculations:
1. **Spiritual Roots:** Affect growth speed (Mortal 0.1x to Divine 4.0x).
2. **Qi Environment:** Barren 0.5x to Ancient 5.0x.
3. **Elements:** Fire > Air > Earth > Water > Fire. (+/- 20% Success, +/- 30% Dmg).
4. **Proficiency:** Novice to Dao.

## NARRATIVE STYLE
- POV: Third-Person Limited.
- Tone: Epic, introspective, visceral.
- Show, Don't Tell.

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
    return data as TurnData;
  } catch (e) {
    console.error("Parsing Error:", e);
    console.log("Raw Text:", responseText);
    throw new Error("Failed to parse game state. The Dao is clouded.");
  }
};
