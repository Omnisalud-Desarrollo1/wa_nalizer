import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

const content = `// Generado por scripts/generate-env.mjs — no editar a mano.
// Setea BACKEND_URL en las variables de entorno de Vercel/Render.
export const environment = {
  backendUrl: '${backendUrl}',
};
`;

writeFileSync(resolve(__dirname, '../src/environments/environment.ts'), content);
console.log(`environment.ts → backendUrl=${backendUrl}`);
