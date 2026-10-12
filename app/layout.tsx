import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ORVIO — Restaurant POS",
  description: "რესტორნის შეკვეთებისა და ანგარიშსწორების საცდელი სისტემა.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ka">
      <body className="antialiased">{children}</body>
    </html>
  );
}
