import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import AlertReviewPage from "./pages/AlertReviewPage";
import AlertsPage from "./pages/AlertsPage";
import CamerasPage from "./pages/CamerasPage";
import EventsPage from "./pages/EventsPage";

// Componente de Rota Protegida Obrigatória
function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rotas Públicas de Autenticação */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth" element={<Navigate to="/login" replace />} />

          {/* Rotas 100% Protegidas - Bloqueadas sem conta */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="cameras" element={<CamerasPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="alerts/review/:eventId" element={<AlertReviewPage />} />
            <Route path="alerts/review" element={<AlertReviewPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
