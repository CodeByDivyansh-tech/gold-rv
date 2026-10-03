import { defineConfig } from 'vite'

// The site is plain HTML + JS (see public/app). Vite is only used for `npm run dev`.
export default defineConfig({
  base: './',
  server: { port: 3000 },
})
