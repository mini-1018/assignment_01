import type { Metadata } from "next";
import { QueryProvider } from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "HIDDEN KICE",
  description: "히든카이스 - 모두가 푸는 건 이유가 있습니다",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
