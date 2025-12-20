import type React from 'react'
import { Link, useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/8bit/button'

export default function AppShell(props: {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const location = useLocation()
  const pathname = location.pathname
  const nav = [
    { label: '首页', to: '/' },
    { label: '创建课程', to: '/course/create' },
    { label: 'PromptOps', to: '/promptops' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="retro text-sm font-semibold tracking-tight text-slate-900">
              Rematrix
            </div>
            <nav className="hidden items-center gap-2 md:flex">
              {nav.map((item) => {
                const active = pathname === item.to
                return (
                  <Button
                    key={item.to}
                    asChild
                    variant={active ? 'default' : 'outline'}
                    size="sm"
                  >
                    <Link to={item.to}>{item.label}</Link>
                  </Button>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">{props.actions}</div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        {(props.title || props.subtitle) && (
          <div className="mb-6">
            {props.title && (
              <h1 className="retro text-2xl font-semibold tracking-tight text-slate-900">
                {props.title}
              </h1>
            )}
            {props.subtitle && (
              <p className="retro mt-1 text-sm text-slate-600">{props.subtitle}</p>
            )}
          </div>
        )}

        {props.children}
      </main>
    </div>
  )
}
