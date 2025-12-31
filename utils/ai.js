const { GoogleGenerativeAI } = require('@google/generative-ai');
const { OpenAI } = require('openai');
const mime = require('mime');
const fs = require('fs');
require('dotenv').config();

// Initialize AI providers
const genAI = new GoogleGenerativeAI(process.env.GEMINI_TOKEN);

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://silverwolf.dev/',
    'X-Title': 'Silverwolf',
  },
});

// Load personas configuration
const personasData = require('../data/aiPersonas.json');

const personasConfig = personasData.personasConfig || personasData;

/**
 * Resolves the appropriate AI persona based on message content
 * @param {string} messageContent - The message content to analyze
 * @returns {object} The resolved persona configuration
 */
async function resolvePersona(messageContent = '') {
  const contentLower = messageContent.toLowerCase();
  const personas = personasConfig.personas || [];
  const foundPersona = personas.find(
    (p) => Array.isArray(p.triggers)
      && p.triggers.some((t) => contentLower.includes(String(t).toLowerCase())),
  );

  if (foundPersona) {
    if (foundPersona.systemPromptFile) {
      const systemPromptFile = await new Promise((resolve, reject) => {
        fs.readFile(foundPersona.systemPromptFile, 'utf8', (err, data) => {
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

async function getPersonaByName(name) {
  const personas = personasConfig.personas || [];
  return personas.find((p) => p.name.toLowerCase() === name.toLowerCase());
}

/**
 * Generates content (text and/or images) from the specified AI provider and model.
 * @param {object} options - The generation options.
 * @param {string} options.provider - The AI provider ('openrouter' or 'gemini').
 * @param {string} options.model - The model to use for generation.
 * @param {string} options.systemPrompt - The system instruction/prompt.
 * @param {string} options.prompt - The user's prompt.
 * @param {string[]} [options.responseModalities] - Optional array of desired response modalities (e.g., ['IMAGE', 'TEXT']).
 * @returns {Promise<{text: string, images: Array<{attachment: Buffer, name: string}>}>} - An object containing generated text and an array of image attachments.
 */
async function generateContent({
  provider, model, systemPrompt, prompt, // responseModalities parameter is no longer directly used for switching
}) {
  if (provider === 'openrouter') {
    const completion = await openrouter.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4000,
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

    const modelClientOptions = {
      model: currentGeminiModel,
    };

    if (shouldUseSystemInstruction) {
      modelClientOptions.systemInstruction = systemPrompt;
    }

    const modelClient = genAI.getGenerativeModel(modelClientOptions);

    const contents = [
      {
        role: 'user',
        parts: [{ text: processedPrompt }],
      },
    ];

    const generateContentStreamOptions = {
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
    const imageAttachments = [];
    let fileIndex = 0;

    // eslint-disable-next-line no-restricted-syntax
    for await (const chunk of resultObject.stream) {
      if (chunk.candidates?.[0]?.content?.parts) {
        // eslint-disable-next-line no-loop-func
        chunk.candidates[0].content.parts.forEach((part) => {
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
 * @returns {GoogleGenerativeAI} The Gemini AI instance
 */
function getGeminiAI() {
  return genAI;
}

/**
 * Gets the OpenRouter client for direct usage
 * @returns {OpenAI} The OpenRouter client instance
 */
function getOpenRouterClient() {
  return openrouter;
}

module.exports = {
  resolvePersona,
  generateContent,
  getGeminiAI,
  getOpenRouterClient,
  getPersonaByName,
};
