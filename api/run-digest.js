// Vercel Serverless Function — Trigger OAI News Digest Pipeline
// Fires Claude Code routine via per-routine bearer token

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const routineToken = process.env.ROUTINE_TOKEN;
    if (!routineToken) {
        return res.status(500).json({ error: 'ROUTINE_TOKEN not configured' });
    }

    const routineId = 'trig_01QPM9inh86qSpEvrj8spwoT';
    const url = `https://api.anthropic.com/v1/claude_code/routines/${routineId}/fire`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${routineToken}`,
                'anthropic-beta': 'experimental-cc-routine-2026-04-01',
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            body: '{}',
        });

        const data = await response.json();

        if (!response.ok) {
            // Return the exact error for debugging
            return res.status(response.status).json({
                error: 'API call failed',
                status: response.status,
                api_response: data,
                token_hint: routineToken.substring(0, 20) + '...',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'OAI Digest pipeline triggered',
            session_url: data.claude_code_session_url,
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
