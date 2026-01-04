import { AuthenticatedLayout } from '@/components/layouts/authenticated-layout';

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
