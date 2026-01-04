import { AuthenticatedLayout } from '@/components/layouts/authenticated-layout';

export default function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
