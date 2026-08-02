import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { AccountProvider } from "@/contexts/AccountContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "TraderFiles",
  description: "Tu journal de trading personal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${spaceGrotesk.variable} ${inter.variable} font-body`} style={{ background: 'var(--color-bg)' }}>
  <ThemeProvider>
  <div className="bg-decor" aria-hidden="true" />
  <div style={{ position: 'relative', zIndex: 1, isolation: 'isolate' }}>
    <AccountProvider>{children}</AccountProvider>
  </div>
</ThemeProvider>
</body>
    </html>
  );
}