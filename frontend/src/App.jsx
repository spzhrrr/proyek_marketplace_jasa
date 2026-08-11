import { Routes, Route } from "react-router-dom";
import Layout from "./layouts/Layout.jsx";
import AdminLayout from "./layouts/AdminLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import OnboardingGate from "./components/OnboardingGate.jsx";
import HomePage from "./features/home/HomePage.jsx";
import LoginPage from "./features/auth/LoginPage.jsx";
import RegisterPage from "./features/auth/RegisterPage.jsx";
import JasaListPage from "./features/catalog/JasaListPage.jsx";
import JasaDetailPage from "./features/catalog/JasaDetailPage.jsx";
import JasaPostPage from "./features/catalog/JasaPostPage.jsx";
import JasaEditPage from "./features/catalog/JasaEditPage.jsx";
import JasaSewaPage from "./features/catalog/JasaSewaPage.jsx";
import JasaChatPage from "./features/catalog/JasaChatPage.jsx";
import LowonganListPage from "./features/catalog/LowonganListPage.jsx";
import LowonganDetailPage from "./features/catalog/LowonganDetailPage.jsx";
import LowonganPostPage from "./features/catalog/LowonganPostPage.jsx";
import LowonganEditPage from "./features/catalog/LowonganEditPage.jsx";
import LowonganLamarPage from "./features/catalog/LowonganLamarPage.jsx";
import LowonganChatPage from "./features/catalog/LowonganChatPage.jsx";
import DashboardPage from "./features/account/DashboardPage.jsx";
import CompleteProfilePage from "./features/account/CompleteProfilePage.jsx";
import ProfilePage from "./features/account/ProfilePage.jsx";
import NotificationsPage from "./features/account/NotificationsPage.jsx";
import ChatInboxPage from "./features/account/ChatInboxPage.jsx";
import OrderDetailPage from "./features/orders/OrderDetailPage.jsx";
import PaymentMethodPage from "./features/orders/PaymentMethodPage.jsx";
import VerifyHubPage from "./features/verification/VerifyHubPage.jsx";
import VerifyEmailPage from "./features/verification/VerifyEmailPage.jsx";
import VerifyPhonePage from "./features/verification/VerifyPhonePage.jsx";
import VerifyKtpPage from "./features/verification/VerifyKtpPage.jsx";
import VerifyBankPage from "./features/verification/VerifyBankPage.jsx";
import AdminDashboardPage from "./features/admin/AdminDashboardPage.jsx";
import AdminKtpPage from "./features/admin/AdminKtpPage.jsx";
import AdminKtpDetailPage from "./features/admin/AdminKtpDetailPage.jsx";
import AdminBankPage from "./features/admin/AdminBankPage.jsx";
import AdminBankDetailPage from "./features/admin/AdminBankDetailPage.jsx";
import AdminWithdrawalsPage from "./features/admin/AdminWithdrawalsPage.jsx";
import AdminUsersPage from "./features/admin/AdminUsersPage.jsx";
import AdminOrdersPage from "./features/admin/AdminOrdersPage.jsx";
import AdminReportsPage from "./features/admin/AdminReportsPage.jsx";
import GatewayDashboardPage from "./features/gateway/GatewayDashboardPage.jsx";
import GatewayPayPage from "./features/gateway/GatewayPayPage.jsx";

import JobApplicationsPage from "./features/catalog/JobApplicationsPage.jsx";
import ServiceRequestsPage from "./features/catalog/ServiceRequestsPage.jsx";

function GatewayLayout({ children }) {
  return <Layout wide compact>{children}</Layout>;
}

export default function App() {
  return (
    <OnboardingGate>
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/lengkapi-profil" element={<CompleteProfilePage />} />

      <Route path="/jasa" element={<JasaListPage />} />
      <Route path="/jasa/baru" element={<JasaPostPage />} />
      <Route path="/jasa/:id/edit" element={<JasaEditPage />} />
      <Route path="/jasa/:id/sewa" element={<JasaSewaPage />} />
      <Route path="/jasa/:id/chat" element={<ProtectedRoute><JasaChatPage /></ProtectedRoute>} />
      <Route path="/jasa/:id/requests" element={<ProtectedRoute><ServiceRequestsPage /></ProtectedRoute>} />
      <Route path="/jasa/:id" element={<JasaDetailPage />} />

      <Route path="/lowongan" element={<LowonganListPage />} />
      <Route path="/lowongan/baru" element={<LowonganPostPage />} />
      <Route path="/lowongan/:id/edit" element={<LowonganEditPage />} />
      <Route path="/lowongan/:id/lamar" element={<LowonganLamarPage />} />
      <Route path="/lowongan/:id/lamaran" element={<JobApplicationsPage />} />
      <Route path="/lowongan/:id/chat" element={<ProtectedRoute><LowonganChatPage /></ProtectedRoute>} />
      <Route path="/lowongan/:id" element={<LowonganDetailPage />} />

      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/chat" element={<ChatInboxPage />} />
      <Route path="/profile/:id" element={<ProfilePage />} />
      <Route path="/notifikasi" element={<NotificationsPage />} />
      <Route path="/orders/:id/bayar" element={<PaymentMethodPage />} />
      <Route path="/orders/:id" element={<OrderDetailPage />} />

      <Route path="/verify" element={<VerifyHubPage />} />
      <Route path="/verify/email" element={<VerifyEmailPage />} />
      <Route path="/verify/phone" element={<VerifyPhonePage />} />
      <Route path="/verify/ktp" element={<VerifyKtpPage />} />
      <Route path="/verify/bank" element={<VerifyBankPage />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute admin>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="ktp" element={<AdminKtpPage />} />
        <Route path="ktp/:id" element={<AdminKtpDetailPage />} />
        <Route path="bank" element={<AdminBankPage />} />
        <Route path="bank/:id" element={<AdminBankDetailPage />} />
        <Route path="withdrawals" element={<AdminWithdrawalsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
      </Route>

      <Route path="/gateway" element={<GatewayLayout><ProtectedRoute><GatewayDashboardPage /></ProtectedRoute></GatewayLayout>} />
      <Route path="/gateway/pay/:code" element={<GatewayLayout><GatewayPayPage /></GatewayLayout>} />
      </Routes>
    </OnboardingGate>
  );
}
