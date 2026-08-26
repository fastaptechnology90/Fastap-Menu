import { Switch, Route, Router as WouterRouter, Redirect, useLocation, useParams } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { UserProvider } from "@/contexts/UserContext";
import { LocaleAccessibilityProvider } from "@/contexts/LocaleAccessibilityContext";
import { OfflineProvider } from "@/contexts/OfflineContext";
import { PwaProvider } from "@/contexts/PwaContext";
import { DigitalExperienceProvider } from "@/contexts/DigitalExperienceContext";
import { RestaurantProvider, useRestaurant } from "@/contexts/RestaurantContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { RestaurantLayout } from "@/components/restaurant/RestaurantLayout";
import { RestaurantPageErrorBoundary } from "@/components/restaurant/RestaurantPageErrorBoundary";
import { GuestBottomNav } from "@/components/user/GuestUI";
import { GuestVenueRequired } from "@/components/user/GuestVenueRequired";
import { GuestScrollRestore } from "@/components/user/GuestScrollRestore";
import { Loader2 } from "lucide-react";
import { canAccessAdminPath, type PermissionKey } from "@/lib/adminRbac";
import { defaultPathForRole } from "@/config/restaurantLoginRoles";

import Landing from "@/pages/Landing";
import UserAuth from "@/pages/user/UserAuth";
import MenuPage from "@/pages/user/MenuPage";
import CartPage from "@/pages/user/CartPage";
import OrderTracking from "@/pages/user/OrderTracking";
import UserProfile from "@/pages/user/UserProfile";
import Reservation from "@/pages/user/Reservation";
import WaitlistQueue from "@/pages/user/WaitlistQueue";
import HotelGuest from "@/pages/user/HotelGuest";
import EventBanquetPage from "@/pages/user/EventBanquetPage";
import SpaWellness from "@/pages/user/SpaWellness";
import BarNightlifePage from "@/pages/user/BarNightlifePage";
import CustomerWalletPage from "@/pages/user/CustomerWalletPage";
import PaymentPage from "@/pages/user/PaymentPage";
import LoyaltyMembershipPage from "@/pages/user/LoyaltyMembershipPage";
import AIPersonalizationPage from "@/pages/user/AIPersonalizationPage";
import UserSupport from "@/pages/user/UserSupport";
import LanguageAccessibilityPage from "@/pages/user/LanguageAccessibilityPage";
import OfflineModePage from "@/pages/user/OfflineModePage";
import PwaExperiencePage from "@/pages/user/PwaExperiencePage";
import SmartKioskPage from "@/pages/user/SmartKioskPage";
import DigitalExperiencePage from "@/pages/user/DigitalExperiencePage";
import SocialReviewPage from "@/pages/user/SocialReviewPage";
import SmartEntryPage from "@/pages/user/SmartEntryPage";
import VenueScanPage from "@/pages/user/VenueScanPage";
import TableSeating from "@/pages/user/TableSeating";
import SmartDiningPage from "@/pages/user/SmartDiningPage";
import UserSecurityPage from "@/pages/user/UserSecurityPage";
import FutureAIPage from "@/pages/user/FutureAIPage";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import Blog from "@/pages/Blog";
import RestaurantRevenues from "@/pages/RestaurantRevenues";
import Dashboard from "@/pages/Dashboard";
import Vendors from "@/pages/Vendors";
import VendorProfile from "@/pages/VendorProfile";
import Payments from "@/pages/Payments";
import Refunds from "@/pages/Refunds";
import Chargebacks from "@/pages/Chargebacks";
import Settlements from "@/pages/Settlements";
import Escrow from "@/pages/Escrow";
import Subscriptions from "@/pages/Subscriptions";
import Commissions from "@/pages/Commissions";
import Invoices from "@/pages/Invoices";
import Taxes from "@/pages/Taxes";
import Coupons from "@/pages/Coupons";
import Support from "@/pages/Support";
import KYC from "@/pages/KYC";
import AuditLogs from "@/pages/AuditLogs";
import Roles from "@/pages/RolesPermissions";
import Analytics from "@/pages/Analytics";
import Fraud from "@/pages/Fraud";
import QRNFC from "@/pages/QRNFC";
import Infrastructure from "@/pages/Infrastructure";
import ApiControl from "@/pages/ApiControl";
import WhiteLabel from "@/pages/WhiteLabel";
import Settings from "@/pages/Settings";
import Notifications from "@/pages/Notifications";
import Communications from "@/pages/Communications";
import Security from "@/pages/Security";
import Reconciliation from "@/pages/Reconciliation";
import Penalties from "@/pages/Penalties";
import Tasks from "@/pages/Tasks";
import Announcements from "@/pages/Announcements";
import ErrorLogs from "@/pages/ErrorLogs";
import ExportCenter from "@/pages/ExportCenter";
import SLAMonitoring from "@/pages/SLAMonitoring";
import DocumentVault from "@/pages/DocumentVault";
import Agreements from "@/pages/Agreements";
import VendorCRM from "@/pages/VendorCRM";
import Plans from "@/pages/Plans";
import Users from "@/pages/Users";
import LiveMonitoring from "@/pages/LiveMonitoring";
import MasterSearch from "@/pages/MasterSearch";
import Approvals from "@/pages/Approvals";
import ReservationsControl from "@/pages/ReservationsControl";
import VendorWallets from "@/pages/VendorWallets";
import BillingEngine from "@/pages/BillingEngine";
import AIInsights from "@/pages/AIInsights";
import AlertEngine from "@/pages/AlertEngine";
import Incidents from "@/pages/Incidents";
import DisasterRecovery from "@/pages/DisasterRecovery";
import LegalCompliance from "@/pages/LegalCompliance";
import AdminSandbox from "@/pages/AdminSandbox";
import DataArchival from "@/pages/DataArchival";
import FeatureReleases from "@/pages/FeatureReleases";
import RevenueLeakage from "@/pages/RevenueLeakage";
import DormantVendors from "@/pages/DormantVendors";

