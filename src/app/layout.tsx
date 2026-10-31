import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import '../styles/tokens.css';

export const metadata: Metadata = {
  title: 'Redpen — adaptive exam-prep tutor',
  description:
    'A Class 10 Physics tutor that keeps a per-concept mastery model, reads the reasoning in a wrong answer to name the misconception, and asks the next question because of it.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
