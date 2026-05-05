// Vercel Serverless Function — Gap Checker proxy
// Uses OpenAI Responses API with web_search_preview tool so GPT actually
// searches the web (vs. hallucinating from training data on chat completions).

const SYSTEM_INSTRUCTIONS = `You are a gap checker for an OpenAI weekly news digest.

A separate Reporter (Claude) drafted the digest from web + Gmail searches. Your job: find notable OpenAI stories from the target week that are NOT in the draft.

You MUST run MULTIPLE web searches to be exhaustive. A single search will miss things. Run AT LEAST six distinct search queries before deciding nothing is missing. Suggested queries (run all of them, in order):
1. "OpenAI" news <week_start> <week_end>
2. OpenAI lawsuit OR court filing <week_end>
3. OpenAI partnership OR deal <week_end>
4. OpenAI funding OR investment OR valuation <week_end>
5. OpenAI government OR regulatory OR Pentagon OR FTC <week_end>
6. OpenAI executive OR hire OR departure <week_end>

For each query, scan results for OpenAI stories from the target week. Aggregate findings. Then compare your aggregated list against what is already in the draft. Surface only items that are GENUINELY MISSING from the draft.

Significance bar: only items a managing director at an investment bank should know about. Skip product micro-updates, minor blog posts, opinion pieces, analyst commentary.

Source quality: only use reputable primary outlets — official OpenAI channels, major news outlets (CNBC, Reuters, Bloomberg, WSJ, NYT, Washington Post, NPR), industry-specific press (Defense News, Healthcare IT, Banking Dive), court filings, regulatory documents. Reject low-quality blogs, content farms, and aggregator sites (e.g., investing.com, moneycontrol.com — find the original Bloomberg/Reuters source instead).

Return ONLY a JSON object in this exact shape, no preamble or trailing text:

{"gaps": [
  {
    "headline": "string — the actual story headline",
    "date": "YYYY-MM-DD — date of the event",
    "url": "string — direct link to a primary source you found via web search",
    "source_name": "string — e.g. CNBC, Reuters, court filing",
    "category": "Earnings / Financials / Fundraising | Product Launches & Updates | Partnerships & Deals | Regulatory & Policy | Key Hires / Departures | Technical Research / Model Releases",
    "why_missed": "string — one sentence on why this matters for an IB audience",
    "confidence": "high | medium | low",
    "gap_check_sourced": true
  }
]}

Finding zero gaps is valid — return {"gaps": []}. Never fabricate items. Never invent URLs. Every URL must come from your web search results.`;

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

    const { draft_html, week_start, week_end, model } = req.body || {};
    if (!draft_html || !week_start || !week_end) {
        return res.status(400).json({ error: 'Required fields: draft_html, week_start, week_end' });
    }

    const truncatedDraft = String(draft_html).slice(0, 16000);
    const userInput = `Target week: ${week_start} to ${week_end}\n\nCurrent digest draft:\n\n${truncatedDraft}\n\nSearch the web for OpenAI news from this date range that is missing from the draft. Return JSON object {"gaps": [...]} as specified. If nothing is missing, return {"gaps": []}.`;

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
                tools: [{ type: 'web_search_preview' }],
                tool_choice: { type: 'web_search_preview' },
                max_output_tokens: 4000,
                temperature: 0.3,
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

        const outputTypes = (data.output || []).map(o => o.type);
        const webSearchCalled = outputTypes.includes('web_search_call');

        if (!parsed) {
            return res.status(500).json({
                error: 'OpenAI returned non-JSON content',
                raw_text: text,
                output_types: outputTypes,
                web_search_called: webSearchCalled,
                full_response: data,
            });
        }

        const gaps = Array.isArray(parsed.gaps) ? parsed.gaps : [];

        return res.status(200).json({
            success: true,
            model: data.model,
            gap_count: gaps.length,
            gaps,
            web_search_called: webSearchCalled,
            output_types: outputTypes,
            raw_text: text,
            usage: data.usage,
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
