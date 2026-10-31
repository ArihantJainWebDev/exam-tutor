import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.REDPEN_BUILD_DIR ?? '.next',
  outputFileTracingIncludes: {
    '/*': ['./content/physics/**/*.json', './prompts/**/*.md', './mocks/**/*.json'],
  },
  outputFileTracingExcludes: {
    '/*': ['./data/**', './test/**'],
  },
};

export default config;
