import Groq from 'groq-sdk';

let _groq: Groq | null = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

export async function complete(
  prompt: string,
  options?: { json?: boolean; model?: string }
): Promise<string> {
  const response = await getGroq().chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: options?.model ?? 'llama-3.3-70b-versatile',
    temperature: 0.7,
    ...(options?.json ? { response_format: { type: 'json_object' } } : {}),
  });
  return response.choices[0].message.content ?? '';
}

export async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY env var');

  // Dynamic import keeps the SDK out of the Next.js client bundle
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const result = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
    config: { outputDimensionality: 768 },
  });

  const values = result.embeddings?.[0]?.values;
  if (!values) throw new Error('No embedding returned');
  return values;
}
