import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { attachGlobalClickSound } from "@/lib/sound";
import { attachDevtoolsGuard } from "@/lib/devtools-guard";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "GEO-Iraq · Become the Source AI Trusts" },
      { name: "description", content: "Generative Engine Optimization for Iraq. Part of Marouf Intelligence. Test, score and optimize your content so ChatGPT, Gemini and Claude cite you in EN, AR, KU." },
      { name: "author", content: "Marouf Intelligence" },
      { property: "og:site_name", content: "GEO-Iraq" },
      { property: "og:title", content: "GEO-Iraq · Become the Source AI Trusts" },
      { property: "og:description", content: "Generative Engine Optimization for Iraq. Part of Marouf Intelligence. Test, score and optimize your content so ChatGPT, Gemini and Claude cite you in EN, AR, KU." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "GEO-Iraq · Become the Source AI Trusts" },
      { name: "twitter:description", content: "Generative Engine Optimization for Iraq. Part of Marouf Intelligence. Test, score and optimize your content so ChatGPT, Gemini and Claude cite you in EN, AR, KU." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/1de2c0c7-afc6-4e67-b025-5e324daf8445" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/1de2c0c7-afc6-4e67-b025-5e324daf8445" },
      { name: "theme-color", content: "#0b0f1a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "GEO-Iraq" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "google-site-verification", content: "KG0z4EF5ZvR3yjDn91E9qOb1v0vLnocoSB4pIeGoEEg" },
    ],
    links: [
      { rel: "icon", href: "/icon-512.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Marouf Intelligence",
          url: "https://geoiraq.com",
          brand: "GEO-Iraq",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "GEO-Iraq",
          url: "https://geoiraq.com",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function usePreviewAwareManifest() {
  useEffect(() => {
    const existing = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const token = new URLSearchParams(window.location.search).get("__lovable_token");
    const href = token ? `/manifest.webmanifest?__lovable_token=${encodeURIComponent(token)}` : "/manifest.webmanifest";
    if (existing) {
      existing.href = href;
      return;
    }
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = href;
    document.head.appendChild(link);
  }, []);
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  usePreviewAwareManifest();
  useEffect(() => { attachGlobalClickSound(); attachDevtoolsGuard(); }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
