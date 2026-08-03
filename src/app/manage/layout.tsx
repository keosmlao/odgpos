import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import BackOfficeShell from '@/components/BackOfficeShell'
import { getSession } from '@/lib/session'

export default async function ManageLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  return <BackOfficeShell>{children}</BackOfficeShell>
}
