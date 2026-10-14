import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hermes — Team workspace",
  description: "A calm, clear space to move projects forward together.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
