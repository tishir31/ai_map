// Vercel Serverless Function — Gap Checker proxy
// Cloud routine cannot hold OPENAI_API_KEY directly (Anthropic routine UI doesn't
// expose env vars). This endpoint sits in front of OpenAI so the key stays in
// Vercel env. Authenticated by GAP_CHECK_TOKEN (a low-sensitivity bearer token).

const SYSTEM_PROMPT = `You are a gap checker for an OpenAI weekly news digest.

A separate Reporter (different model family) drafted the digest from web + Gmail searches. Your job: find notable OpenAI stories from the target week that are NOT in the draft. You catch blind spots that a single model's training data and search patterns produce.

Search for stories the draft missed. Focus on:
- Major news outlets (CNBC, NPR, Reuters, Bloomberg, WSJ, NYT) covering OpenAI lawsuits, partnerships, financial events
- Court filings, regulatory actions, government deals
- Stories where OpenAI is the subject but the source is non-OpenAI press
- Tech research releases, model launches not on the OpenAI blog
- Industry-specific press (defense, healthcare, finance) that mainstream tech press missed

Significance bar: only items a managing director at an investment bank should know about. Skip product micro-updates, minor blog posts, opinion pieces.

Return STRICTLY a JSON object: { "gaps": [ ... ] } where each gap is:
{
  "headline": "string — the actual story headline",
  "date": "YYYY-MM-DD — date of the event, not publication",
  "url": "string — direct link to a primary source",
  "source_name": "string — e.g. CNBC, Reuters, court filing",
  "category": "Earnings / Financials / Fundraising | Product Launches & Updates | Partnerships & Deals | Regulatory & Policy | Key Hires / Departures | Technical Research / Model Releases",
  "why_missed": "string — one sentence on why this matters for an IB audience",
  "confidence": "high | medium | low",
  "gap_check_sourced": true
}

Finding zero gaps is valid — never fabricate items. 2-3 genuine catches per week is excellent. If the draft already covers a story, do not duplicate it.`;

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
    const userMessage = `Target week: ${week_start} to ${week_end}\n\nCurrent digest draft:\n\n${truncatedDraft}\n\nReturn JSON object { "gaps": [...] } as specified. If no gaps, return { "gaps": [] }.`;

    try {
        const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model || 'gpt-4o',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userMessage },
                ],
                response_format: { type: 'json_object' },
                max_tokens: 4000,
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

        const text = data.choices?.[0]?.message?.content || '{"gaps":[]}';
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            return res.status(500).json({ error: 'OpenAI returned non-JSON content', raw: text });
        }

        const gaps = Array.isArray(parsed.gaps) ? parsed.gaps : [];

        return res.status(200).json({
            success: true,
            model: data.model,
            gap_count: gaps.length,
            gaps,
            usage: data.usage,
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
