import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { websiteSchema, organizationSchema } from "@/lib/structured-data";
import { ToastProvider } from "@/components/toast";
import { ErrorBoundary } from "@/components/error-boundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "billionaire",
    template: "%s | billionaire",
  },
  description: "AI 与数字生活的无限可能 — 分享前沿工具、效率技巧和生活方式的思考",
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "billionaire",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [websiteSchema(), organizationSchema()],
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:px-4 focus:py-2 focus:bg-zinc-900 focus:text-white focus:dark:bg-zinc-100 focus:dark:text-zinc-900">
          跳到主要内容
        </a>
        <Providers>
          <ThemeProvider>
            <ToastProvider>
              <ErrorBoundary>
                <Header />
                <main id="main-content" className="flex-1">{children}</main>
                <Footer />
              </ErrorBoundary>
            </ToastProvider>
          </ThemeProvider>
        </Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
