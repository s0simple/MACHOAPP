import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MACHO App - Truck Transportation System",
  description: "Ghana's premier truck transportation and logistics platform connecting drivers with passengers and goods owners.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}