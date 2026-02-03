// Vercel Serverless Function - Gemini API Proxy
// This keeps the API key secure on the server side

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured in Vercel environment' });
    }

    try {
        const { prompt, model = 'gemini-2.5-flash-lite' } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Missing prompt in request body' });
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        // Extract text from response
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return res.status(200).json({ text, raw: data });

    } catch (error) {
        console.error('Gemini proxy error:', error);
        return res.status(500).json({ error: error.message });
    }
}
