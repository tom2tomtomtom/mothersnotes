// Standalone Node.js script to call Claude API
// Reads input from stdin, writes response to stdout
// Runs outside Electron's sandboxed network stack
const https = require('https');

let inputData = '';
process.stdin.on('data', (chunk) => (inputData += chunk));
process.stdin.on('end', () => {
  const input = JSON.parse(inputData);

  const body = JSON.stringify({
    model: input.model,
    max_tokens: 8192,
    system: input.system,
    messages: [{ role: 'user', content: input.userMessage }],
  });

  const req = https.request(
    {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': input.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    },
    (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            const text = parsed.content?.[0]?.text;
            if (text) {
              process.stdout.write(text);
              process.exit(0);
            } else {
              process.stderr.write('No text in response');
              process.exit(1);
            }
          } catch (e) {
            process.stderr.write('Parse error: ' + data.slice(0, 500));
            process.exit(1);
          }
        } else {
          process.stderr.write(`API ${res.statusCode}: ${data.slice(0, 500)}`);
          process.exit(1);
        }
      });
    }
  );

  req.on('error', (err) => {
    process.stderr.write('Network error: ' + err.message);
    process.exit(1);
  });

  req.setTimeout(120000, () => {
    req.destroy();
    process.stderr.write('Timeout');
    process.exit(1);
  });

  req.write(body);
  req.end();
});
