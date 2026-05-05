// Vercel Serverless Function — Trigger OAI News Digest Pipeline
// Fires the Claude Code remote routine via per-routine bearer token
// No Anthropic API key needed — uses a scoped token from Claude Code

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const routineToken = process.env.ROUTINE_TOKEN;
    if (!routineToken) {
        return res.status(500).json({ error: 'ROUTINE_TOKEN not configured in Vercel environment' });
    }

    const routineId = 'trig_01QPM9inh86qSpEvrj8spwoT';

    try {
        const response = await fetch(
            `https://api.anthropic.com/v1/claude_code/routines/${routineId}/fire`,
            {
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
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error('Routine fire error:', data);
            return res.status(response.status).json({
                error: 'Failed to trigger digest pipeline',
                details: data,
            });
        }

        return res.status(200).json({
            success: true,
            message: 'OAI Digest pipeline triggered',
            session_url: data.claude_code_session_url || null,
        });

    } catch (error) {
        console.error('Routine fire error:', error);
        return res.status(500).json({ error: error.message });
    }
}
