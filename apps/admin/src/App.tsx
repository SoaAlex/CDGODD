import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Items } from './pages/Items';
import { AddItem } from './pages/AddItem';
import { Reports } from './pages/Reports';

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/items" element={<Protected><Items /></Protected>} />
          <Route path="/add-item" element={<Protected><AddItem /></Protected>} />
          <Route path="/reports" element={<Protected><Reports /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
