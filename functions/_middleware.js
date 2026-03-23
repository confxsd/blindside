const PACK_NAMES = {
  couples: '💕 Couples',
  bestfriends: '👯 Best Friends',
  deeptalk: '🌊 Deep Talk',
  coworkers: '💼 Coworkers',
  '36questions': '❤️‍🔥 36 Questions',
  hottakes: '🌶️ Hot Takes',
  redflags: '🚩 Red Flags',
  chaotic: '🎲 Chaotic',
  fungames: '🎉 Fun Games',
  worldtaste: '🌍 World & Taste',
  ethics: '⚖️ Ethics',
  situations: '😱 Situations',
  livingtogether: '🏠 Living Together',
  soulspirit: '🕊️ Soul & Spirit',
  attachment: '🔗 Attachment',
  innermirror: '🪞 Inner Mirror',
  stresstype: '🧊 Stress Type',
  lovelang: '💌 Love Language',
  shadow: '🌑 Shadow',
  emotionalage: '🎭 Emotional Age',
  boundaries: '🚧 Boundaries',
  selfsabotage: '🪤 Self Sabotage',
  partnertype: '🐕 Partner Archetype',
  partnerera: '👑 Partner Era',
  couplestory: '📖 Couple Story',
  whattheyhide: '🎭 What They Hide',
};

const OG_BOT_UA = /bot|crawl|slurp|spider|facebookexternalhit|whatsapp|telegrambot|twitterbot|linkedinbot|discordbot|slack/i;

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const joinCode = url.searchParams.get('join');

  // Only intercept requests with ?join= from crawlers/bots
  if (!joinCode) {
    return context.next();
  }

  const ua = request.headers.get('user-agent') || '';
  if (!OG_BOT_UA.test(ua)) {
    return context.next();
  }

  // Fetch session data from API
  try {
    const apiRes = await fetch(`https://api.rome.markets/api/blind/sessions/${joinCode}`);
    const data = await apiRes.json();

    if (data.error || !data.session) {
      return context.next();
    }

    const session = data.session;
    const packName = PACK_NAMES[session.pack_key] || session.pack_key;
    const creator = session.creator_username || 'someone';
    const title = `${creator} invited you to play blindside.`;
    const description = `${packName} — same questions, blind answers, one reveal. 🫣`;
    const ogImage = `${url.origin}/og-image.png`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url.href}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:site_name" content="blindside.">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${ogImage}">
  <meta http-equiv="refresh" content="0;url=${url.href}">
</head>
<body></body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    });
  } catch {
    return context.next();
  }
}
