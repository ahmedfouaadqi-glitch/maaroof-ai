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
import { CountryProvider } from "@/lib/use-country";
import SiteBackground from "@/components/backgrounds/SiteBackground";

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
      { title: "MAAROOF Ai — Generative Engine Optimization for MENA" },
      { name: "description", content: "MAAROOF Ai helps brands get cited by AI search engines across Iraq and MENA, in Arabic, Kurdish and English." },
      { name: "author", content: "Marouf Intelligence" },
      { property: "og:site_name", content: "MAAROOF Ai" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/T5QwGL7BdxM22WLZokA0sQbrC1F2/social-images/social-1784162912640-width_550.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/T5QwGL7BdxM22WLZokA0sQbrC1F2/social-images/social-1784162912640-width_550.webp" },
      { name: "theme-color", content: "#0b0b1f" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "MAAROOF Ai" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "google-site-verification", content: "KG0z4EF5ZvR3yjDn91E9qOb1v0vLnocoSB4pIeGoEEg" },
    ],
    links: [
      { rel: "icon", href: "/icon-512.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "preload",
        as: "style",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Work+Sans:wght@300;400;500;600;700&family=Noto+Kufi+Arabic:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Work+Sans:wght@300;400;500;600;700&family=Noto+Kufi+Arabic:wght@400;500;600;700&display=swap",
      },
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
          brand: "MAAROOF Ai",
          alternateName: "GEO-Iraq",
          logo: "https://geoiraq.com/icon-512.png",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "MAAROOF Ai",
          alternateName: "GEO-Iraq",
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
      <CountryProvider>
        <SiteBackground />
        <PageTransition>
          <Outlet />
        </PageTransition>
      </CountryProvider>
    </QueryClientProvider>
  );
}

function PageTransition({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = router.state.location.pathname;
  return (
    <div key={pathname} className="motion-fade-in">
      {children}
    </div>
  );
}
