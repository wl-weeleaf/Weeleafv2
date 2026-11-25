import type { Metadata } from "next";
import LeafyEnvironmentClient from '@/components/leafy/LeafyEnvironmentClient';
import GuestAccessGate from '@/components/leafy/GuestAccessGate';
import AutoInterfaceTranslation from '@/components/leafy/AutoInterfaceTranslation';
import "./globals.css";

export const metadata: Metadata = {
  title: "Leafy 0.1",
  description: "Et interaktivt rum til Leafys bevægelser, udtryk og samtaler.",
  robots: {index:false,follow:false},
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/leafy-192-v2.png",
    shortcut: "/icons/leafy-192-v2.png",
    apple: "/icons/leafy-192-v2.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da">
      <body className="antialiased"><GuestAccessGate>{children}<LeafyEnvironmentClient/><AutoInterfaceTranslation/></GuestAccessGate></body>
    </html>
  );
}
