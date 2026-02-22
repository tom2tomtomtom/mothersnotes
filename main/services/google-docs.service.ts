import { shell, app } from 'electron';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { URL } from 'url';

const TOKEN_PATH = () => path.join(app.getPath('userData'), 'google-token.json');
const REDIRECT_PORT = 48372;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;
const SCOPES = ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive.file'];

interface TokenData {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

function getCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function loadToken(): TokenData | null {
  try {
    const data = fs.readFileSync(TOKEN_PATH(), 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function saveToken(token: TokenData): void {
  fs.writeFileSync(TOKEN_PATH(), JSON.stringify(token), 'utf-8');
}

async function exchangeCode(code: string, clientId: string, clientSecret: string): Promise<TokenData> {
  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = (await res.json()) as any;
  if (data.error) throw new Error(`OAuth error: ${data.error_description || data.error}`);

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: Date.now() + data.expires_in * 1000,
  };
}

async function refreshAccessToken(token: TokenData, clientId: string, clientSecret: string): Promise<TokenData> {
  const params = new URLSearchParams({
    refresh_token: token.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = (await res.json()) as any;
  if (data.error) throw new Error(`Token refresh error: ${data.error_description || data.error}`);

  return {
    access_token: data.access_token,
    refresh_token: token.refresh_token,
    expiry_date: Date.now() + data.expires_in * 1000,
  };
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  let token = loadToken();

  if (token) {
    // Refresh if expired (with 60s buffer)
    if (Date.now() > token.expiry_date - 60000) {
      token = await refreshAccessToken(token, clientId, clientSecret);
      saveToken(token);
    }
    return token.access_token;
  }

  // No token — run OAuth consent flow
  token = await runOAuthFlow(clientId, clientSecret);
  saveToken(token);
  return token.access_token;
}

function runOAuthFlow(clientId: string, clientSecret: string): Promise<TokenData> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url || '', `http://localhost:${REDIRECT_PORT}`);
        if (url.pathname !== '/oauth2callback') {
          res.writeHead(404);
          res.end();
          return;
        }

        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><h2>Authorization denied.</h2><p>You can close this tab.</p></body></html>');
          server.close();
          reject(new Error(`OAuth denied: ${error}`));
          return;
        }

        if (!code) {
          res.writeHead(400);
          res.end('Missing code');
          server.close();
          reject(new Error('No authorization code received'));
          return;
        }

        const token = await exchangeCode(code, clientId, clientSecret);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Authorized!</h2><p>You can close this tab and return to Mother\'s Notes.</p></body></html>');
        server.close();
        resolve(token);
      } catch (err) {
        res.writeHead(500);
        res.end('Error');
        server.close();
        reject(err);
      }
    });

    server.listen(REDIRECT_PORT, () => {
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', SCOPES.join(' '));
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      shell.openExternal(authUrl.toString());
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('OAuth flow timed out'));
    }, 120000);
  });
}

