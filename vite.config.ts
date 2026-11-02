import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    preact(),
    tailwindcss(),
    cssInjectedByJsPlugin()
  ],
  build: {
    lib: {
      entry: 'src/main.ts',
      name: 'IIROSE-MEDIA-WEB',
      fileName: () => `bundle.js`, // 只生成 UMD 文件
      formats: ['umd'] // 仅输出 UMD 格式
    },
    cssCodeSplit: false, // 不拆分 CSS
    rollupOptions: {
      output: {
        globals: {
          preact: 'Preact'
        }
      },
    }
  }
})
