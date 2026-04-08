import path from 'path';

export const CONFIG = {
  baseURL: process.env['BASE_URL'] || 'https://taskflow.paraslace.in',
  credentials: {
    email: 'admin1@paraslace.in',
    password: process.env['TEST_PASSWORD'] || 'Admin123!',
  },
  viewport: { width: 1280, height: 720 },
  videoSize: { width: 1280, height: 720 },
  outputDir: path.resolve(__dirname, 'output'),
  /** Slow down actions by this many ms for smoother video */
  slowMo: 400,
  /** Pause duration (ms) after significant actions for viewer comprehension */
  pauseShort: 800,
  pauseMedium: 1500,
  pauseLong: 2500,
} as const;
