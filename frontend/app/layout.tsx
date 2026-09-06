import './globals.css';
import type { ReactNode } from 'react';
import { AppChrome } from '@/components/AppChrome';

export const metadata = {
  title: 'PropFirm',
  description: 'Evaluation challenges — modular monolith demo',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
