import React, { useState, useEffect } from 'react';
import { Card, CardBody, Col, Container, Input, Label, Row, Button, Form, FormFeedback, Alert, Spinner } from 'reactstrap';
import { Link, useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { useFormik } from "formik";
import { useAuth } from "../../context/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordShow, setPasswordShow] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  document.title = 'Sign In | Finance Portal';

  // Load remembered email
  useEffect(() => {
    const saved = localStorage.getItem('rememberedEmail');
    if (saved) {
      validation.setFieldValue('email', saved);
      setRememberMe(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const validation = useFormik({
    initialValues: { email: '', password: '' },
    validationSchema: Yup.object({
      email: Yup.string().email('Invalid email').required('Please enter your email'),
      password: Yup.string().required('Please enter your password'),
    }),
    onSubmit: async (values) => {
      setLoading(true);
      setError('');
      try {
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', values.email);
        } else {
          localStorage.removeItem('rememberedEmail');
        }
        await signIn(values.email, values.password);
        navigate('/dashboard');
      } catch (err: any) {
        setError(err.message || 'Login failed');
      } finally {
        setLoading(false);
      }
    }
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background decorative elements */}
      <div style={{
        position: 'absolute', top: '10%', left: '5%',
        width: 300, height: 300, borderRadius: '50%',
        background: 'rgba(64, 81, 137, 0.15)', filter: 'blur(60px)',
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '5%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'rgba(37, 99, 235, 0.1)', filter: 'blur(80px)',
      }} />

      <Container>
        <Row className="justify-content-center">
          <Col md={8} lg={5}>

            {/* Logo */}
            <div className="text-center mb-4">
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 12,
                background: 'rgba(255,255,255,0.08)', borderRadius: 16,
                padding: '12px 24px', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'linear-gradient(135deg, #405189, #0ab39c)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <i className="bx bx-wallet" style={{ fontSize: 22, color: '#fff' }}></i>
                </div>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: 0.5 }}>
                  Finance Portal
                </span>
              </div>
              <p className="mt-3 text-white-50 fs-14">Your complete financial picture</p>
            </div>

            <Card style={{
              borderRadius: 20, border: 'none',
              boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(10px)',
            }}>
              <CardBody className="p-4 p-md-5">
                <div className="text-center mb-4">
                  <h4 className="fw-bold" style={{ color: '#1a1a2e' }}>Welcome Back!</h4>
                  <p className="text-muted mb-0">Sign in to continue to Finance Portal</p>
                </div>

                {error && <Alert color="danger">{error}</Alert>}

                <Form onSubmit={(e) => { e.preventDefault(); validation.handleSubmit(); }}>
                  <div className="mb-3">
                    <Label htmlFor="email" className="fw-semibold">Email</Label>
                    <Input
                      name="email" type="email" placeholder="Enter your email"
                      onChange={validation.handleChange} onBlur={validation.handleBlur}
                      value={validation.values.email}
                      invalid={validation.touched.email && !!validation.errors.email}
                      style={{ borderRadius: 10, padding: '10px 14px' }}
                    />
                    {validation.touched.email && validation.errors.email &&
                      <FormFeedback>{validation.errors.email}</FormFeedback>}
                  </div>

                  <div className="mb-3">
                    <div className="d-flex justify-content-between">
                      <Label className="fw-semibold">Password</Label>
                      <Link to="/forgot-password" className="text-primary fs-13">Forgot password?</Link>
                    </div>
                    <div className="position-relative">
                      <Input
                        name="password" type={passwordShow ? "text" : "password"}
                        placeholder="Enter your password"
                        onChange={validation.handleChange} onBlur={validation.handleBlur}
                        value={validation.values.password}
                        invalid={validation.touched.password && !!validation.errors.password}
                        style={{ borderRadius: 10, padding: '10px 14px', paddingRight: 40 }}
                      />
                      <button
                        type="button"
                        onClick={() => setPasswordShow(!passwordShow)}
                        style={{
                          position: 'absolute', right: 12, top: '50%',
                          transform: 'translateY(-50%)', background: 'none',
                          border: 'none', cursor: 'pointer', color: '#6c757d',
                        }}
                      >
                        <i className={`ri-eye${passwordShow ? '-off' : ''}-fill`}></i>
                      </button>
                      {validation.touched.password && validation.errors.password &&
                        <FormFeedback>{validation.errors.password}</FormFeedback>}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="form-check">
                      <Input
                        className="form-check-input" type="checkbox"
                        id="remember-me" checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                      />
                      <Label className="form-check-label text-muted" htmlFor="remember-me">
                        Remember my email
                      </Label>
                    </div>
                  </div>

                  <Button
                    color="success" disabled={loading} className="w-100 fw-semibold"
                    style={{ borderRadius: 10, padding: '11px', fontSize: 15 }}
                    type="submit"
                  >
                    {loading ? <Spinner size="sm" className="me-2" /> : null}
                    Sign In
                  </Button>
                </Form>

                <div className="mt-4 text-center">
                  <p className="text-muted mb-0">
                    Don't have an account?{' '}
                    <Link to="/register" className="fw-semibold text-primary">Sign up</Link>
                  </p>
                </div>
              </CardBody>
            </Card>

            <div className="text-center mt-3">
              <p className="text-white-50 fs-12 mb-0">
                © {new Date().getFullYear()} Finance Portal. All rights reserved.
              </p>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Login;