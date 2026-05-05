// Vercel Serverless Function — Trigger OAI News Digest Pipeline

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const routineToken = process.env.ROUTINE_TOKEN;
    if (!routineToken) {
        return res.status(500).json({ error: 'ROUTINE_TOKEN not configured' });
    }

    const routineId = 'trig_01QPM9inh86qSpEvrj8spwoT';

    // Try multiple endpoint/header combinations
    const attempts = [
        {
            url: `https://api.anthropic.com/v1/claude_code/routines/${routineId}/fire`,
            headers: {
                'Authorization': `Bearer ${routineToken}`,
                'anthropic-beta': 'experimental-cc-routine-2026-04-01',
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            body: '{}',
        },
        {
            url: `https://api.anthropic.com/v1/claude_code/routines/${routineId}/fire`,
            headers: {
                'x-api-key': routineToken,
                'anthropic-beta': 'experimental-cc-routine-2026-04-01',
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            body: '{}',
        },
        {
            url: `https://api.anthropic.com/v1/code/triggers/${routineId}/run`,
            headers: {
                'Authorization': `Bearer ${routineToken}`,
                'Content-Type': 'application/json',
            },
            body: '{}',
        },
    ];

    const results = [];

    for (const attempt of attempts) {
        try {
            const response = await fetch(attempt.url, {
                method: 'POST',
                headers: attempt.headers,
                body: attempt.body,
            });

            const data = await response.json();
            results.push({ url: attempt.url, status: response.status, data });

            if (response.ok) {
                return res.status(200).json({
                    success: true,
                    message: 'OAI Digest pipeline triggered',
                    data,
                });
            }
        } catch (error) {
            results.push({ url: attempt.url, status: 0, error: error.message });
        }
    }

    // All attempts failed — return debug info
    return res.status(502).json({
        error: 'All endpoint attempts failed',
        attempts: results,
    });
}
