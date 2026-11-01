import { GoogleGenerativeAI } from '@google/generative-ai';

// Extra guidance per business type. Any other type the user types in gets the generic rules.
const NICHE_HINTS = {
  photography: 'Mention the mood, light, subject or shoot type that is visible. Invite people to book a session.',
  'makeup artist': 'Describe the look, finish and occasion you can see (bridal, glam, natural, editorial). Invite people to book an appointment.',
  'artist / illustrator': 'Talk about the style, medium, colours and feeling of the work. Invite people to commission, buy or follow the process.',
  'fashion / clothing brand': 'Describe the outfit, fabric, colours and occasion. Invite people to shop or check the link in bio.',
  'food / cafe / bakery': 'Make the food sound appetising using what is visible. Invite people to visit or order.',
  'beauty / hair salon': 'Describe the style, colour or treatment visible. Invite people to book.',
  'fitness / wellness': 'Keep it motivating and honest, never promise results. Invite people to join or book a session.',
  'real estate': 'Highlight visible features of the space. Invite people to enquire or book a viewing.',
  'home / interior design': 'Describe the style, materials and mood of the space. Invite people to get in touch for a project.',
  'events / wedding planning': 'Capture the atmosphere and details visible. Invite people to enquire about their date.',
  'personal brand / creator': 'Keep it personal and conversational. Invite people to follow, comment or share.',
};

const clean = (v, n = 200) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);

function buildPrompt(p) {
  const type = clean(p.businessType, 80) || 'small business';
  const hint = NICHE_HINTS[type.toLowerCase()] || 'Describe what is visible and invite people to take the next step.';
  const details = [
    p.audience && `Target audience: ${clean(p.audience)}`,
    p.location && `Location: ${clean(p.location, 120)} (use it naturally and in one or two local hashtags)`,
    p.keywords && `Keywords to work in naturally where they fit: ${clean(p.keywords)}`,
    p.callToAction && `Preferred call to action: ${clean(p.callToAction, 160)}`,
  ].filter(Boolean);
  const extra = clean(p.instruction, 200);

  return `You are the social media manager for a ${type}${p.businessName ? ` called "${clean(p.businessName, 100)}"` : ''}.
${details.length ? details.join('\n') + '\n' : ''}${p.count > 1 ? `The post is a carousel of ${p.count} photos. Look at ALL the images together and write ONE caption and ONE hashtag set that suit the whole set.` : 'Look at the image and write a post for Instagram and Facebook.'}
1. "caption": 2-4 sentences, tone: ${clean(p.tone, 80) || 'warm and professional'}, grounded in what is actually visible. ${hint} End with a clear call to action. At most 2 emojis. Under 600 characters.
2. "hashtags": exactly 12 relevant SEO hashtags: a mix of broad tags for this type of business and specific tags for the visible subject, style and setting, each starting with #, no spaces.
Rules: describe only what you can see. Do not invent prices, discounts, names, dates or locations that were not given above.${
    extra ? `\nThe owner also asked: ${extra}` : ''
  }
Reply ONLY with JSON: {"caption": string, "hashtags": string[]}`;
}

const isModelGone = (e) => /404|not found|no longer available|not supported|deprecated/i.test(e?.message || '');

export async function generateCaption({ buffer, buffers, ...profile }) {
  const list = buffers?.length ? buffers : [buffer];
  profile.count = list.length;
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const prompt = buildPrompt(profile);
  const images = list.map((b) => ({ inlineData: { data: b.toString('base64'), mimeType: 'image/jpeg' } }));

  // Uses GEMINI_MODEL first; if Google has retired it, falls back to the current default.
  const models = [...new Set([process.env.GEMINI_MODEL, 'gemini-3.5-flash'].filter(Boolean))];
  let result;
  let lastError;
  for (const name of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: name,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.8 },
      });
      result = await model.generateContent([prompt, ...images]);
      break;
    } catch (e) {
      lastError = e;
      if (!isModelGone(e)) throw e;
      console.error(`Gemini model "${name}" unavailable, trying next:`, e.message);
    }
  }
  if (!result) throw lastError;

  const data = JSON.parse(result.response.text().replace(/```json|```/g, '').trim());
  const hashtags = [
    ...new Set(
      (data.hashtags || [])
        .map((h) => '#' + String(h).replace(/[^\p{L}\p{N}_]/gu, ''))
        .filter((h) => h.length > 1)
    ),
  ].slice(0, 12);
  return { caption: String(data.caption || '').slice(0, 2200), hashtags };
}
