import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export function getModel() {
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' })
  const result = await embeddingModel.embedContent(text)
  return result.embedding.values
}
