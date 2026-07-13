import type { ThemeConfig } from 'antd'

export const themeTokens: ThemeConfig = {
  token: {
    // 品牌色 — Indigo 替代默认 Blue
    colorPrimary: '#6366f1',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#6366f1',

    // 圆角
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,

    // 字体
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
    fontSize: 14,
    fontSizeLG: 16,
    fontSizeSM: 12,

    // 间距
    paddingContentHorizontal: 16,
    paddingContentVertical: 12,

    // 阴影（仅亮色模式使用）
    colorBgElevated: '#ffffff',
  },
  components: {
    Card: {
      paddingLG: 20,
    },
    Table: {
      headerBg: 'rgba(0, 0, 0, 0.02)',
      rowHoverBg: 'rgba(99, 102, 241, 0.04)',
    },
    Modal: {
      borderRadiusLG: 12,
    },
    Button: {
      borderRadius: 8,
      controlHeight: 36,
    },
    Input: {
      borderRadius: 8,
      controlHeight: 36,
    },
    Menu: {
      itemBorderRadius: 8,
    },
  },
}
