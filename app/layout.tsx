import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CMC Market Detective",
  description: "AI-powered crypto market investigation using CoinMarketCap data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
