import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import LoginPage from './pages/LoginPage';
import SearchPage from './pages/SearchPage';
import RecordPage from './pages/RecordPage';

export default function App() {
  const { username } = useAuth();
  if (!username) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
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