// Restaurant panel pages
import RestaurantLogin from "@/pages/restaurant/RestaurantLogin";
import RestaurantRegister from "@/pages/restaurant/RestaurantRegister";
import RestaurantSubscription from "@/pages/restaurant/RestaurantSubscription";
import RestaurantDashboard from "@/pages/restaurant/RestaurantDashboard";
import OrderManagement from "@/pages/restaurant/OrderManagement";
import TableManagement from "@/pages/restaurant/TableManagement";
import KitchenDisplay from "@/pages/restaurant/KitchenDisplay";
import MenuManagement from "@/pages/restaurant/MenuManagement";
import StaffManagement from "@/pages/restaurant/StaffManagement";
import RestaurantAnalytics from "@/pages/restaurant/Analytics";
import Inventory from "@/pages/restaurant/Inventory";
import CustomerCRM from "@/pages/restaurant/CustomerCRM";
import RestaurantReservations from "@/pages/restaurant/RestaurantReservations";
import Reception from "@/pages/restaurant/Reception";
import BillingPOS from "@/pages/restaurant/BillingPOS";
import RestaurantSettings from "@/pages/restaurant/RestaurantSettings";
import QueueWaitlist from "@/pages/restaurant/QueueWaitlist";
import CashCounter from "@/pages/restaurant/CashCounter";
import AIFeatures from "@/pages/restaurant/AIFeatures";
import RoomService from "@/pages/restaurant/RoomService";
import HousekeepingMaintenance from "@/pages/restaurant/HousekeepingMaintenance";
import SpaBar from "@/pages/restaurant/SpaBar";
import LoyaltyWallet from "@/pages/restaurant/LoyaltyWallet";
import MarketingAutomation from "@/pages/restaurant/MarketingAutomation";
import FinanceWallet from "@/pages/restaurant/FinanceWallet";
import FoodCosting from "@/pages/restaurant/FoodCosting";
import PurchaseProcurement from "@/pages/restaurant/PurchaseProcurement";
import StaffCommissionChat from "@/pages/restaurant/StaffCommissionChat";
import EventBanquet from "@/pages/restaurant/EventBanquet";
import MultiBranchFranchise from "@/pages/restaurant/MultiBranchFranchise";
import TaskSOP from "@/pages/restaurant/TaskSOP";
import RestaurantAuditLogs from "@/pages/restaurant/AuditLogs";
import NotificationHub from "@/pages/restaurant/NotificationHub";
import DocumentHardware from "@/pages/restaurant/DocumentHardware";
import RBACPermissions from "@/pages/restaurant/RBACPermissions";
import FeatureControl from "@/pages/restaurant/FeatureControl";
import QRManagement from "@/pages/restaurant/QRManagement";
import ReviewManagement from "@/pages/restaurant/ReviewManagement";
import DigitalSignage from "@/pages/restaurant/DigitalSignage";
import SelfOrderingKiosk from "@/pages/restaurant/SelfOrderingKiosk";
import WhiteLabelSettings from "@/pages/restaurant/WhiteLabelSettings";
import SystemMonitoring from "@/pages/restaurant/SystemMonitoring";
import CorporateBilling from "@/pages/restaurant/CorporateBilling";
import BackupRecovery from "@/pages/restaurant/BackupRecovery";
import WaiterAutomation from "@/pages/restaurant/WaiterAutomation";
import OfflineOperations from "@/pages/restaurant/OfflineOperations";
import CommunicationsCenter from "@/pages/restaurant/CommunicationsCenter";
import AggregatorIntegrations from "@/pages/restaurant/AggregatorIntegrations";
import ApiPlatform from "@/pages/restaurant/ApiPlatform";
import SandboxDemo from "@/pages/restaurant/SandboxDemo";
import AccessibilitySettings from "@/pages/restaurant/AccessibilitySettings";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const SUPER_ADMIN_ROLES = new Set(["super_admin", "finance_admin", "support_admin", "compliance_admin", "sales_admin", "operations_admin"]);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [location] = useLocation();
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Redirect to="/login" />;
  if (!SUPER_ADMIN_ROLES.has(user.role)) return <Redirect to="/restaurant/dashboard" />;
  const adminPath = location.split("?")[0];
  const allowed = canAccessAdminPath(
    user.role,
    adminPath,
    user.permissions as PermissionKey[] | undefined,
  );
  if (!allowed) return <Redirect to="/dashboard" />;
  return <AppLayout>{children}</AppLayout>;
}

function RestaurantProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentStaff, authBootstrapping, hasActiveSubscription } = useRestaurant();
  const [location] = useLocation();
  if (authBootstrapping && !currentStaff) {
    return (
      <div className="restaurant-panel flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }
  if (!currentStaff) return <Redirect to="/restaurant/login" />;
  if (!hasActiveSubscription) return <Redirect to="/restaurant/subscription" />;
  return (
    <RestaurantLayout>
      <RestaurantPageErrorBoundary page={location}>{children}</RestaurantPageErrorBoundary>
    </RestaurantLayout>
  );
}

function RestaurantSubscriptionRoute({ children }: { children: React.ReactNode }) {
  const { currentStaff, authBootstrapping } = useRestaurant();
  if (authBootstrapping && !currentStaff) {
    return (
      <div className="restaurant-panel flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }
  if (!currentStaff) return <Redirect to="/restaurant/login" />;
  return <>{children}</>;
}

function RestaurantHomeRedirect() {
  const { currentStaff, authBootstrapping, hasActiveSubscription } = useRestaurant();
  if (authBootstrapping) {
    return (
      <div className="restaurant-panel flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }
  if (!currentStaff) return <Redirect to="/restaurant/login" />;
  if (!hasActiveSubscription) return <Redirect to="/restaurant/subscription" />;
  return <Redirect to="/restaurant/dashboard" />;
}

function GuestRoute({ component: Page }: { component: React.ComponentType }) {
  return (
    <GuestVenueRequired>
      <Page />
    </GuestVenueRequired>
  );
}

function MenuSlugRedirect() {
  const params = useParams<{ slug: string }>();
  const search = typeof window !== "undefined" ? window.location.search : "";
  return <Redirect to={`/scan/${params.slug}${search}`} />;
}

function AppRoutes() {
  return (
    <>
    <GuestScrollRestore />
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/guest">{() => <Redirect to="/user/auth" />}</Route>
      <Route path="/e/:slug" component={SmartEntryPage} />
      <Route path="/scan/:slug" component={VenueScanPage} />
      <Route path="/menu/:slug" component={MenuSlugRedirect} />

      {/* ── User-side routes ───────────────────────────────────── */}
      <Route path="/user/auth" component={UserAuth} />
      <Route path="/user/menu">{() => <GuestRoute component={MenuPage} />}</Route>
      <Route path="/user/cart">{() => <GuestRoute component={CartPage} />}</Route>
      <Route path="/user/order/:id">{() => <GuestRoute component={OrderTracking} />}</Route>
      <Route path="/user/profile">{() => <GuestRoute component={UserProfile} />}</Route>
      <Route path="/user/reserve">{() => <GuestRoute component={Reservation} />}</Route>
      <Route path="/user/table-service">{() => <GuestRoute component={SmartDiningPage} />}</Route>
      <Route path="/user/dining">{() => <GuestRoute component={SmartDiningPage} />}</Route>
      <Route path="/user/seating">{() => <GuestRoute component={TableSeating} />}</Route>
      <Route path="/user/queue">{() => <GuestRoute component={WaitlistQueue} />}</Route>
      <Route path="/user/hotel">{() => <GuestRoute component={HotelGuest} />}</Route>
      <Route path="/user/events">{() => <GuestRoute component={EventBanquetPage} />}</Route>
      <Route path="/user/spa">{() => <GuestRoute component={SpaWellness} />}</Route>
      <Route path="/user/bar">{() => <GuestRoute component={BarNightlifePage} />}</Route>
      <Route path="/user/wallet">{() => <GuestRoute component={CustomerWalletPage} />}</Route>
      <Route path="/user/payment">{() => <GuestRoute component={PaymentPage} />}</Route>
      <Route path="/user/loyalty">{() => <GuestRoute component={LoyaltyMembershipPage} />}</Route>
      <Route path="/user/ai">{() => <GuestRoute component={AIPersonalizationPage} />}</Route>
      <Route path="/user/future-ai">{() => <GuestRoute component={FutureAIPage} />}</Route>
      <Route path="/user/security">{() => <GuestRoute component={UserSecurityPage} />}</Route>
      <Route path="/user/support">{() => <GuestRoute component={UserSupport} />}</Route>
      <Route path="/user/language">{() => <GuestRoute component={LanguageAccessibilityPage} />}</Route>
      <Route path="/user/offline">{() => <GuestRoute component={OfflineModePage} />}</Route>
      <Route path="/user/pwa">{() => <GuestRoute component={PwaExperiencePage} />}</Route>
      <Route path="/user/kiosk">{() => <GuestRoute component={SmartKioskPage} />}</Route>
      <Route path="/user/experience">{() => <GuestRoute component={DigitalExperiencePage} />}</Route>
      <Route path="/user/reviews">{() => <GuestRoute component={SocialReviewPage} />}</Route>

      {/* ── Restaurant / Manager panel ─────────────────────────── */}
      <Route path="/restaurant">{() => <RestaurantHomeRedirect />}</Route>
      <Route path="/restaurant/login" component={RestaurantLogin} />
      <Route path="/restaurant/register" component={RestaurantRegister} />
      <Route path="/restaurant/subscription">{() => <RestaurantSubscriptionRoute><RestaurantSubscription /></RestaurantSubscriptionRoute>}</Route>
      <Route path="/restaurant/dashboard">{() => <RestaurantProtectedRoute><RestaurantDashboard /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/orders">{() => <RestaurantProtectedRoute><OrderManagement /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/tables">{() => <RestaurantProtectedRoute><TableManagement /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/kitchen">{() => <RestaurantProtectedRoute><KitchenDisplay /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/menu">{() => <RestaurantProtectedRoute><MenuManagement /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/staff">{() => <RestaurantProtectedRoute><StaffManagement /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/analytics">{() => <RestaurantProtectedRoute><RestaurantAnalytics /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/inventory">{() => <RestaurantProtectedRoute><Inventory /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/customers">{() => <RestaurantProtectedRoute><CustomerCRM /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/reception">{() => <RestaurantProtectedRoute><Reception /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/reservations">{() => <RestaurantProtectedRoute><RestaurantReservations /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/billing">{() => <RestaurantProtectedRoute><BillingPOS /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/settings">{() => <RestaurantProtectedRoute><RestaurantSettings /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/queue">{() => <RestaurantProtectedRoute><QueueWaitlist /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/waiter">{() => <RestaurantProtectedRoute><WaiterAutomation /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/cash-counter">{() => <RestaurantProtectedRoute><CashCounter /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/ai-features">{() => <RestaurantProtectedRoute><AIFeatures /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/room-service">{() => <RestaurantProtectedRoute><RoomService /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/housekeeping">{() => <RestaurantProtectedRoute><HousekeepingMaintenance /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/spa">{() => <RestaurantProtectedRoute><SpaBar mode="spa" /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/bar">{() => <RestaurantProtectedRoute><SpaBar mode="bar" /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/spa-bar">{() => <RestaurantProtectedRoute><SpaBar /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/loyalty">{() => <RestaurantProtectedRoute><LoyaltyWallet /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/marketing">{() => <RestaurantProtectedRoute><MarketingAutomation /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/finance">{() => <RestaurantProtectedRoute><FinanceWallet /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/food-costing">{() => <RestaurantProtectedRoute><FoodCosting /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/procurement">{() => <RestaurantProtectedRoute><PurchaseProcurement /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/commissions">{() => <RestaurantProtectedRoute><StaffCommissionChat /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/events">{() => <RestaurantProtectedRoute><EventBanquet /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/branches">{() => <RestaurantProtectedRoute><MultiBranchFranchise /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/tasks-sop">{() => <RestaurantProtectedRoute><TaskSOP /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/audit">{() => <RestaurantProtectedRoute><RestaurantAuditLogs /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/notifications">{() => <RestaurantProtectedRoute><NotificationHub /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/documents">{() => <RestaurantProtectedRoute><DocumentHardware /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/rbac">{() => <RestaurantProtectedRoute><RBACPermissions /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/feature-control">{() => <RestaurantProtectedRoute><FeatureControl /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/qr-management">{() => <RestaurantProtectedRoute><QRManagement /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/reviews">{() => <RestaurantProtectedRoute><ReviewManagement /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/digital-signage">{() => <RestaurantProtectedRoute><DigitalSignage /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/kiosk">{() => <RestaurantProtectedRoute><SelfOrderingKiosk /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/white-label">{() => <RestaurantProtectedRoute><WhiteLabelSettings /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/monitoring">{() => <RestaurantProtectedRoute><SystemMonitoring /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/corporate-billing">{() => <RestaurantProtectedRoute><CorporateBilling /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/backup">{() => <RestaurantProtectedRoute><BackupRecovery /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/offline">{() => <RestaurantProtectedRoute><OfflineOperations /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/communications">{() => <RestaurantProtectedRoute><CommunicationsCenter /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/aggregators">{() => <RestaurantProtectedRoute><AggregatorIntegrations /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/api-platform">{() => <RestaurantProtectedRoute><ApiPlatform /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/sandbox">{() => <RestaurantProtectedRoute><SandboxDemo /></RestaurantProtectedRoute>}</Route>
      <Route path="/restaurant/accessibility">{() => <RestaurantProtectedRoute><AccessibilitySettings /></RestaurantProtectedRoute>}</Route>

      {/* ── Super-Admin routes ─────────────────────────────────── */}
      <Route path="/login" component={Login} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/dashboard">{() => <ProtectedRoute><Dashboard /></ProtectedRoute>}</Route>
      <Route path="/live-monitoring">{() => <ProtectedRoute><LiveMonitoring /></ProtectedRoute>}</Route>
      <Route path="/search">{() => <ProtectedRoute><MasterSearch /></ProtectedRoute>}</Route>
      <Route path="/plans">{() => <ProtectedRoute><Plans /></ProtectedRoute>}</Route>
      <Route path="/users">{() => <ProtectedRoute><Users /></ProtectedRoute>}</Route>
      <Route path="/vendors">{() => <ProtectedRoute><Vendors /></ProtectedRoute>}</Route>
      <Route path="/vendors/:id">{() => <ProtectedRoute><VendorProfile /></ProtectedRoute>}</Route>
      <Route path="/payments">{() => <ProtectedRoute><Payments /></ProtectedRoute>}</Route>
      <Route path="/refunds">{() => <ProtectedRoute><Refunds /></ProtectedRoute>}</Route>
      <Route path="/chargebacks">{() => <ProtectedRoute><Chargebacks /></ProtectedRoute>}</Route>
      <Route path="/settlements">{() => <ProtectedRoute><Settlements /></ProtectedRoute>}</Route>
      <Route path="/escrow">{() => <ProtectedRoute><Escrow /></ProtectedRoute>}</Route>
      <Route path="/subscriptions">{() => <ProtectedRoute><Subscriptions /></ProtectedRoute>}</Route>
      <Route path="/commissions">{() => <ProtectedRoute><Commissions /></ProtectedRoute>}</Route>
      <Route path="/invoices">{() => <ProtectedRoute><Invoices /></ProtectedRoute>}</Route>
      <Route path="/taxes">{() => <ProtectedRoute><Taxes /></ProtectedRoute>}</Route>
      <Route path="/coupons">{() => <ProtectedRoute><Coupons /></ProtectedRoute>}</Route>
      <Route path="/support">{() => <ProtectedRoute><Support /></ProtectedRoute>}</Route>
      <Route path="/kyc">{() => <ProtectedRoute><KYC /></ProtectedRoute>}</Route>
      <Route path="/audit-logs">{() => <ProtectedRoute><AuditLogs /></ProtectedRoute>}</Route>
      <Route path="/roles">{() => <ProtectedRoute><Roles /></ProtectedRoute>}</Route>
      <Route path="/analytics">{() => <ProtectedRoute><Analytics /></ProtectedRoute>}</Route>
      <Route path="/fraud">{() => <ProtectedRoute><Fraud /></ProtectedRoute>}</Route>
      <Route path="/qr-nfc">{() => <ProtectedRoute><QRNFC /></ProtectedRoute>}</Route>
      <Route path="/infrastructure">{() => <ProtectedRoute><Infrastructure /></ProtectedRoute>}</Route>
      <Route path="/api-control">{() => <ProtectedRoute><ApiControl /></ProtectedRoute>}</Route>
      <Route path="/white-label">{() => <ProtectedRoute><WhiteLabel /></ProtectedRoute>}</Route>
      <Route path="/settings">{() => <ProtectedRoute><Settings /></ProtectedRoute>}</Route>
      <Route path="/notifications">{() => <ProtectedRoute><Notifications /></ProtectedRoute>}</Route>
      <Route path="/communications">{() => <ProtectedRoute><Communications /></ProtectedRoute>}</Route>
      <Route path="/security">{() => <ProtectedRoute><Security /></ProtectedRoute>}</Route>
      <Route path="/reconciliation">{() => <ProtectedRoute><Reconciliation /></ProtectedRoute>}</Route>
      <Route path="/penalties">{() => <ProtectedRoute><Penalties /></ProtectedRoute>}</Route>
      <Route path="/tasks">{() => <ProtectedRoute><Tasks /></ProtectedRoute>}</Route>
      <Route path="/announcements">{() => <ProtectedRoute><Announcements /></ProtectedRoute>}</Route>
      <Route path="/blog">{() => <ProtectedRoute><Blog /></ProtectedRoute>}</Route>
      <Route path="/error-logs">{() => <ProtectedRoute><ErrorLogs /></ProtectedRoute>}</Route>
      <Route path="/export-center">{() => <ProtectedRoute><ExportCenter /></ProtectedRoute>}</Route>
      <Route path="/sla-monitoring">{() => <ProtectedRoute><SLAMonitoring /></ProtectedRoute>}</Route>
      <Route path="/document-vault">{() => <ProtectedRoute><DocumentVault /></ProtectedRoute>}</Route>
      <Route path="/agreements">{() => <ProtectedRoute><Agreements /></ProtectedRoute>}</Route>
      <Route path="/vendor-crm">{() => <ProtectedRoute><VendorCRM /></ProtectedRoute>}</Route>
      <Route path="/approvals">{() => <ProtectedRoute><Approvals /></ProtectedRoute>}</Route>
      <Route path="/reservations">{() => <ProtectedRoute><ReservationsControl /></ProtectedRoute>}</Route>
      <Route path="/vendor-wallets">{() => <ProtectedRoute><VendorWallets /></ProtectedRoute>}</Route>
      <Route path="/billing-engine">{() => <ProtectedRoute><BillingEngine /></ProtectedRoute>}</Route>
      <Route path="/ai-insights">{() => <ProtectedRoute><AIInsights /></ProtectedRoute>}</Route>
      <Route path="/alert-engine">{() => <ProtectedRoute><AlertEngine /></ProtectedRoute>}</Route>
      <Route path="/incidents">{() => <ProtectedRoute><Incidents /></ProtectedRoute>}</Route>
      <Route path="/disaster-recovery">{() => <ProtectedRoute><DisasterRecovery /></ProtectedRoute>}</Route>
      <Route path="/legal">{() => <ProtectedRoute><LegalCompliance /></ProtectedRoute>}</Route>
      <Route path="/sandbox">{() => <ProtectedRoute><AdminSandbox /></ProtectedRoute>}</Route>
      <Route path="/data-archival">{() => <ProtectedRoute><DataArchival /></ProtectedRoute>}</Route>
      <Route path="/feature-releases">{() => <ProtectedRoute><FeatureReleases /></ProtectedRoute>}</Route>
      <Route path="/revenue-leakage">{() => <ProtectedRoute><RevenueLeakage /></ProtectedRoute>}</Route>
      <Route path="/restaurant-revenues">{() => <ProtectedRoute><RestaurantRevenues /></ProtectedRoute>}</Route>
      <Route path="/dormant-vendors">{() => <ProtectedRoute><DormantVendors /></ProtectedRoute>}</Route>
      <Route>{() => <Redirect to="/" />}</Route>
    </Switch>
    <GuestBottomNav />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <UserProvider>
            <LocaleAccessibilityProvider>
            <OfflineProvider>
            <PwaProvider>
            <DigitalExperienceProvider>
            <RestaurantProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                {/* Keeps one failing page from blanking the entire app (BUG.md #23). */}
                <ErrorBoundary name="this page">
                  <AppRoutes />
                </ErrorBoundary>
              </WouterRouter>
              <Toaster />
            </RestaurantProvider>
            </DigitalExperienceProvider>
            </PwaProvider>
            </OfflineProvider>
            </LocaleAccessibilityProvider>
          </UserProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
