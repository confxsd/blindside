const PACK_NAMES = {
  couples: '💕 Ciftler',
  bestfriends: '👯 Yakin Arkadaslar',
  deeptalk: '🌊 Derin Sohbet',
  '36questions': '❤️‍🔥 36 Soru',
  hottakes: '🌶️ Cesur Yorumlar',
  redflags: '🚩 Kirmizi Bayraklar',
  chaotic: '🎲 Kaotik',
  fungames: '🎉 Eglenceli',
  worldtaste: '🌍 Dunya & Zevk',
  ethics: '⚖️ Etik',
  situations: '😱 Durumlar',
  livingtogether: '🏠 Birlikte Yasam',
  soulspirit: '🕊️ Ruh & Tin',
  attachment: '🔗 Baglanma',
  innermirror: '🪞 Ic Ayna',
  stresstype: '🧊 Stres Tipi',
  lovelang: '💌 Ask Dili',
  shadow: '🌑 Golge',
  emotionalage: '🎭 Duygusal Yas',
  boundaries: '🚧 Sinirlar',
  selfsabotage: '🪤 Kendine Sabotaj',
  partnertype: '🐕 Partner Tipi',
  partnerera: '👑 Partner Donemi',
  couplestory: '📖 Cift Hikayesi',
  whattheyhide: '🎭 Gizledikleri',
  flirtguess: '😏 Flort & Tahmin',
  desirematch: '🔥 Arzu Eslesmesi',
};

const OG_BOT_UA = /bot|crawl|slurp|spider|facebookexternalhit|whatsapp|telegrambot|twitterbot|linkedinbot|discordbot|slack/i;

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const ua = request.headers.get('user-agent') || '';
  const joinCode = url.searchParams.get('join');

  // Handle ?ref= invite links for OG previews
  const refCode = url.searchParams.get('ref');
  const refBy = url.searchParams.get('by');
  if (refCode && OG_BOT_UA.test(ua)) {
    const name = refBy ? decodeURIComponent(refBy) : 'Bir arkadas';
    const title = `${name} seni Mira'ya davet etti.`;
    const description = 'Dogru insani hak ediyorsun. Profilini olustur, Mira sana ozel birini bulsun.';
    const ogImage = `${url.origin}/og-image.png`;
    const html = `<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8"><title>${title}</title>
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url.href}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:site_name" content="Mira">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta http-equiv="refresh" content="0;url=${url.href}">
</head><body></body></html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
  }

  // Only intercept requests with ?join= from crawlers/bots
  if (!joinCode) {
    return context.next();
  }

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
    const title = `${creator} seni Mira'da oynamaya davet etti.`;
    const description = `${packName} — aynı sorular, gizli yanıtlar, birlikte açığa çıkar.`;
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
  <meta property="og:site_name" content="Mira">
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
