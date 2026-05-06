// Vercel Serverless Function — Event-level Dedup proxy
// Fuzzy headline-token similarity misses event paraphrases (e.g. "Pentagon
// Classified AI Deal" vs "Pentagon AI Partnerships" — clearly the same event
// but only "pentagon" overlaps). This endpoint sends the items to GPT-4o
// and asks it to group items that cover the same underlying event.

const SYSTEM_INSTRUCTIONS = `You are a deduplication classifier for an OpenAI weekly news digest.

Given a list of news items (each with headline, date, source_name, url), group items that cover the same UNDERLYING EVENT — even if they use different verbs, different framings, or were filed by different outlets.

Two items are the same event if a careful editor would say "this is one story." Examples:
- "Pentagon Classified AI Deal with OpenAI" + "Pentagon Announces AI Partnerships with Seven Companies" = SAME event (Pentagon AI deal announcement)
- "Reuters: Musk filed motion to settle" + "Bloomberg: Musk's settlement filing details" = SAME event
- "OpenAI launches GPT-5.5" + "TechCrunch: GPT-5.5 default model rolls out" = SAME event
- "Brockman testifies $30B stake" + "Brockman testifies Musk used staff for Tesla" = DIFFERENT events from the same trial day (different testimony content)
- "WSJ: OpenAI revenue miss" + "OpenAI's Friar pushes back on revenue miss report" = DIFFERENT events (the report and the response are distinct news beats)

Be careful: when in doubt, keep them separate. Only merge when you are confident two items describe the same announcement, filing, hire, or development.

Return strictly a JSON object with this shape:
{
  "groups": [
    {"member_indices": [0, 3], "event_summary": "Pentagon AI deal announcement"},
    {"member_indices": [1], "event_summary": "OpenAI GPT-5.5 model release"},
    ...
  ]
}

Every input index must appear in exactly one group. A group of size 1 means the item is its own event (no duplicates).`;

function extractJsonObject(text) {
    if (!text) return null;
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
        return JSON.parse(text.slice(start, end + 1));
    } catch (e) {
        return null;
    }
}

function extractMessageText(response) {
    if (response.output_text) return response.output_text;
    const output = response.output || [];
    for (const item of output) {
        if (item.type === 'message' && Array.isArray(item.content)) {
            for (const c of item.content) {
                if (c.type === 'output_text' && c.text) return c.text;
                if (c.type === 'text' && c.text) return c.text;
            }
        }
    }
    return '';
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const expectedToken = process.env.GAP_CHECK_TOKEN;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!expectedToken || !openaiKey) {
        return res.status(500).json({ error: 'Server not configured: missing GAP_CHECK_TOKEN or OPENAI_API_KEY' });
    }

    const auth = req.headers.authorization || '';
    const presentedToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (presentedToken !== expectedToken) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { items, model } = req.body || {};
    if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Required field: items (array)' });
    }
    if (items.length === 0) {
        return res.status(200).json({
            success: true,
            groups: [],
            input_count: 0,
            group_count: 0,
        });
    }
    if (items.length > 100) {
        return res.status(400).json({ error: 'Too many items (max 100). Batch your call.' });
    }

    const numbered = items.map((it, i) => {
        const headline = (it.headline || '').slice(0, 250);
        const date = it.date || '';
        const source = it.source_name || '';
        const url = it.url || '';
        return `${i}. ${headline} | date=${date} | source=${source} | url=${url}`;
    }).join('\n');

    const userInput = `Items to dedup:\n\n${numbered}\n\nReturn JSON {"groups": [{"member_indices": [...], "event_summary": "..."}, ...]}. Every index 0..${items.length - 1} must appear exactly once across all groups.`;

    try {
        const openaiResp = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model || 'gpt-4o',
                instructions: SYSTEM_INSTRUCTIONS,
                input: userInput,
                max_output_tokens: 4000,
                temperature: 0.1,
            }),
        });

        const data = await openaiResp.json();

        if (!openaiResp.ok) {
            return res.status(openaiResp.status).json({
                error: 'OpenAI API call failed',
                status: openaiResp.status,
                api_response: data,
            });
        }

        const text = extractMessageText(data);
        const parsed = extractJsonObject(text);

        if (!parsed || !Array.isArray(parsed.groups)) {
            return res.status(500).json({
                error: 'OpenAI returned non-JSON or missing groups',
                raw_text: text,
                full_response: data,
            });
        }

        // Sanity-check: every index appears at most once
        const seen = new Set();
        const sanitizedGroups = [];
        for (const g of parsed.groups) {
            if (!Array.isArray(g.member_indices)) continue;
            const valid = g.member_indices.filter(i =>
                Number.isInteger(i) && i >= 0 && i < items.length && !seen.has(i)
            );
            for (const i of valid) seen.add(i);
            if (valid.length > 0) {
                sanitizedGroups.push({
                    member_indices: valid,
                    event_summary: typeof g.event_summary === 'string' ? g.event_summary : '',
                });
            }
        }
        // Any unseen indices become singleton groups (GPT may have dropped them)
        for (let i = 0; i < items.length; i++) {
            if (!seen.has(i)) {
                sanitizedGroups.push({
                    member_indices: [i],
                    event_summary: items[i].headline || '(no headline)',
                });
            }
        }

        return res.status(200).json({
            success: true,
            model: data.model,
            input_count: items.length,
            group_count: sanitizedGroups.length,
            merged_groups: sanitizedGroups.filter(g => g.member_indices.length > 1).length,
            groups: sanitizedGroups,
            usage: data.usage,
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
