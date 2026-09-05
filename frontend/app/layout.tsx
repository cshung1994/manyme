import type { Metadata } from 'next'
import { Inter, Newsreader } from 'next/font/google'
import dynamic from 'next/dynamic'
import './globals.css'
import { NavBar } from '@/components/NavBar'

const Providers = dynamic(
  () => import('./providers').then(mod => ({ default: mod.Providers })),
  { ssr: false }
)

const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-body',
})

const displayFont = Newsreader({
  subsets: ['latin'],
  variable: '--font-display',
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'ManyMe 分身有術 — 按需使用達人經驗',
  description: '讓人們按需使用達人經驗的 AI 服務市集。攻略我看過了,但我家不是範例家庭。',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${bodyFont.variable} ${displayFont.variable} font-sans min-h-screen bg-background text-text-primary`}
        suppressHydrationWarning
      >
        <Providers>
          <div className="flex flex-col min-h-screen">
            <NavBar />
            <main className="flex-grow w-full">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
