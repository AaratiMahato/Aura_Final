import axios from 'axios';

// "Instagram API with Instagram Login" (Business Login for Instagram).
// Needs its OWN app credentials: Meta App Dashboard > Instagram > API setup with Instagram login
//   > "Instagram App ID" and "Instagram app secret"  (these are NOT the Facebook App ID / secret).
const GRAPH = 'https://graph.instagram.com';
const ver = () => process.env.GRAPH_VERSION || 'v23.0';

export const instagramEnabled = () => Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);

// Must match, character for character, a URI listed under "OAuth redirect URIs" in the Meta dashboard.
export const instagramRedirect = () =>
  process.env.INSTAGRAM_REDIRECT_URI || `${process.env.SERVER_URL}/api/auth/instagram/callback`;

// Login only needs the basic scope (least privilege). Posting keeps using your Facebook Page connection.
export const instagramScopes = () => ['instagram_business_basic'];

export function instagramAuthUrl(state) {
  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.search = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID,
    redirect_uri: instagramRedirect(),
    response_type: 'code',
    scope: instagramScopes().join(','),
    state,
  });
  return url.toString();
}

// code -> short-lived token -> long-lived token (about 60 days)
export async function exchangeInstagramCode(code) {
  const body = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID,
    client_secret: process.env.INSTAGRAM_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: instagramRedirect(),
    code,
  });
  const { data } = await axios.post('https://api.instagram.com/oauth/access_token', body);
  const row = data?.data?.[0] || data; // Meta has returned both shapes
  if (!row?.access_token) throw new Error('Instagram did not return an access token');

  try {
    const { data: long } = await axios.get(`${GRAPH}/access_token`, {
      params: {
        grant_type: 'ig_exchange_token',
        client_secret: process.env.INSTAGRAM_APP_SECRET,
        access_token: row.access_token,
      },
    });
    return {
      token: long.access_token,
      expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : undefined,
      userId: row.user_id,
    };
  } catch (e) {
    // Fall back to the short-lived token (about 1 hour) rather than failing the login
    console.error('Instagram long-lived token exchange failed:', e.response?.data || e.message);
    return { token: row.access_token, expiresAt: new Date(Date.now() + 3600 * 1000), userId: row.user_id };
  }
}

export async function fetchInstagramProfile(token) {
  const { data } = await axios.get(`${GRAPH}/${ver()}/me`, {
    params: { fields: 'user_id,username,name,account_type,profile_picture_url', access_token: token },
  });
  return data;
}
