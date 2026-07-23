import { cp, mkdir, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = resolve(fileURLToPath(new URL('..', import.meta.url)));
const buildDirectory = resolve(projectDirectory, 'dist');
const clientDirectory = resolve(buildDirectory, 'client');
const serverDirectory = resolve(buildDirectory, 'server');

const workerSource = `const worker = {
  async fetch(request, env) {
    if (!env?.ASSETS || typeof env.ASSETS.fetch !== 'function') {
      return new Response('Static asset binding is unavailable', { status: 500 });
    }

    const response = await env.ASSETS.fetch(request);
    if (
      response.status !== 404 ||
      request.method !== 'GET' ||
      !(request.headers.get('accept') || '').includes('text/html')
    ) {
      return response;
    }

    const fallbackUrl = new URL(request.url);
    fallbackUrl.pathname = '/index.html';
    fallbackUrl.search = '';
    return env.ASSETS.fetch(new Request(fallbackUrl, request));
  },
};

export default worker;
`;

await mkdir(clientDirectory, { recursive: true });

for (const entry of await readdir(buildDirectory, { withFileTypes: true })) {
  if (entry.name === 'client' || entry.name === 'server' || entry.name === '.openai') {
    continue;
  }

  await cp(
    resolve(buildDirectory, entry.name),
    resolve(clientDirectory, entry.name),
    { recursive: entry.isDirectory() },
  );
}

await mkdir(serverDirectory, { recursive: true });
await writeFile(resolve(serverDirectory, 'index.js'), workerSource, 'utf8');
