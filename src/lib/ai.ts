import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

export type Provider = 'gemini' | 'openai' | 'anthropic'

const DEFAULT_MODELS: Record<Provider, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-sonnet-4-20250514',
}

const EMBEDDING_MODELS: Record<string, string> = {
  gemini: 'text-embedding-004',
  openai: 'text-embedding-3-small',
}

export interface AIModel {
  generateJSON(prompt: string): Promise<Record<string, unknown>>
}

export function getModel(apiKey: string, provider: Provider = 'gemini', model?: string): AIModel {
  const modelId = model || DEFAULT_MODELS[provider]

  if (provider === 'gemini') {
    const genAI = new GoogleGenerativeAI(apiKey)
    const gemModel = genAI.getGenerativeModel({
      model: modelId,
      generationConfig: { responseMimeType: 'application/json' },
    })
    return {
      async generateJSON(prompt: string) {
        const result = await gemModel.generateContent(prompt)
        return extractJson(result.response.text())
      },
    }
  }

  if (provider === 'openai') {
    const client = new OpenAI({ apiKey })
    return {
      async generateJSON(prompt: string) {
        const result = await client.chat.completions.create({
          model: modelId,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        })
        return extractJson(result.choices[0].message.content || '{}')
      },
    }
  }

  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey })
    return {
      async generateJSON(prompt: string) {
        const result = await client.messages.create({
          model: modelId,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt + '\n\nRespond with valid JSON only, no markdown fences.' }],
        })
        const text = result.content[0].type === 'text' ? result.content[0].text : ''
        return extractJson(text)
      },
    }
  }

  throw new Error(`Unsupported provider: ${provider}`)
}

export function extractJson(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```(?:json)?\n?/g, '').trim()
  return JSON.parse(cleaned)
}

export async function generateEmbedding(apiKey: string, text: string, provider: Provider = 'gemini'): Promise<number[]> {
  if (provider === 'gemini') {
    const genAI = new GoogleGenerativeAI(apiKey)
    const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODELS.gemini })
    const result = await embeddingModel.embedContent(text)
    return result.embedding.values
  }

  if (provider === 'openai') {
    const client = new OpenAI({ apiKey })
    const result = await client.embeddings.create({
      model: EMBEDDING_MODELS.openai,
      input: text,
    })
    return result.data[0].embedding
  }

  // Anthropic doesn't have an embedding API — use the model to skip embeddings
  return []
}
