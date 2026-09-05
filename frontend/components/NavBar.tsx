'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectWalletButton } from './wallet/ConnectWalletButton'

export function NavBar() {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navLink = (href: string, label: string, isActive: boolean) => (
    <Link
      href={href}
      onClick={() => setIsMobileMenuOpen(false)}
      className={`text-xs uppercase tracking-widest transition-colors ${
        isActive
          ? 'border-b-2 border-text-primary text-text-primary'
          : 'text-text-tertiary hover:text-text-primary'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <nav className="sticky top-0 z-50 bg-surface-dim">
      <div className="mx-auto flex max-w-[1920px] items-center justify-between px-4 sm:px-8 lg:px-24 py-4 lg:py-8">
        <div className="flex items-center gap-4 lg:gap-12">
          <button 
            type="button"
            className="md:hidden text-text-primary flex items-center justify-center"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <span className="material-symbols-outlined">{isMobileMenuOpen ? 'close' : 'menu'}</span>
          </button>
          <Link href="/" className="font-display text-3xl font-bold tracking-tighter text-text-primary">
            分身有術
          </Link>
          <div className="hidden md:flex gap-8">
            {navLink('/agents', 'Agents', pathname === '/agents' || (pathname?.startsWith('/agents/') ?? false))}
            {navLink('/agents/new', 'Upload', pathname === '/agents/new')}
            {navLink('/studio', 'Studio', pathname?.startsWith('/studio') ?? false)}
            {navLink('/sessions', 'Sessions', pathname?.startsWith('/sessions') ?? false)}
            {navLink('/settings', 'Settings', pathname?.startsWith('/settings') ?? false)}
          </div>
        </div>
        <ConnectWalletButton />
      </div>
      
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-border-subtle bg-surface-dim">
          <div className="flex flex-col px-4 sm:px-8 py-4 gap-6">
            {navLink('/agents', 'Agents', pathname === '/agents' || (pathname?.startsWith('/agents/') ?? false))}
            {navLink('/agents/new', 'Upload', pathname === '/agents/new')}
            {navLink('/studio', 'Studio', pathname?.startsWith('/studio') ?? false)}
            {navLink('/sessions', 'Sessions', pathname?.startsWith('/sessions') ?? false)}
            {navLink('/settings', 'Settings', pathname?.startsWith('/settings') ?? false)}
          </div>
        </div>
      )}
    </nav>
  )
}
