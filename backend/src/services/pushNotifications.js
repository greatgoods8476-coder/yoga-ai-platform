// Sends push notifications through Expo's push service. This needs no
// APNs/FCM credentials of our own — Expo's relay handles both platforms for
// any app built with Expo. https://exp.host/--/api/v2/push/send is a public
// HTTPS endpoint; the only thing that gates it is having a valid Expo push
// token, which the client obtains via expo-notifications.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100; // Expo's documented max messages per request

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// tokens: array of Expo push token strings. Returns { sent, errors }.
async function sendExpoPush(tokens, { title, body, data } = {}) {
  const validTokens = tokens.filter((t) => typeof t === 'string' && t.startsWith('ExponentPushToken'));
  if (validTokens.length === 0) return { sent: 0, errors: [] };

  const messages = validTokens.map((to) => ({ to, title, body, data, sound: 'default' }));
  const errors = [];
  let sent = 0;

  for (const batch of chunk(messages, CHUNK_SIZE)) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        errors.push(`HTTP ${res.status}`);
        continue;
      }
      const results = json?.data || [];
      for (const r of results) {
        if (r.status === 'ok') sent += 1;
        else errors.push(r.message || r.status);
      }
    } catch (err) {
      errors.push(err.message);
    }
  }

  return { sent, errors };
}

module.exports = { sendExpoPush };
