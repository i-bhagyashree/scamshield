/// <reference types="node" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // The GitHub Pages demo is served from /scamshield/; the normal app from /.
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: { '/api': 'http://localhost:5150' },
  },
})
