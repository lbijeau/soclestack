import { AuthenticatedLayout } from '@/components/layouts/authenticated-layout';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
