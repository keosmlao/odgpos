import type { ReactNode } from 'react'
import BackOfficeShell from '@/components/BackOfficeShell'

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <BackOfficeShell>{children}</BackOfficeShell>
}
