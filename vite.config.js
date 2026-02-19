import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build',
      rollupOptions: {
        output: {
          manualChunks: {
            'calendar': ['react-big-calendar', 'date-fns'],
            'vibe': ['@vibe/core', '@vibe/icons'],
            'holidays': ['@hebcal/core'],
            'charts': ['recharts'],
          }
        }
      }
    },
    plugins: [react()],
    server: {
      port: 8301,
      allowedHosts: ['.apps-tunnel.monday.app']
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/setupTests.js'],
      globals: true,
      css: { modules: { classNameStrategy: 'non-scoped' } }
    }
  };
});