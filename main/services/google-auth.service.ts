import { shell, app } from 'electron';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { URL } from 'url';

const TOKEN_PATH = () => path.join(app.getPath('userData'), 'google-token.json');
const REDIRECT_PORT = 48372;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

export interface GoogleAuthStatus {
  configured: boolean;
  authenticated: boolean;
  email: string | null;
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

function deleteToken(): void {
  try {
    fs.unlinkSync(TOKEN_PATH());
  } catch {
    // Already deleted
  }
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

let activeOAuthServer: http.Server | null = null;

function runOAuthFlow(clientId: string, clientSecret: string): Promise<TokenData> {
  // Kill any leftover server from a previous attempt
  if (activeOAuthServer) {
    try { activeOAuthServer.close(); } catch {}
    activeOAuthServer = null;
  }

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

    activeOAuthServer = server;

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

export const googleAuthService = {
  isConfigured(): boolean {
    return !!getCredentials();
  },

  isAuthenticated(): boolean {
    return !!loadToken();
  },

  async getAccessToken(): Promise<string> {
    const creds = getCredentials();
    if (!creds) throw new Error('Google credentials not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local');

    let token = loadToken();

    if (token) {
      // Refresh if expired (with 60s buffer)
      if (Date.now() > token.expiry_date - 60000) {
        token = await refreshAccessToken(token, creds.clientId, creds.clientSecret);
        saveToken(token);
      }
      return token.access_token;
    }

    // No token — run OAuth consent flow
    token = await runOAuthFlow(creds.clientId, creds.clientSecret);
    saveToken(token);
    return token.access_token;
  },

  async connect(): Promise<GoogleAuthStatus> {
    const creds = getCredentials();
    if (!creds) throw new Error('Google credentials not configured');

    const token = await runOAuthFlow(creds.clientId, creds.clientSecret);
    saveToken(token);

    const email = await this.getUserEmail(token.access_token);
    return { configured: true, authenticated: true, email };
  },

  async disconnect(): Promise<void> {
    const token = loadToken();
    if (token) {
      // Revoke token with Google
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${token.access_token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      } catch {
        // Best effort — token may already be expired
      }
    }
    deleteToken();
  },

  async getUserEmail(accessToken?: string): Promise<string | null> {
    try {
      const token = accessToken || await this.getAccessToken();
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as any;
      return data.email || null;
    } catch {
      return null;
    }
  },

  async getStatus(): Promise<GoogleAuthStatus> {
    const configured = this.isConfigured();
    const authenticated = this.isAuthenticated();
    let email: string | null = null;

    if (authenticated) {
      try {
        email = await this.getUserEmail();
      } catch {
        // Token might be expired, that's fine for status check
      }
    }

    return { configured, authenticated, email };
  },
};
