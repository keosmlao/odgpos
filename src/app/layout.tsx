import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "POS System",
  description: "Point of Sale System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="lo">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
