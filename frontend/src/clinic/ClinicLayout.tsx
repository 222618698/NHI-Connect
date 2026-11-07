import { useAuth } from '../auth';
import PortalLayout, { type NavItem } from '../components/PortalLayout';

const NAV: NavItem[] = [
  { to: '/clinic', label: 'Overview', title: 'Clinic Overview', end: true },
  { to: '/clinic/patients', label: 'Patients', title: 'Clinic Patients' },
];

export default function ClinicLayout() {
  const { user } = useAuth();
  return <PortalLayout nav={NAV} subtitle={user?.facilityName ?? 'Clinic'} />;
}
