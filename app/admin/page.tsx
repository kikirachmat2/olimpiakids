import { redirect } from 'next/navigation'

export default function AdminPage() {
  // Arahkan default /admin langsung ke tab kontrol lomba
  redirect('/admin/kontrol')
}
