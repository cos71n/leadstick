import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {},
  define: {
    'process.env': {}
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/widget.tsx'),
      name: 'LeadStick',
      formats: ['es', 'umd'],
      fileName: (format) => `leadstick.${format}.js`
    },
    rollupOptions: {
      external: [], // Bundle everything for single-file distribution
      output: {
        inlineDynamicImports: true, // Single file output
      }
    },
    cssCodeSplit: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
})
