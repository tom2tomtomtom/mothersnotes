import { shell } from 'electron';
import { googleAuthService } from './google-auth.service';

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
    return {
      configured: googleAuthService.isConfigured(),
      authenticated: googleAuthService.isAuthenticated(),
    };
  },

  async exportToGoogleDocs(markdown: string, title: string): Promise<string> {
    const accessToken = await googleAuthService.getAccessToken();

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
