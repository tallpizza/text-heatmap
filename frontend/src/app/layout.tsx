import type { Metadata } from "next";
import { DM_Sans, Crimson_Pro } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const crimsonPro = Crimson_Pro({
  variable: "--font-crimson-pro",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Text Heatmap",
  description: "LLM attention 기반 텍스트 중요도 시각화",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" style={{ colorScheme: "light" }}>
      <body className={`${dmSans.variable} ${crimsonPro.variable}`}>
        {children}
      </body>
    </html>
  );
}
