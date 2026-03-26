// POST /api/vibe-report — AI-generated shareable vibe card
export async function onRequestPost(context) {
  const headers = { 'Content-Type': 'application/json' };

  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON' }), { status: 400, headers });
  }

  const { partnerName, pct, packKey, lang, questions } = body;
  if (!questions || !questions.length) {
    return new Response(JSON.stringify({ error: 'questions required' }), { status: 400, headers });
  }

  const langNames = { en: 'English', tr: 'Turkish', th: 'Thai' };
  const responseLang = langNames[lang] || 'English';

  const qaList = questions.map((d, i) =>
    `Q${i + 1}: "${d.q}" — You: "${d.userAns}", ${partnerName}: "${d.partnerAns}" [${d.matched ? 'MATCH' : 'DIFFERENT'}]`
  ).join('\n');

  const prompt = `You analyze blind compatibility quiz results for "blindside" — a couples app. Be Gen-Z, punchy, specific. This is for a SHAREABLE CARD like Spotify Wrapped — everything must be SHORT.

Players: "You" & "${partnerName}" | Pack: ${packKey || 'general'} | Match: ${pct}%
${qaList}

Return JSON with these fields. KEEP EVERYTHING SHORT — this goes on a visual card, not a blog post. Respond in ${responseLang}.

- "headline": 3-5 word punchy title. NOT generic. Reference their actual answers. Examples: "Midnight Snack Soulmates", "One Plans One Vibes", "Same Chaos Different Font"
- "hook": Max 8 words. One specific callout. Examples: "you both said midnight junk food runs", "one wants road trips one wants bed"
- "superlatives": Array of 3. Each has "icon" (emoji), "text" (MAX 6 words, punchy, references actual answer). Examples: "both chose pizza over people", "opposite energies same destination", "secretly agree on the big stuff". NO "label" field — just icon and text.
- "metaphor": Their duo archetype name. 2-4 words. Creative. Examples: "The Chaos Twins", "Cozy vs. Chaotic", "One Braincell Duo"
- "metaphor_label": "your duo archetype" (translate if needed)
- "vibe_tag": Hashtag, CamelCase, # prefix. Memorable. Examples: "#SameChaos", "#OppositeMainCharacters", "#OneBraincellDuo"
- "share_text": Under 80 chars. Sounds like a person, not a brand. Include emoji. Example: "we got 'one braincell duo' im screaming 💀"

CRITICAL: Be SPECIFIC to their actual answers. No generic filler. Every field references real data.
Return ONLY valid JSON.`;

  try {
    const apiUrl = context.env.CLAUDE_API_URL || 'https://api.rome.markets';
    const res = await fetch(`${apiUrl}/claude?nocache=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': 'blindside-vibes' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const result = await res.json();
    const text = result?.content?.[0]?.text;
    if (!text) {
      return new Response(JSON.stringify({ error: 'no AI response' }), { status: 502, headers });
    }

    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const report = JSON.parse(cleaned);

    return new Response(JSON.stringify(report), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'AI generation failed' }), { status: 502, headers });
  }
}
