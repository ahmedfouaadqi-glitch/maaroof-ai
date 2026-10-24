import * as React from 'react'

import { Body, Container, Head, Heading, Html, Img, Link, Text } from '@react-email/components'

/** Shared MAAROOF Ai look for every transactional email (logo, colours, footer). */
export const brand = {
  name: 'MAAROOF Ai',
  site: 'https://maaroofai.com',
  logo: 'https://maaroofai.com/icon-512.png',
  accent: '#7c5cff',
  ink: '#0b1020',
  body: '#4b5168',
  surface: '#ffffff',
}

export const main = { backgroundColor: '#f5f6fb', fontFamily: 'Arial, Helvetica, sans-serif', margin: '0' }
export const container = {
  backgroundColor: brand.surface,
  borderRadius: '14px',
  border: '1px solid #e7e9f2',
  margin: '24px auto',
  maxWidth: '520px',
  padding: '28px 28px 22px',
}
export const h1 = { fontSize: '21px', fontWeight: 'bold' as const, color: brand.ink, margin: '0 0 16px' }
export const text = { fontSize: '14px', color: brand.body, lineHeight: '1.6', margin: '0 0 20px' }
export const link = { color: brand.accent, textDecoration: 'underline' }
export const button = {
  backgroundColor: brand.accent,
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  border: `1px solid ${brand.accent}`,
  borderRadius: '10px',
  padding: '12px 22px',
  textDecoration: 'none',
  display: 'inline-block',
}
export const footerText = { fontSize: '11px', color: '#8c90a4', lineHeight: '1.6', margin: '26px 0 0' }
// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
export const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-card { background-color: #12131a !important; border-color: #262838 !important; }
    .dm-h1 { color: #ffffff !important; }
    .dm-text { color: #b8bcce !important; }
  }
  [data-ogsc] .dm-card { background-color: #12131a !important; border-color: #262838 !important; }
  [data-ogsc] .dm-h1 { color: #ffffff !important; }
  [data-ogsc] .dm-text { color: #b8bcce !important; }
`

/** Trilingual sign-off shown at the bottom of every email. */
export function BrandFooter({ note }: { note?: string }) {
  return (
    <>
      {note ? (
        <Text className="dm-text" style={footerText}>
          {note}
        </Text>
      ) : null}
      <Text style={footerText}>
        {brand.name} — Generative Engine Optimization worldwide ·{' '}
        <Link href={brand.site} style={link}>
          maaroofai.com
        </Link>
        <br />
        تحسين الظهور في محركات الذكاء الاصطناعي حول العالم · باشکردنی دەرکەوتن لە بزوێنەرەکانی زیرەکی دەستکرد
      </Text>
    </>
  )
}

/** Card shell: logo header, title, content, trilingual footer. */
export function BrandShell({
  title,
  dir = 'ltr',
  lang = 'en',
  footerNote,
  children,
}: {
  title: string
  dir?: 'ltr' | 'rtl'
  lang?: string
  footerNote?: string
  children: React.ReactNode
}) {
  return (
    <Html lang={lang} dir={dir}>
      <Head>
        <style>{darkModeCss}</style>
      </Head>
      <Body style={main}>
        <Container className="dm-card" style={container}>
          <Link href={brand.site}>
            <Img src={brand.logo} width="40" height="40" alt={brand.name} style={{ borderRadius: '10px' }} />
          </Link>
          <Heading className="dm-h1" style={h1}>
            {title}
          </Heading>
          {children}
          <BrandFooter note={footerNote} />
        </Container>
      </Body>
    </Html>
  )
}
