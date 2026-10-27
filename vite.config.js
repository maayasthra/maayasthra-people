import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const built = new Date().toISOString();
// The version comes from package.json. The build date is when this build was made, which for the live site is the deploy.
// version.json lets a tab that has been open for a while notice that a newer build is live.
const versionFile = () => ({ name: 'version-file', generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: pkg.version, built }) }); } });
export default defineConfig({
  plugins: [react(), versionFile()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD_DATE__: JSON.stringify(built) }
});
