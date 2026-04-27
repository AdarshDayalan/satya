import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export function getModel() {
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  })
}

export function extractJson(text: string): Record<string, unknown> {
  // Strip markdown fences if present
  const cleaned = text.replace(/```(?:json)?\n?/g, '').trim()
  return JSON.parse(cleaned)
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' })
  const result = await embeddingModel.embedContent(text)
  return result.embedding.values
}
