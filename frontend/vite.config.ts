import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The backend URL can be overridden (e.g. to point at a test instance): NHI_API=http://localhost:8081 npm run dev
const api = process.env.NHI_API ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/engine': api,
      '/security': api,
    },
  },
});
