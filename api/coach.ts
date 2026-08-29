// Serverless coaching endpoint (Vercel-style). Optional: the app fully works
// without it — the client falls back to templated coaching when this route
// is absent or unconfigured.
//
// To enable live generative coaching, set ONE environment variable:
//   OPENAI_API_KEY

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return new Response(JSON.stringify({ error: 'not configured' }), { status: 503 })

  const metrics = await req.json()
  const prompt = `You are a friendly, cautious running-form coach inside a prototype app.
You receive approximate, camera-based movement metrics derived from a short side-on
running clip (NOT clinical measurements, NOT the video itself):

${JSON.stringify(metrics, null, 2)}

Respond with STRICT JSON: {"noticed": "...", "tryThis": "...", "why": "..."}.
- "noticed": 1-2 sentences describing the most notable observation (focus on "${metrics.primary_observation}"). Use hedged wording like "appears to".
- "tryThis": ONE concrete, simple coaching cue.
- "why": one short sentence. No injury, diagnosis, or medical claims. No guarantees.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    }),
  })
  if (!res.ok) return new Response(JSON.stringify({ error: 'llm error' }), { status: 502 })
  const data = await res.json()
  return new Response(data.choices[0].message.content, {
    headers: { 'Content-Type': 'application/json' },
  })
}

export const config = { runtime: 'edge' }
