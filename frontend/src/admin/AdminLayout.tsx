import PortalLayout, { type NavItem } from '../components/PortalLayout';
import { AdminDataProvider } from './data';

const NAV: NavItem[] = [
  { to: '/admin', label: 'Overview', title: 'Administrator Overview', end: true },
  { to: '/admin/clinics', label: 'Clinics & Users', title: 'Clinics & User Accounts' },
  { to: '/admin/audit', label: 'Audit Log', title: 'Audit Log Viewer' },
  { to: '/admin/break-glass', label: 'Break-Glass Reviews', title: 'Break-Glass Reviews' },
  { to: '/admin/onboarding', label: 'Hospital Onboarding', tag: 'demo' },
  { to: '/admin/mapping', label: 'Data Mapping', title: 'Data Mapping Configuration', tag: 'demo' },
];

export default function AdminLayout() {
  return (
    <AdminDataProvider>
      <PortalLayout nav={NAV} subtitle="Administrator" />
    </AdminDataProvider>
  );
}
