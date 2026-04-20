import React, { Suspense } from 'react';
import { Routes, Route } from "react-router-dom";
import NonAuthLayout from "../Layouts/NonAuthLayout";
import VerticalLayout from "../Layouts/index";
import { authProtectedRoutes, publicRoutes } from "./allRoutes";
import AuthProtected from './AuthProtected';

const Index = () => {
  return (
    <React.Fragment>
      <Routes>
        <Route>
          {publicRoutes.map((route, idx) => (
            <Route
              path={route.path}
              element={
                <NonAuthLayout>
                  <Suspense fallback={<div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}><div className="spinner-border text-primary" role="status"></div></div>}>
                    {route.component}
                  </Suspense>
                </NonAuthLayout>
              }
              key={idx}
            />
          ))}
        </Route>

        <Route>
          {authProtectedRoutes.map((route, idx) => (
            <Route
              path={route.path}
              element={
                <AuthProtected>
                  <VerticalLayout>
                    <Suspense fallback={<div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}><div className="spinner-border text-primary" role="status"></div></div>}>
                      {route.component}
                    </Suspense>
                  </VerticalLayout>
                </AuthProtected>
              }
              key={idx}
            />
          ))}
        </Route>
      </Routes>
    </React.Fragment>
  );
};

export default Index;