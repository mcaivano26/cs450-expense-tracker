
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      // Locally the backend is on localhost:4002. In Docker Compose, localhost is this frontend container,
      // so docker-compose.yml sets API_PROXY_TARGET=http://api:4002 (the backend service's name).
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:4002'
    }
  }
});