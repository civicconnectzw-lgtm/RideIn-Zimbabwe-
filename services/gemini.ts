
import { GoogleGenAI, Type, Modality } from "@google/genai";

/**
 * GEMINI SERVICE - Tactical Zimbabwe Edition
 * Optimized for local economy with Search and Maps Grounding.
 */
export class GeminiService {
  private ai() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  /**
   * parseDispatchPrompt: Uses Gemini 3 Flash for lightning-fast structural extraction.
   */
  async parseDispatchPrompt(prompt: string, location?: { lat: number, lng: number }): Promise<any> {
    const ai = this.ai();
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `USER_REQUEST: "${prompt}"\nGRID_COORDS: ${location?.lat || -17.82}, ${location?.lng || 31.03}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              pickup: { type: Type.STRING, description: "Landmark or address for pickup" },
              dropoff: { type: Type.STRING, description: "Landmark or address for destination" },
              category: { type: Type.STRING, enum: ["Standard", "Premium", "Luxury"], description: "Vehicle class" },
              type: { type: Type.STRING, enum: ["ride", "freight"], description: "Mission type" }
            },
            required: ["pickup", "dropoff", "category", "type"]
          },
          systemInstruction: `You are the RideIn Zimbabwe Tactical Dispatcher. 
          Extract transport parameters from natural language. 
          Identify Zimbabwean landmarks (e.g., Sam Levy's, Joina City, Copa Cabana). 
          Default to 'Standard' category unless luxury/premium is implied. 
          Return ONLY valid JSON.`
        }
      });

      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("[Gemini] Tactical Parse Failed:", error);
      return null;
    }
  }

  /**
   * explainFare: Justifies pricing using Google Search Grounding to check live fuel/traffic.
   */
  async explainFare(details: { pickup: string, dropoff: string, price: string }): Promise<string> {
    const ai = this.ai();
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Explain a $${details.price} fare from ${details.pickup} to ${details.dropoff} in Zimbabwe.`,
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: "You are the Fare Guard. Use Google Search to cross-reference current Zim fuel prices and traffic. Be brief, authoritative, and transparent."
        }
      });
      return response.text || "Estimated fare based on local market distance.";
    } catch (error) {
      return "Current market average for this tactical distance.";
    }
  }

  /**
   * scout: Hyper-local landmark discovery using Gemini 2.5 Flash Maps Grounding.
   */
  async scout(query: string, location?: { lat: number, lng: number }): Promise<{ text: string, grounding: any[] }> {
    const ai = this.ai();
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: query,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: location?.lat || -17.8252,
                longitude: location?.lng || 31.0335
              }
            }
          },
          systemInstruction: "You are RideIn Scout. Use Google Maps to find taxi ranks, landmarks, or facilities in Zimbabwe. Always provide URIs."
        }
      });

      return {
        text: response.text || "Scanning area...",
        grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
      };
    } catch (error) {
      return { text: "Scout uplink offline.", grounding: [] };
    }
  }
}

export const geminiService = new GeminiService();
