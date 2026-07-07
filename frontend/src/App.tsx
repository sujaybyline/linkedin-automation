import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CompanyProfilesProvider } from "./context/CompanyProfilesContext";
import { RoleGuard } from "./components/RoleGuard";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { PostsPage } from "./pages/PostsPage";
import { AllPostsPage } from "./pages/AllPostsPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { SchedulePage } from "./pages/SchedulePage";
import { QueuePage } from "./pages/QueuePage";
import { LogsPage } from "./pages/LogsPage";
import { EmergencyPage } from "./pages/EmergencyPage";
import { LinkedInPage } from "./pages/LinkedInPage";
import { ProfilePage } from "./pages/ProfilePage";
import { FetchInfoPage } from "./pages/FetchInfoPage";
import { CompanyProfilePage } from "./pages/CompanyProfilePage";
import { AiConfigPage } from "./pages/AiConfigPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <CompanyProfilesProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HomePage />} />
            <Route path="posts" element={<PostsPage />} />
            <Route path="fetch-info" element={<FetchInfoPage />} />
            <Route path="all-posts" element={<AllPostsPage />} />
            <Route path="cards" element={<Navigate to="/posts" replace />} />
            <Route path="approvals" element={<RoleGuard><ApprovalsPage /></RoleGuard>} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="queue" element={<QueuePage />} />
            <Route path="logs" element={<RoleGuard><LogsPage /></RoleGuard>} />
            <Route path="ai-config" element={<RoleGuard><AiConfigPage /></RoleGuard>} />
            <Route path="emergency" element={<EmergencyPage />} />
            <Route path="linkedin" element={<LinkedInPage />} />
            <Route path="company/:id" element={<CompanyProfilePage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </CompanyProfilesProvider>
    </AuthProvider>
  );
}
