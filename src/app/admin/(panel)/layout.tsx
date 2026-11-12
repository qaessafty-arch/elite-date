import Link from 'next/link';
import { logoutAction } from '@/app/actions/auth';
import { AdminNav, type NavItem } from '@/components/admin/ui';
import { can, requireAdmin, type Permission } from '@/lib/auth';

const NAV: (NavItem & { permission: Permission })[] = [
  { href: '/admin', label: 'Overview', permission: 'dashboard.view' },
  { href: '/admin/orders', label: 'Orders', permission: 'orders.manage' },
  { href: '/admin/products', label: 'Products', permission: 'products.manage' },
  { href: '/admin/inventory', label: 'Inventory', permission: 'products.manage' },
  { href: '/admin/categories', label: 'Categories', permission: 'products.manage' },
  { href: '/admin/customers', label: 'Customers', permission: 'customers.manage' },
  { href: '/admin/promotions', label: 'Promotions', permission: 'promotions.manage' },
  { href: '/admin/settings', label: 'Settings', permission: 'settings.manage' },
  { href: '/admin/audit', label: 'Audit log', permission: 'settings.manage' },
];

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const footer = (
    <div className="grid gap-2 px-3 text-[0.9375rem]">
      <p className="truncate font-semibold">{user.firstName ? `${user.firstName} ${user.lastName}` : user.email}</p>
      <p className="small -mt-2 text-mute">{user.roleName}</p>
      <Link href="/" className="underline underline-offset-4">
        View store
      </Link>
      <form action={logoutAction}>
        <button type="submit" className="underline underline-offset-4">
          Sign out
        </button>
      </form>
    </div>
  );
  return (
    <div className="lg:flex">
      <AdminNav items={NAV.filter((n) => can(user, n.permission)).map(({ href, label }) => ({ href, label }))} footer={footer} />
      <main className="min-w-0 flex-1 px-4 py-8 md:px-8 lg:px-10">{children}</main>
    </div>
  );
}
