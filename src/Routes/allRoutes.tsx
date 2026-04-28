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

// Auth inner pages — lazy loaded
const BasicSignIn = lazy(() => import('../pages/AuthenticationInner/Login/BasicSignIn'));
const CoverSignIn = lazy(() => import('../pages/AuthenticationInner/Login/CoverSignIn'));
const BasicSignUp = lazy(() => import('../pages/AuthenticationInner/Register/BasicSignUp'));
const CoverSignUp = lazy(() => import("../pages/AuthenticationInner/Register/CoverSignUp"));
const BasicPasswReset = lazy(() => import('../pages/AuthenticationInner/PasswordReset/BasicPasswReset'));
const CoverPasswReset = lazy(() => import('../pages/AuthenticationInner/PasswordReset/CoverPasswReset'));
const BasicLockScreen = lazy(() => import('../pages/AuthenticationInner/LockScreen/BasicLockScr'));
const CoverLockScreen = lazy(() => import('../pages/AuthenticationInner/LockScreen/CoverLockScr'));
const BasicLogout = lazy(() => import("pages/AuthenticationInner/Logout/BasicLogout"));
const CoverLogout = lazy(() => import('../pages/AuthenticationInner/Logout/CoverLogout'));
const BasicSuccessMsg = lazy(() => import('../pages/AuthenticationInner/SuccessMessage/BasicSuccessMsg'));
const CoverSuccessMsg = lazy(() => import('../pages/AuthenticationInner/SuccessMessage/CoverSuccessMsg'));
const BasicTwosVerify = lazy(() => import('../pages/AuthenticationInner/TwoStepVerification/BasicTwosVerify'));
const CoverTwosVerify = lazy(() => import('../pages/AuthenticationInner/TwoStepVerification/CoverTwosVerify'));
const Basic404 = lazy(() => import('../pages/AuthenticationInner/Errors/Basic404'));
const Cover404 = lazy(() => import('../pages/AuthenticationInner/Errors/Cover404'));
const Alt404 = lazy(() => import('../pages/AuthenticationInner/Errors/Alt404'));
const Error500 = lazy(() => import('../pages/AuthenticationInner/Errors/Error500'));
const BasicPasswCreate = lazy(() => import("../pages/AuthenticationInner/PasswordCreate/BasicPasswCreate"));
const CoverPasswCreate = lazy(() => import("../pages/AuthenticationInner/PasswordCreate/CoverPasswCreate"));
const Offlinepage = lazy(() => import("../pages/AuthenticationInner/Errors/Offlinepage"));
const Maintenance = lazy(() => import('../pages/Pages/Maintenance/Maintenance'));
const ComingSoon = lazy(() => import('../pages/Pages/ComingSoon/ComingSoon'));
const Recurring = lazy(() => import("../pages/Recurring"));


const authProtectedRoutes = [
  { path: "/dashboard", component: <Dashboard /> },
  { path: "/index", component: <Dashboard /> },

  // Finance Portal
  { path: "/accounts", component: <Accounts /> },
  { path: "/transactions", component: <FinanceTransactions /> },
  { path: "/credit-cards", component: <CreditCards /> },
  { path: "/splits", component: <Splits /> },
  { path: "/loans-given", component: <Loans /> },
  { path: "/loans-taken", component: <Loans /> },
  { path: "/emis", component: <EMIs /> },
  { path: "/goals", component: <Goals /> },
  { path: "/budget", component: <Budget /> },
  { path: "/forecast", component: <Forecast /> },
  { path: "/settings/categories", component: <Categories /> },
  { path: "/profile", component: <UserProfile /> },
  { path: "/recurring", component: <Recurring /> },

  {
    path: "/",
    exact: true,
    component: <Navigate to="/dashboard" />,
  },
  { path: "*", component: <Navigate to="/dashboard" /> },
];

const publicRoutes = [
  { path: "/logout", component: <Logout /> },
  { path: "/login", component: <Login /> },
  { path: "/forgot-password", component: <ForgetPasswordPage /> },
  { path: "/register", component: <Register /> },

  { path: "/auth-signin-basic", component: <BasicSignIn /> },
  { path: "/auth-signin-cover", component: <CoverSignIn /> },
  { path: "/auth-signup-basic", component: <BasicSignUp /> },
  { path: "/auth-signup-cover", component: <CoverSignUp /> },
  { path: "/auth-pass-reset-basic", component: <BasicPasswReset /> },
  { path: "/auth-pass-reset-cover", component: <CoverPasswReset /> },
  { path: "/auth-lockscreen-basic", component: <BasicLockScreen /> },
  { path: "/auth-lockscreen-cover", component: <CoverLockScreen /> },
  { path: "/auth-logout-basic", component: <BasicLogout /> },
  { path: "/auth-logout-cover", component: <CoverLogout /> },
  { path: "/auth-success-msg-basic", component: <BasicSuccessMsg /> },
  { path: "/auth-success-msg-cover", component: <CoverSuccessMsg /> },
  { path: "/auth-twostep-basic", component: <BasicTwosVerify /> },
  { path: "/auth-twostep-cover", component: <CoverTwosVerify /> },
  { path: "/auth-404-basic", component: <Basic404 /> },
  { path: "/auth-404-cover", component: <Cover404 /> },
  { path: "/auth-404-alt", component: <Alt404 /> },
  { path: "/auth-500", component: <Error500 /> },
  { path: "/auth-pass-change-basic", component: <BasicPasswCreate /> },
  { path: "/auth-pass-change-cover", component: <CoverPasswCreate /> },
  { path: "/auth-offline", component: <Offlinepage /> },
  { path: "/pages-maintenance", component: <Maintenance /> },
  { path: "/pages-coming-soon", component: <ComingSoon /> },
  { path: "/reset-password", component: <ResetPassword /> },
];

export { authProtectedRoutes, publicRoutes };