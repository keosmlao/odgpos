import type { ReactNode } from 'react'
import BackOfficeShell from '@/components/BackOfficeShell'

export default function ManageLayout({ children }: { children: ReactNode }) {
  return <BackOfficeShell>{children}</BackOfficeShell>
}
