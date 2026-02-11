import type { ThemeConfig } from 'antd';

const antdTheme: ThemeConfig = {
    token: {
        colorPrimary: '#007AFF', // macOS Blue
        colorSuccess: '#34C759', // macOS Green
        colorWarning: '#FF9500', // macOS Orange
        colorError: '#FF3B30',   // macOS Red
        colorInfo: '#007AFF',

        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        fontSize: 14,

        borderRadius: 8,
        borderRadiusSM: 6,
        borderRadiusLG: 10,

        colorBgLayout: '#F5F5F7', // macOS Background Gray
        colorBgContainer: '#FFFFFF',

        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        boxShadowSecondary: '0 2px 8px rgba(0, 0, 0, 0.06)',
    },
    components: {
        Button: {
            borderRadius: 8,
            controlHeight: 32,
            controlHeightSM: 24,
            controlHeightLG: 40,
            fontWeight: 500,
            defaultShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            primaryShadow: '0 2px 4px rgba(0, 122, 255, 0.2)',
        },
        Input: {
            borderRadius: 8,
            controlHeight: 32,
            controlHeightSM: 24,
            controlHeightLG: 40,
            activeShadow: '0 0 0 2px rgba(0, 122, 255, 0.2)',
        },
        Select: {
            borderRadius: 8,
            controlHeight: 32,
            controlHeightSM: 24,
            controlHeightLG: 40,
        },
        Card: {
            borderRadiusLG: 12,
            boxShadowTertiary: '0 4px 24px rgba(0, 0, 0, 0.04)',
        },
        Modal: {
            borderRadiusLG: 16,
            boxShadow: '0 20px 48px rgba(0, 0, 0, 0.16)',
        },
        Table: {
            borderRadiusLG: 8,
            headerBg: 'transparent',
            headerColor: '#888888',
            headerSplitColor: 'transparent',
        },
        Menu: {
            itemBorderRadius: 8,
            subMenuItemBorderRadius: 8,
        },
        Layout: {
            bodyBg: '#F5F5F7',
            headerBg: 'rgba(255, 255, 255, 0.8)',
            siderBg: 'rgba(255, 255, 255, 0.6)',
        },
        Typography: {
            fontFamilyCode: "'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
        }
    },
};

export default antdTheme;
