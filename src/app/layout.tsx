import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Proposal Studio",
    template: "%s | Proposal Studio",
  },
  description: "Create, collaborate on, and send pixel-perfect client proposals with real-time editing, AI generation, and one-click acceptance.",
  keywords: ["proposal", "client proposal", "collaborative editor", "AI proposal", "agency tool"],
  authors: [{ name: "Proposal Studio" }],
  robots: { index: false, follow: false }, // private SaaS — not for public indexing
  openGraph: {
    type: "website",
    siteName: "Proposal Studio",
    title: "Proposal Studio",
    description: "Collaborative proposal editor with AI generation and real-time comments.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
