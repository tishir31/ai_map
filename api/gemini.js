const { allowPublicAction } = require("../lib/public-actions");
// Vercel Serverless Function - Gemini API Proxy
// This keeps the API key secure on the server side

export default async function handler(req, res) {
    if (req.method === 'GET') return res.status(200).json({ available: Boolean(process.env.GEMINI_API_KEY), mode: 'public' });
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!await allowPublicAction(req, res, 'ask-ai', 20, 200)) return;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured in Vercel environment' });
    }

    try {
        const { prompt } = req.body || {};
        const model = 'gemini-2.5-flash-lite';

        if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 12000) {
            return res.status(400).json({ error: 'Use a prompt of 1–12,000 characters.' });
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                signal: AbortSignal.timeout(20000),
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: "AI provider temporarily unavailable. Try again later." });
        }

        // Extract text from response
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return res.status(200).json({ text, model, generatedAt: new Date().toISOString(), evidenceClass: "AI generated interpretation; verify claims against sources" });

    } catch (error) {
        console.error('Gemini proxy error:', error);
        return res.status(500).json({ error: "AI request failed or timed out. Try again later." });
    }
}
