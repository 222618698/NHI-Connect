import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import LoginPage from './pages/LoginPage';
import SearchPage from './pages/SearchPage';
import RecordPage from './pages/RecordPage';
import AdminLayout from './admin/AdminLayout';
import AdminOverviewPage from './admin/AdminOverviewPage';
import ClinicsPage from './admin/ClinicsPage';
import OnboardingPage from './admin/OnboardingPage';
import MappingPage from './admin/MappingPage';
import AuditLogPage from './admin/AuditLogPage';
import ClinicLayout from './clinic/ClinicLayout';
import ClinicOverviewPage from './clinic/ClinicOverviewPage';
import ClinicPatientsPage from './clinic/ClinicPatientsPage';
import ClinicPatientPage from './clinic/ClinicPatientPage';

export default function App() {
  const { user, checking } = useAuth();

  if (checking) return <p className="p-10 text-sm text-ink-faint">Checking your session&hellip;</p>;

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  if (user.role === 'ADMIN') {
    return (
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="clinics" element={<ClinicsPage />} />
          <Route path="audit" element={<AuditLogPage />} />
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route path="mapping" element={<MappingPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  if (user.role === 'CLINIC') {
    return (
      <Routes>
        <Route path="/clinic" element={<ClinicLayout />}>
          <Route index element={<ClinicOverviewPage />} />
          <Route path="patients" element={<ClinicPatientsPage />} />
          <Route path="patients/:patientId" element={<ClinicPatientPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/clinic" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<SearchPage />} />
      <Route path="/patients/:patientId" element={<RecordPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
