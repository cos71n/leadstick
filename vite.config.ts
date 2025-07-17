import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  plugins: [],
  resolve: {
    alias: {
      "react": "preact/compat",
      "react-dom": "preact/compat"
    }
  },
  define: {
    'process.env': {}
  },
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'Fragment'
  },
  server: {
    open: true
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/widget.tsx'),
      name: 'LeadStick',
      formats: ['umd'],
      fileName: () => 'widget.js'
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
        drop_console: false,
        drop_debugger: true
      }
    }
  }
})
