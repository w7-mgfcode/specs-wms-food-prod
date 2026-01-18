/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Shell colors
                shell: {
                    dark: '#0a0f1e',
                    medium: '#1a2332',
                    nav: '#1e2a3f',
                    border: '#2a3f5f',
                },
                // Page colors
                page: {
                    dark: '#0a0e27',
                    medium: '#1a1f3a',
                    light: '#2a3352',
                },
                // Accent colors
                accent: {
                    cyan: '#00d9ff',
                    blue: '#4a9eff',
                    green: '#00ff88',
                    orange: '#ff8c42',
                    red: '#ff4757',
                    yellow: '#ffd93d',
                    purple: '#a55eea',
                },
                // Stream colors
                stream: {
                    a: '#ff6b9d',
                    b: '#4a9eff',
                    c: '#00ff88',
                },
                // Status colors
                status: {
                    pass: '#00ff88',
                    hold: '#ff8c42',
                    fail: '#ff4757',
                    processing: '#4a9eff',
                    pending: '#6b7a99',
                },
            },
            fontFamily: {
                mono: ["'Courier New'", 'monospace'],
                sans: ['-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'sans-serif'],
            },
            animation: {
                'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
                'spin-slow': 'spin 2s linear infinite',
                'flow': 'flow 2s linear infinite',
            },
            keyframes: {
                'pulse-glow': {
                    '0%, 100%': { boxShadow: '0 0 20px currentColor' },
                    '50%': { boxShadow: '0 0 40px currentColor' },
                },
                'flow': {
                    '0%': { backgroundPosition: '0 0' },
                    '100%': { backgroundPosition: '30px 0' },
                },
            },
        },
    },
    plugins: [],
}
