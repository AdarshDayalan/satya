import { GoogleGenerativeAI } from '@google/generative-ai'

const DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-2.5-flash',
}

const EMBEDDING_MODELS: Record<string, string> = {
  gemini: 'text-embedding-004',
}

export function getModel(apiKey: string, provider = 'gemini', model?: string) {
  if (provider !== 'gemini') {
    throw new Error(`Provider "${provider}" not yet supported. Use Gemini for now.`)
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({
    model: model || DEFAULT_MODELS[provider],
    generationConfig: {
      responseMimeType: 'application/json',
    },
  })
}

export function extractJson(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```(?:json)?\n?/g, '').trim()
  return JSON.parse(cleaned)
}

export async function generateEmbedding(apiKey: string, text: string, provider = 'gemini'): Promise<number[]> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODELS[provider] })
  const result = await embeddingModel.embedContent(text)
  return result.embedding.values
}
