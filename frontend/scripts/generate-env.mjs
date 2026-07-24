import { writeFileSync, mkdirSync } from 'fs';
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

// 1. Define the exact path where the file will be saved
const targetPath = resolve(__dirname, '../src/environments/environment.ts');

// 2. Extract just the directory path (../src/environments)
const targetDir = dirname(targetPath);

// 3. Create the directory structure if it doesn't already exist
mkdirSync(targetDir, { recursive: true });

// 4. Write the file safely now that the folder is guaranteed to exist
writeFileSync(targetPath, content);

console.log(`environment.ts → backendUrl=${backendUrl}`);