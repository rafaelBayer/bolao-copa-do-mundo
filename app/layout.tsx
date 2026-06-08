import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bolao da Copa",
  description: "Bolao simples da Copa do Mundo para amigos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
