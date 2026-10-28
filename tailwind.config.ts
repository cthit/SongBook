import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const config: Config = {
  content: ['./src/app/**/*.{js,ts,jsx,tsx,mdx}', './src/components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // IT turquoise, same palette as EatIT
        turquoise: {
          DEFAULT: '#0ae5f5',
          '100': '#e7fdfe',
          '200': '#c7f5f5',
          '300': '#a7ebeb',
          '400': '#0ae5f5',
          '500': '#09cdda',
          '600': '#08b7c4',
          '700': '#1298a1',
          '800': '#0e7f7f',
          '900': '#0c6b6b',
        },
      },
    },
  },
  plugins: [typography],
}
export default config
