import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const PAGE_TITLE = "ARGUS";
const PAGE_DESCRIPTION =
  "Argus is an agentic smart-contract security copilot: deterministic static analysis, SWC retrieval, and human-in-the-loop triage.";
const SITE_URL = "https://argus-copilot.vercel.app";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  // Shared links (LinkedIn, Slack, email) render a bare URL without these.
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: SITE_URL,
    type: "website",
    images: [{ url: 'https://argus-copilot.vercel.app/og.png', width: 1200, height: 630, alt: 'ARGUS' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ['https://argus-copilot.vercel.app/og.png'],
  },
  icons: { icon: "/favicon.svg" },
};

const THEME_BOOT = `(function(){try{var t=localStorage.getItem("argus-theme");if(t!=="light"&&t!=="dark")t="dark";var r=document.documentElement;r.setAttribute("data-theme",t);r.style.colorScheme=t;}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
