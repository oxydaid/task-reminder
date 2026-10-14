import { toast } from '@/hooks/use-toast'

export const notify = {
  success: (msg: string) => toast({ title: 'Berhasil', description: msg }),
  error: (msg: string) => toast({ title: 'Error', description: msg, variant: 'destructive' }),
  info: (msg: string) => toast({ title: 'Info', description: msg })
}