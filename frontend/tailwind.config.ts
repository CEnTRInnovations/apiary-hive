import type { Config } from 'tailwindcss'
import base from '@centrinnovations/design'

export default {
  presets: [base as Config],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
} satisfies Config
