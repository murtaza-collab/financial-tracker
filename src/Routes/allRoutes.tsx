import React, { lazy } from "react";
import { Navigate } from "react-router-dom";

// Auth pages — not lazy (needed immediately)
import Login from "../pages/Authentication/Login";
import Register from "../pages/Authentication/Register";
import Logout from "../pages/Authentication/Logout";
import ForgetPasswordPage from "../pages/Authentication/ForgetPassword";
import ResetPassword from "../pages/Authentication/ResetPassword";

// Finance Portal — lazy loaded
const Dashboard = lazy(() => import("../pages/DashboardEcommerce"));
const Accounts = lazy(() => import("../pages/Accounts"));
const FinanceTransactions = lazy(() => import("../pages/Transactions"));
const CreditCards = lazy(() => import("../pages/CreditCards"));
const Splits = lazy(() => import("../pages/Splits"));
const Loans = lazy(() => import("../pages/Loans"));
const EMIs = lazy(() => import("../pages/EMIs"));
const Goals = lazy(() => import("../pages/Goals"));
const Budget = lazy(() => import("../pages/Budget"));
const Forecast = lazy(() => import("../pages/Forecast"));
const Categories = lazy(() => import("../pages/Settings/Categories"));
const UserProfile = lazy(() => import("../pages/Authentication/user-profile"));
const Recurring = lazy(() => import("../pages/Recurring"));
const FinancialCalendar = lazy(() => import("../pages/FinancialCalendar"));

// Utility pages
const Maintenance = lazy(() => import('../pages/Pages/Maintenance/Maintenance'));
const ComingSoon = lazy(() => import('../pages/Pages/ComingSoon/ComingSoon'));

const authProtectedRoutes = [
  { path: "/dashboard", component: <Dashboard /> },
  { path: "/index",     component: <Dashboard /> },

  // Finance Portal
  { path: "/accounts",             component: <Accounts /> },
  { path: "/transactions",         component: <FinanceTransactions /> },
  { path: "/credit-cards",         component: <CreditCards /> },
  { path: "/splits",               component: <Splits /> },
  { path: "/loans-given",          component: <Loans /> },
  { path: "/loans-taken",          component: <Loans /> },
  { path: "/emis",                 component: <EMIs /> },
  { path: "/goals",                component: <Goals /> },
  { path: "/budget",               component: <Budget /> },
  { path: "/forecast",             component: <Forecast /> },
  { path: "/settings/categories",  component: <Categories /> },
  { path: "/profile",              component: <UserProfile /> },
  { path: "/recurring",            component: <Recurring /> },
  { path: "/financial-calendar",   component: <FinancialCalendar /> },

  { path: "/",    exact: true, component: <Navigate to="/dashboard" /> },
  { path: "*",                 component: <Navigate to="/dashboard" /> },
];

const publicRoutes = [
  { path: "/logout",           component: <Logout /> },
  { path: "/login",            component: <Login /> },
  { path: "/forgot-password",  component: <ForgetPasswordPage /> },
  { path: "/register",         component: <Register /> },
  { path: "/reset-password",   component: <ResetPassword /> },
  { path: "/pages-maintenance", component: <Maintenance /> },
  { path: "/pages-coming-soon", component: <ComingSoon /> },
];

export { authProtectedRoutes, publicRoutes };
