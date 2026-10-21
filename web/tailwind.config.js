/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './app/**/*.{js,ts,jsx,tsx}', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Geist', 'sans-serif'],
        serif: ['Literata', 'Georgia', 'serif'],
        mono: ['"Chivo Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        luanna: {
          dark: '#11110f',
          text: '#161614',
          muted: '#5e5c56',
          prompt: '#b84421',
        },
        ancla: {
          canvas: '#f7f5f0',
          paper: '#fdfcfa',
          tray: '#eae6dd',
          obsidian: '#11110f',
          obsidianSurface: '#191916',
          ink: '#161614',
          inkSecondary: '#54524c',
          inkMuted: '#737068',
          line: '#e2ddd4',
          lineStrong: '#cbc4b8',
          signal: '#b84421',
          signalSoft: '#fbeee9',
          clinical: '#19674e',
          clinicalSoft: '#e8f3ee',
          amber: '#8a5a12',
          amberSoft: '#fbf3e4',
        },
      },
      transitionTimingFunction: {
        'out-strong': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out-strong': 'cubic-bezier(0.77, 0, 0.175, 1)',
        drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
}
