// 全局 R3F JSX 类型声明 — 确保 Three.js 元素在 TSX 中被识别
// React 19 使用 React.JSX.IntrinsicElements
import type { ThreeElements } from '@react-three/fiber'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

declare module 'react/jsx-dev-runtime' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
