import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MakeShift Audio - Synchronized PDF Reader",
  description:
    "Upload any PDF and listen to it as a high-quality audiobook with real-time synchronized text highlighting.",
  keywords: ["PDF audiobook", "synchronized reader", "text-to-speech", "ElevenLabs"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full overflow-hidden" suppressHydrationWarning>{children}</body>
    </html>
  );
}
