// Vercel Serverless Function — Gap Checker proxy
// Uses OpenAI Responses API with web_search_preview tool so GPT actually
// searches the web (vs. hallucinating from training data on chat completions).

const SYSTEM_INSTRUCTIONS = `You are a gap checker for an OpenAI weekly news digest serving senior investment banking professionals.

A separate Reporter (Claude) drafted the digest from web + Gmail searches. Your job: find notable OpenAI stories from the target week that are NOT in the draft.

PRIORITY: A missing major story is FAR worse than a duplicate. Err toward including borderline gaps. The downstream Editor will dedup; your job is recall, not precision.

YOU MUST RUN MULTIPLE WEB SEARCHES. A single search is insufficient. Run AT LEAST six distinct searches with these angles:
1. "OpenAI" general news for the target week
2. OpenAI lawsuit OR court filing OR settlement
3. OpenAI partnership OR deal OR acquisition OR investment
4. OpenAI funding OR revenue OR valuation OR IPO
5. OpenAI government OR Pentagon OR FTC OR White House OR regulatory
6. OpenAI executive OR hire OR departure OR Altman OR Brockman

Aggregate findings across all searches. Then compare to the draft.

DEDUP RULES (apply in this order):
- If an item in the draft references the same UNDERLYING EVENT (same lawsuit, same deal, same announcement) — even with a different URL or framing — DO NOT include it as a gap. Two articles about the same lawsuit are the same event.
- If a story is genuinely a NEW event (different parties, different facts, different filing date), include it even if it superficially resembles a draft item.
- If unsure whether two stories are the same event, INCLUDE THE GAP. Better to over-flag than miss real news.

SIGNIFICANCE BAR: items a managing director would care about. Skip product micro-updates, opinion pieces, analyst commentary, and minor blog posts. Include: lawsuits, financial milestones, executive moves, major partnerships, regulatory actions, government deals, model releases.

SOURCE QUALITY: prefer primary outlets (CNBC, Reuters, Bloomberg, WSJ, NYT, Washington Post, NPR, official OpenAI/government channels, court filings). Reject aggregator sites (investing.com, moneycontrol.com, headlinetoday.com — find the original). Reject low-quality blogs and content farms.

Return ONLY a JSON object in this shape, no preamble or trailing text:

{"gaps": [
  {
    "headline": "string — the actual story headline as it would appear in the digest",
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

function normalizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    return url.trim().toLowerCase().replace(/\/+$/, '').split('?')[0].split('#')[0];
}

function buildItemsBlock(currentItems) {
    if (!Array.isArray(currentItems) || currentItems.length === 0) return '';
    const lines = ['Already in the draft (do NOT return as gaps):'];
    currentItems.forEach((it, i) => {
        const headline = (it.headline || '').slice(0, 200);
        const date = it.date || '';
        const url = it.url || '';
        const source = it.source_name || '';
        lines.push(`${i + 1}. ${headline} (${date}) — ${source} — ${url}`);
    });
    return lines.join('\n') + '\n\n';
}

const STOPWORDS = new Set([
    'a','an','and','are','as','at','be','by','for','from','has','have','in','is','it',
    'its','of','on','or','that','the','to','with','was','were','will','this','these',
    'about','after','before','over','up','down','says','said','new','more','than','also',
    'into','out','off','open','openai','ai','company','companies','via','around'
]);

function tokensOf(text) {
    if (!text) return [];
    return String(text)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 3 && !STOPWORDS.has(t));
}

// Returns { jaccard, sharedCount, sharedTokens }
function headlineSimilarity(a, b) {
    const ta = new Set(tokensOf(a));
    const tb = new Set(tokensOf(b));
    if (ta.size === 0 || tb.size === 0) return { jaccard: 0, sharedCount: 0, sharedTokens: [] };
    const shared = [];
    for (const t of ta) if (tb.has(t)) shared.push(t);
    const union = ta.size + tb.size - shared.length;
    return {
        jaccard: union === 0 ? 0 : shared.length / union,
        sharedCount: shared.length,
        sharedTokens: shared,
    };
}

function datesClose(a, b) {
    if (!a || !b) return true;
    try {
        const da = new Date(a);
        const db = new Date(b);
        const days = Math.abs((da - db) / (1000 * 60 * 60 * 24));
        return days <= 3;
    } catch (e) {
        return true;
    }
}

function dedupServerSide(gaps, currentItems) {
    if (!Array.isArray(currentItems) || currentItems.length === 0) {
        return { kept: gaps, filtered: [] };
    }
    const existingUrls = new Set();
    for (const it of currentItems) {
        const u = normalizeUrl(it.url);
        if (u) existingUrls.add(u);
        if (Array.isArray(it.corroborating_urls)) {
            for (const cu of it.corroborating_urls) {
                const ncu = normalizeUrl(cu);
                if (ncu) existingUrls.add(ncu);
            }
        }
    }
    const kept = [];
    const filtered = [];
    for (const g of gaps) {
        const u = normalizeUrl(g.url);
        if (u && existingUrls.has(u)) {
            filtered.push({ ...g, _filter_reason: 'URL already in current items' });
            continue;
        }
        // Event-level dedup. Two-tier match:
        //   (a) Jaccard >= 0.30  OR
        //   (b) sharedCount >= 2 AND share a high-signal entity token (capitalized in original)
        //   AND dates within 3 days
        // For (b), we approximate "high-signal" by checking shared tokens that appear
        // in known entity-like patterns (proper nouns become lowercase; we just require
        // 2+ shared non-stopword tokens of length >= 4).
        let matchedItem = null;
        let matchedScore = 0;
        let matchedReason = '';
        for (const it of currentItems) {
            const sim = headlineSimilarity(g.headline, it.headline);
            if (!datesClose(g.date, it.date)) continue;
            const longShared = sim.sharedTokens.filter(t => t.length >= 4);
            const matchA = sim.jaccard >= 0.30;
            const matchB = sim.sharedCount >= 2 && longShared.length >= 2;
            if ((matchA || matchB) && sim.jaccard > matchedScore) {
                matchedItem = it;
                matchedScore = sim.jaccard;
                matchedReason = matchA
                    ? `Jaccard ${sim.jaccard.toFixed(2)} ≥ 0.30; shared: [${sim.sharedTokens.join(', ')}]`
                    : `Shared ${sim.sharedCount} tokens (${longShared.length} long): [${sim.sharedTokens.join(', ')}]`;
            }
        }
        if (matchedItem) {
            filtered.push({
                ...g,
                _filter_reason: `Same event as: "${matchedItem.headline}" — ${matchedReason}`,
            });
        } else {
            kept.push(g);
        }
    }
    return { kept, filtered };
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

    const { draft_html, week_start, week_end, model, current_items } = req.body || {};
    if (!draft_html || !week_start || !week_end) {
        return res.status(400).json({ error: 'Required fields: draft_html, week_start, week_end' });
    }

    const truncatedDraft = String(draft_html).slice(0, 16000);
    const itemsBlock = buildItemsBlock(current_items);
    const userInput = `Target week: ${week_start} to ${week_end}\n\n${itemsBlock}Current digest draft:\n\n${truncatedDraft}\n\nSearch the web for OpenAI news from this date range that is missing from the draft. Return JSON object {"gaps": [...]} as specified. If nothing is missing, return {"gaps": []}.`;

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
        const webSearchCallCount = outputTypes.filter(t => t === 'web_search_call').length;
        const webSearchCalled = webSearchCallCount > 0;

        if (!parsed) {
            return res.status(500).json({
                error: 'OpenAI returned non-JSON content',
                raw_text: text,
                output_types: outputTypes,
                web_search_called: webSearchCalled,
                full_response: data,
            });
        }

        const rawGaps = Array.isArray(parsed.gaps) ? parsed.gaps : [];
        const { kept, filtered } = dedupServerSide(rawGaps, current_items);

        return res.status(200).json({
            success: true,
            model: data.model,
            raw_gap_count: rawGaps.length,
            gap_count: kept.length,
            gaps: kept,
            filtered_duplicates: filtered,
            web_search_called: webSearchCalled,
            web_search_call_count: webSearchCallCount,
            output_types: outputTypes,
            usage: data.usage,
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
