import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from 'openai';
import mime from 'mime';
import fs from 'fs';
// Note: Bun automatically reads .env files

// Initialize AI providers
const genAI = new GoogleGenerativeAI(process.env.GEMINI_TOKEN!);

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://silverwolf.dev/',
    'X-Title': 'Silverwolf',
  },
});

// Load personas configuration
// eslint-disable-next-line import/first
import personasData from '../data/aiPersonas.json';

const personasConfig: any = (personasData as any).personasConfig || personasData;

export interface Persona {
  name: string;
  provider: string;
  model: string;
  systemPrompt?: string;
  systemPromptFile?: string;
  triggers?: string[];
  responseModalities?: string[];
  avatarURL?: string;
}

interface HistoryEntry {
  role: string;
  message: string;
}

interface GenerateContentOptions {
  provider: string;
  model: string;
  systemPrompt: string;
  prompt: string;
  history?: HistoryEntry[];
}

interface ImageAttachment {
  attachment: Buffer;
  name: string;
}

interface GenerateContentResult {
  text: string;
  images: ImageAttachment[];
}

/**
 * Resolves the appropriate AI persona based on message content
 */
async function resolvePersona(messageContent = ''): Promise<Persona> {
  const contentLower = messageContent.toLowerCase();
  const personas: Persona[] = personasConfig.personas || [];
  const foundPersona = personas.find(
    (p) => Array.isArray(p.triggers)
      && p.triggers.some((t) => contentLower.includes(String(t).toLowerCase())),
  );

  if (foundPersona) {
    if (foundPersona.systemPromptFile) {
      const systemPromptFile = await new Promise<string>((resolve, reject) => {
        fs.readFile(foundPersona.systemPromptFile!, 'utf8', (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
      foundPersona.systemPrompt = systemPromptFile;
    }
    return foundPersona;
  }

  const defaults = personasConfig.defaults || {};
  return {
    name: 'Default',
    provider: defaults.provider || 'gemini',
    model: defaults.model || 'gemini-3-flash-preview',
    systemPrompt: defaults.systemPrompt || 'You are a helpful AI assistant.',
    responseModalities: defaults.responseModalities || ['TEXT'],
  };
}

async function getPersonaByName(name: string): Promise<Persona | undefined> {
  const personas: Persona[] = personasConfig.personas || [];
  return personas.find((p) => p.name.toLowerCase() === name.toLowerCase());
}

/**
 * Generates content (text and/or images) from the specified AI provider and model.
 */
async function generateContent({
  provider, model, systemPrompt, prompt, history = [],
}: GenerateContentOptions): Promise<GenerateContentResult> {
  const nowUTC = `${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC`;
  // eslint-disable-next-line no-param-reassign
  systemPrompt = `[Current Time: ${nowUTC}] ${systemPrompt || ''}`;

  if (provider === 'openrouter') {
    // Map DB history rows → OpenAI message format (role: 'user' | 'assistant')
    const historyMessages = history.map((h) => ({
      role: (h.role === 'model' ? 'assistant' : h.role) as 'user' | 'assistant',
      content: h.message,
    }));

    const completion = await openrouter.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: prompt },
      ],
      max_tokens: 8192,
    });
    return { text: completion.choices?.[0]?.message?.content ?? '', images: [] };
  }

  if (provider === 'gemini') {
    const currentGeminiModel = model;
    let shouldUseSystemInstruction = true;
    let processedPrompt = prompt;

    if (currentGeminiModel === 'gemini-2.0-flash-preview-image-generation') {
      shouldUseSystemInstruction = false;
      processedPrompt = prompt.replace(/@imgen/g, '').trim();
    }

    const modelClientOptions: any = {
      model: currentGeminiModel,
    };

    if (shouldUseSystemInstruction) {
      modelClientOptions.systemInstruction = systemPrompt;
    }

    const modelClient = genAI.getGenerativeModel(modelClientOptions);

    // Map DB history rows → Gemini SDK format ({ role: 'user'|'model', parts: [{text}] })
    const geminiHistory = history
      .filter((h) => h.role === 'user' || h.role === 'model')
      .map((h) => ({
        role: h.role as 'user' | 'model',
        parts: [{ text: h.message }],
      }));

    // Gemini requires history to not start with a 'model' turn
    if (geminiHistory.length > 0 && geminiHistory[0].role === 'model') {
      geminiHistory.shift();
    }

    // For non-image models: use startChat with history, then sendMessage
    if (currentGeminiModel !== 'gemini-2.0-flash-preview-image-generation') {
      const chatSession = modelClient.startChat({
        history: geminiHistory,
      });
      const result = await chatSession.sendMessage(processedPrompt);
      const response = await result.response;
      const fullText = response.text();
      return { text: fullText, images: [] };
    }

    // Image-generation model: stateless generateContentStream (no history)
    const contents = [
      {
        role: 'user',
        parts: [{ text: processedPrompt }],
      },
    ];

    const generateContentStreamOptions: any = {
      contents,
    };

    if (currentGeminiModel === 'gemini-2.0-flash-preview-image-generation') {
      generateContentStreamOptions.generationConfig = {
        responseModalities: ['IMAGE', 'TEXT'],
      };
    }

    const resultObject = await modelClient.generateContentStream(
      generateContentStreamOptions,
    );

    let fullText = '';
    const imageAttachments: ImageAttachment[] = [];
    let fileIndex = 0;

    // eslint-disable-next-line no-restricted-syntax
    for await (const chunk of resultObject.stream) {
      if (chunk.candidates?.[0]?.content?.parts) {
        // eslint-disable-next-line no-loop-func
        chunk.candidates[0].content.parts.forEach((part: any) => {
          if (part.inlineData) {
            const { inlineData } = part;
            const fileExtension = mime.getExtension(inlineData.mimeType || 'image/png') || 'png';
            const buffer = Buffer.from(inlineData.data || '', 'base64');
            imageAttachments.push({
              attachment: buffer,
              name: `image_${fileIndex}.${fileExtension}`,
            });
            fileIndex += 1;
          } else if (part.text) {
            fullText += part.text;
          }
        });
      }
    }
    return { text: fullText, images: imageAttachments };
  }

  throw new Error(`Unknown provider: ${provider}`);
}

/**
 * Gets the Gemini AI instance for direct usage
 */
function getGeminiAI(): GoogleGenerativeAI {
  return genAI;
}

/**
 * Gets the OpenRouter client for direct usage
 */
function getOpenRouterClient(): OpenAI {
  return openrouter;
}

/**
 * Generates a short title for a conversation using OpenRouter.
 * Returns the title string on success, or null on failure.
 */
async function generateSessionTitle(userMessage: string, aiResponse: string): Promise<string | null> {
  const personas: Persona[] = personasConfig.personas || [];
  const persona = personas.find((p) => p.name === 'TitleGen');
  if (!persona) return null;

  try {
    const completion = await openrouter.chat.completions.create({
      model: persona.model,
      messages: [
        { role: 'system', content: persona.systemPrompt ?? '' },
        { role: 'user', content: `User: ${userMessage}\n\nAssistant: ${aiResponse}` },
      ],
      max_tokens: 64,
    });
    return completion.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

export {
  resolvePersona,
  generateContent,
  generateSessionTitle,
  getGeminiAI,
  getOpenRouterClient,
  getPersonaByName,
};
