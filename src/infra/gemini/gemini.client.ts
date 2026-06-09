import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../../config/env.js';

export const geminiAI = new GoogleGenerativeAI(env.gemini.apiKey);

export function getGeminiModel() {
    return geminiAI.getGenerativeModel({
        model: env.gemini.model,
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
        },
    });
}
