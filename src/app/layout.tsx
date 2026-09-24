import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SC Dandiya 2026 | Event Data Automation & Capture Dashboard',
  description:
    'Automated payment data extraction, pass & donation classification, duplicate prevention, and Google Sheets/Zapier synchronization for SC Dandiya 2026.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#090c16] text-slate-100 antialiased font-sans flex flex-col">
        {children}
      </body>
    </html>
  );
}