// Convert markdown to Google Docs API requests
function markdownToDocsRequests(markdown: string): any[] {
  const requests: any[] = [];
  const lines = markdown.split('\n');
  let index = 1; // Docs are 1-indexed

  for (const line of lines) {
    if (line.trim() === '') {
      const text = '\n';
      requests.push({ insertText: { location: { index }, text } });
      index += text.length;
      continue;
    }

    if (line.startsWith('---')) {
      const text = '\n';
      requests.push({ insertText: { location: { index }, text } });
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: index, endIndex: index + 1 },
          paragraphStyle: {
            borderBottom: { color: { color: { rgbColor: { red: 0.8, green: 0.8, blue: 0.8 } } }, width: { magnitude: 1, unit: 'PT' }, dashStyle: 'SOLID', padding: { magnitude: 8, unit: 'PT' } },
          },
          fields: 'borderBottom',
        },
      });
      index += text.length;
      continue;
    }

    // Headings
    let heading: string | null = null;
    let content = line;
    if (line.startsWith('### ')) {
      heading = 'HEADING_3';
      content = line.slice(4);
    } else if (line.startsWith('## ')) {
      heading = 'HEADING_2';
      content = line.slice(3);
    } else if (line.startsWith('# ')) {
      heading = 'HEADING_1';
      content = line.slice(2);
    }

    // Bullets
    let isBullet = false;
    if (content.startsWith('- [x] ') || content.startsWith('- [ ] ')) {
      const checked = content.startsWith('- [x] ');
      content = (checked ? '\u2611 ' : '\u2610 ') + content.slice(6);
      isBullet = true;
    } else if (content.startsWith('- ')) {
      content = content.slice(2);
      isBullet = true;
    } else if (content.startsWith('  - ')) {
      content = content.slice(4);
      isBullet = true;
    }

    // Strip inline markdown for the text, track bold ranges
    const boldRanges: { start: number; end: number }[] = [];
    const italicRanges: { start: number; end: number }[] = [];
    let cleanText = '';
    let i = 0;
    while (i < content.length) {
      if (content.slice(i, i + 2) === '**') {
        const endBold = content.indexOf('**', i + 2);
        if (endBold !== -1) {
          const boldStart = cleanText.length;
          const boldContent = content.slice(i + 2, endBold);
          cleanText += boldContent;
          boldRanges.push({ start: boldStart, end: cleanText.length });
          i = endBold + 2;
          continue;
        }
      }
      if (content[i] === '*' && content[i + 1] !== '*') {
        const endItalic = content.indexOf('*', i + 1);
        if (endItalic !== -1) {
          const italicStart = cleanText.length;
          cleanText += content.slice(i + 1, endItalic);
          italicRanges.push({ start: italicStart, end: cleanText.length });
          i = endItalic + 1;
          continue;
        }
      }
      cleanText += content[i];
      i++;
    }

    const text = cleanText + '\n';
    requests.push({ insertText: { location: { index }, text } });

    // Apply heading style
    if (heading) {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: index, endIndex: index + text.length },
          paragraphStyle: { namedStyleType: heading },
          fields: 'namedStyleType',
        },
      });
    }

    // Apply bullet style
    if (isBullet && !heading) {
      requests.push({
        createParagraphBullets: {
          range: { startIndex: index, endIndex: index + text.length },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
        },
      });
    }

    // Apply bold formatting
    for (const range of boldRanges) {
      requests.push({
        updateTextStyle: {
          range: { startIndex: index + range.start, endIndex: index + range.end },
          textStyle: { bold: true },
          fields: 'bold',
        },
      });
    }

    // Apply italic formatting
    for (const range of italicRanges) {
      requests.push({
        updateTextStyle: {
          range: { startIndex: index + range.start, endIndex: index + range.end },
          textStyle: { italic: true },
          fields: 'italic',
        },
      });
    }

    index += text.length;
  }

  return requests;
}

export const googleDocsService = {
  getStatus(): { configured: boolean; authenticated: boolean } {
    const creds = getCredentials();
    if (!creds) return { configured: false, authenticated: false };
    const token = loadToken();
    return { configured: true, authenticated: !!token };
  },

  async exportToGoogleDocs(markdown: string, title: string): Promise<string> {
    const creds = getCredentials();
    if (!creds) throw new Error('Google credentials not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local');

    const accessToken = await getAccessToken(creds.clientId, creds.clientSecret);

    // Create blank document
    const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Failed to create doc: ${err}`);
    }

    const doc = (await createRes.json()) as any;
    const docId = doc.documentId;

    // Build and apply formatting requests
    const requests = markdownToDocsRequests(markdown);
    if (requests.length > 0) {
      const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      });

      if (!updateRes.ok) {
        const err = await updateRes.text();
        console.error('Docs batch update error:', err);
        // Doc was created, just not formatted — still return URL
      }
    }

    const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
    shell.openExternal(docUrl);
    return docUrl;
  },
};
