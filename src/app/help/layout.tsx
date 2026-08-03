import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import BackOfficeShell from '@/components/BackOfficeShell'
import { getSession } from '@/lib/session'

// /help is linked from the back-office sidebar — keep it inside the shell
// and behind the same session guard as /manage and /settings.
export default async function HelpLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  return <BackOfficeShell>{children}</BackOfficeShell>
}
