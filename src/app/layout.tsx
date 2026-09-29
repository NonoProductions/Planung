import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import ThemeSync, { themeInitScript } from "@/components/theme/ThemeSync";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Noes Planer",
  description: "A calm, focused daily planner for mindful productivity",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfbf8" },
    { media: "(prefers-color-scheme: dark)", color: "#151312" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${manrope.variable} grain-overlay h-full`}>
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
