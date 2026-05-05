// Vercel Serverless Function — Trigger OAI News Digest Pipeline
// Fires the Claude Code remote routine via per-routine bearer token

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const routineToken = process.env.ROUTINE_TOKEN;
    if (!routineToken) {
        return res.status(500).json({ error: 'ROUTINE_TOKEN not configured in Vercel environment' });
    }

    const routineId = 'trig_01QPM9inh86qSpEvrj8spwoT';

    // Try both endpoint patterns — the API may use either
    const endpoints = [
        `https://api.anthropic.com/v1/claude_code/routines/${routineId}/fire`,
        `https://api.anthropic.com/v1/code/triggers/${routineId}/run`,
    ];

    let lastError = null;

    for (const url of endpoints) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${routineToken}`,
                    'anthropic-beta': 'experimental-cc-routine-2026-04-01',
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: 'Triggered from AI Maps website button',
                }),
            });

            const data = await response.json();

            if (response.ok) {
                return res.status(200).json({
                    success: true,
                    message: 'OAI Digest pipeline triggered',
                    session_url: data.claude_code_session_url || data.session_url || null,
                });
            }

            lastError = { status: response.status, data, url };
            console.error(`Endpoint ${url} failed:`, data);

        } catch (error) {
            lastError = { status: 500, data: { error: error.message }, url };
            console.error(`Endpoint ${url} error:`, error.message);
        }
    }

    return res.status(lastError?.status || 500).json({
        error: 'Failed to trigger digest pipeline',
        details: lastError?.data,
        tried_url: lastError?.url,
    });
}
