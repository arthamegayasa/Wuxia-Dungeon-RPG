import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Phase 2B-2 Task 24: pin Azure Peaks JSON content and gameplay registries
        // into a separate chunk so the cold-start bundle stays under the 450 KB limit.
        // All files here are loaded lazily via azurePeaksLoader.ts dynamic imports.
        manualChunks: (id: string) => {
          if (id.includes('content/regions/azure_peaks')) return 'azure-peaks';
          if (id.includes('content/events/azure_peaks/')) return 'azure-peaks';
          if (id.includes('content/snippets/azure_peaks')) return 'azure-peaks';
          if (id.includes('content/techniques/techniques.json')) return 'azure-peaks';
          if (id.includes('content/items/items.json')) return 'azure-peaks';
          if (id.includes('content/echoes/echoes.json')) return 'azure-peaks';
          if (id.includes('content/memories/memories.json')) return 'azure-peaks';
          return undefined;
        },
      },
    },
  },
});
