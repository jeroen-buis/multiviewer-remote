import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import pkg from './package.json'

const APP_VERSION = pkg.version
const APP_BUILD_ID = `${pkg.version}-${Date.now()}`

// Post-processes dist/sw.js to substitute the cache-name placeholder with a per-build value
// so the activate handler can purge stale caches from previous deploys.
const injectSwVersion = () => ({
  name: 'inject-sw-version',
  apply: 'build' as const,
  closeBundle() {
    const swPath = path.resolve(__dirname, 'dist/sw.js')
    if (!fs.existsSync(swPath)) return
    const content = fs.readFileSync(swPath, 'utf-8')
    fs.writeFileSync(swPath, content.replace(/__APP_BUILD_ID__/g, APP_BUILD_ID))
  },
})

export default defineConfig({
  plugins: [react(), injectSwVersion()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
})
