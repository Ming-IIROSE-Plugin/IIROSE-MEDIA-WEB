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
    // 宿站跑在现代浏览器 / Electron，代码本身已用可选链、class fields 与 Array.at；
    // 默认 target 会把现代语法降级出辅助代码（+7kB），这里压到 ES2022；
    // minify 用 terser 而不是默认的 esbuild：gzip 再小 ~3kB。
    // 改这两项后必须真机跑一次（语法兼容性不由单测覆盖）。
    target: 'es2022',
    minify: 'terser',
    rollupOptions: {
      output: {
        globals: {
          preact: 'Preact'
        }
      },
    }
  }
})
