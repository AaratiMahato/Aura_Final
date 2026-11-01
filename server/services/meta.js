import axios from 'axios';
import { encrypt } from '../utils/crypto.js';

const graph = () => `https://graph.facebook.com/${process.env.GRAPH_VERSION || 'v23.0'}`;
const errMsg = (e) => e.response?.data?.error?.message || e.message;

export const META_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'business_management',
];

// FACEBOOK_LOGIN_ONLY=true  -> only sign in (no Page/Instagram permissions). Use it if Meta says "Invalid Scopes".
// FACEBOOK_SCOPES=public_profile  -> exact list to request (comma separated). Overrides everything else.
//   Use it when Meta says "Invalid Scopes" for permissions your app does not have yet.
export const loginScopes = () => {
  const custom = (process.env.FACEBOOK_SCOPES || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (custom.length) return custom;
  return process.env.FACEBOOK_LOGIN_ONLY === 'true' ? ['public_profile', 'email'] : ['public_profile', 'email', ...META_SCOPES];
};

export async function fetchProfile(userToken) {
  const { data } = await axios.get(`${graph()}/me`, {
    params: { fields: 'id,name,email,picture.width(200)', access_token: userToken },
  });
  return data;
}

export async function exchangeCode(code, redirectUri) {
  const { data: short } = await axios.get(`${graph()}/oauth/access_token`, {
    params: {
      client_id: process.env.FACEBOOK_APP_ID,
      client_secret: process.env.FACEBOOK_APP_SECRET,
      redirect_uri: redirectUri,
      code,
    },
  });
  const { data: long } = await axios.get(`${graph()}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: process.env.FACEBOOK_APP_ID,
      client_secret: process.env.FACEBOOK_APP_SECRET,
      fb_exchange_token: short.access_token,
    },
  });
  return long.access_token;
}

// First Page the user manages (preferring one with a linked Instagram business account)
export async function fetchPage(userToken) {
  const { data } = await axios.get(`${graph()}/me/accounts`, {
    params: {
      fields: 'id,name,access_token,instagram_business_account{id,username}',
      access_token: userToken,
    },
  });
  const pages = data.data || [];
  return pages.find((p) => p.instagram_business_account) || pages[0] || null;
}

// Every Page the user manages (each with its linked Instagram business account, if any)
export async function fetchPages(userToken) {
  const { data } = await axios.get(`${graph()}/me/accounts`, {
    params: {
      fields: 'id,name,access_token,instagram_business_account{id,username}',
      limit: 100,
      access_token: userToken,
    },
  });
  return data.data || [];
}

// Stores all Pages on the user and activates one (the previous choice if it still exists,
// otherwise the first Page that has Instagram linked, otherwise the first Page).
export function setConnectedPages(user, pages, preferId) {
  const list = pages.map((p) => ({
    pageId: p.id,
    pageName: p.name,
    pageToken: encrypt(p.access_token),
    igUserId: p.instagram_business_account?.id,
    igUsername: p.instagram_business_account?.username,
  }));
  const active = list.find((p) => p.pageId === preferId) || list.find((p) => p.igUserId) || list[0];
  if (!active) return false;
  user.meta = { ...active, pages: list, connectedAt: new Date() };
  return true;
}

// Switches which stored Page the user posts to
export function selectPage(user, pageId) {
  const p = user.meta?.pages?.find((x) => x.pageId === pageId);
  if (!p) return false;
  user.meta.pageId = p.pageId;
  user.meta.pageName = p.pageName;
  user.meta.pageToken = p.pageToken;
  user.meta.igUserId = p.igUserId;
  user.meta.igUsername = p.igUsername;
  return true;
}

// Uploads the image file itself, so it works from localhost (no public URL / ngrok).
// One photo -> normal photo post. Several photos -> one multi-photo post.
export async function publishFacebook({ pageId, pageToken, imageBuffer, imageBuffers, message }) {
  const buffers = imageBuffers?.length ? imageBuffers : [imageBuffer];
  try {
    if (buffers.length === 1) {
      const fd = new FormData();
      fd.append('source', new Blob([buffers[0]], { type: 'image/jpeg' }), 'photo.jpg');
      fd.append('caption', message);
      fd.append('access_token', pageToken);
      const res = await fetch(`${graph()}/${pageId}/photos`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) return { ok: false, error: data.error.message };
      return { ok: true, id: data.post_id || data.id };
    }

    // 1) upload every photo unpublished, 2) attach them all to one feed post
    const ids = [];
    for (const [i, buf] of buffers.entries()) {
      const fd = new FormData();
      fd.append('source', new Blob([buf], { type: 'image/jpeg' }), `photo-${i + 1}.jpg`);
      fd.append('published', 'false');
      fd.append('access_token', pageToken);
      const res = await fetch(`${graph()}/${pageId}/photos`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) return { ok: false, error: data.error.message };
      ids.push(data.id);
    }
    const body = new URLSearchParams({ message, access_token: pageToken });
    ids.forEach((id, i) => body.append(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
    const res = await fetch(`${graph()}/${pageId}/feed`, { method: 'POST', body });
    const data = await res.json();
    if (data.error) return { ok: false, error: data.error.message };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

// waits until Instagram has processed a media container
async function waitForContainer(id, pageToken) {
  for (let i = 0; i < 8; i++) {
    const { data: s } = await axios.get(`${graph()}/${id}`, {
      params: { fields: 'status_code', access_token: pageToken },
    });
    if (s.status_code === 'FINISHED' || !s.status_code) return true;
    if (s.status_code === 'ERROR') return false;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return true;
}

// One photo -> normal post. Several photos -> carousel (Instagram allows 2-10).
export async function publishInstagram({ igUserId, pageToken, imageUrl, imageUrls, caption }) {
  const urls = imageUrls?.length ? imageUrls : [imageUrl];
  try {
    let creationId;
    if (urls.length === 1) {
      const { data: c } = await axios.post(`${graph()}/${igUserId}/media`, null, {
        params: { image_url: urls[0], caption, access_token: pageToken },
      });
      if (!(await waitForContainer(c.id, pageToken))) return { ok: false, error: 'Instagram could not process the image' };
      creationId = c.id;
    } else {
      const children = [];
      for (const url of urls) {
        const { data: child } = await axios.post(`${graph()}/${igUserId}/media`, null, {
          params: { image_url: url, is_carousel_item: true, access_token: pageToken },
        });
        if (!(await waitForContainer(child.id, pageToken))) return { ok: false, error: 'Instagram could not process one of the images' };
        children.push(child.id);
      }
      const { data: parent } = await axios.post(`${graph()}/${igUserId}/media`, null, {
        params: { media_type: 'CAROUSEL', children: children.join(','), caption, access_token: pageToken },
      });
      if (!(await waitForContainer(parent.id, pageToken))) return { ok: false, error: 'Instagram could not process the carousel' };
      creationId = parent.id;
    }
    const { data: p } = await axios.post(`${graph()}/${igUserId}/media_publish`, null, {
      params: { creation_id: creationId, access_token: pageToken },
    });
    return { ok: true, id: p.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
