import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Provider } from "./provider";
import { HydrationBoundary } from "@/components/hydration-boundary";
import { ErrorBoundaryWrapper } from "@/components/error-boundary-wrapper";
import { AgentationProvider } from "@/components/agentation-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "SketchItUp - Enterprise Task Management Suite | ERP Platform",
    template: "%s - SketchItUp",
  },
  description: "The enterprise task management and sprint orchestration suite engineered by SketchItUp ERP platform makers. Connect operations, manufacturing, and cross-functional teams.",
  keywords: ["SketchItUp", "ERP task management", "enterprise sprint tracking", "operations orchestration", "kanban", "agile ERP"],
  authors: [{ name: "SketchItUp" }],
  creator: "SketchItUp",
  publisher: "SketchItUp",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://sketchitup.local/",
    siteName: "SketchItUp Task Suite",
    title: "SketchItUp - Enterprise Task Management Suite | ERP Platform",
    description: "The enterprise task management and sprint orchestration suite engineered by SketchItUp ERP platform makers.",
    images: [
      {
        url: "/open-graph.png",
        width: 1200,
        height: 630,
        alt: "SketchItUp",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SketchItUp - Enterprise Task Management Suite | ERP Platform",
    description: "The enterprise task management and sprint orchestration suite engineered by SketchItUp ERP platform makers.",
    images: ["/open-graph.png"],
  },
  alternates: {
    canonical: "/",
  },
  category: "enterprise productivity",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <meta name="google-site-verification" content="Tt-T3oOKSZ7mMbdBRswKjFzxP2Okmgt4sSHK9BXt8jo" />
        <script defer src="https://cloud.umami.is/script.js" data-website-id="158d23fd-3fec-46cb-a533-9f1136de3fe7"></script>
      </head>
      <body className={inter.className}>
        <ErrorBoundaryWrapper>
          <HydrationBoundary>
            <Provider>
              {children}
              <AgentationProvider />
            </Provider>
          </HydrationBoundary>
        </ErrorBoundaryWrapper>
      </body>
    </html>
  );
}
