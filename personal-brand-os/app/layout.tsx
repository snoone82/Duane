import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

// Deep Focus refresh: Outfit — the same light geometric face as the
// approved Duane Bryan website direction — replaces Inter everywhere.
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-app",
  display: "swap",
});

const title = "Personal Brand OS";
const description = "Aligned Media's internal tool for running every personal-branding client in one place.";

export const metadata: Metadata = {
  title: {
    default: title,
    template: `%s — ${title}`,
  },
  description,
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1220",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={outfit.variable}>
      <body>{children}</body>
    </html>
  );
}
