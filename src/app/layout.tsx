import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Satya",
  description: "Build your knowledge graph. Truth emerges from connections.",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Satya",
    description: "Build your knowledge graph. Truth emerges from connections.",
    siteName: "Satya",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Satya",
    description: "Build your knowledge graph. Truth emerges from connections.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
