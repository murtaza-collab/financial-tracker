import React, { useState } from "react";
import { Col, Container, Input, Label, Row, Button, Form, FormFeedback, Alert, Spinner, Card, CardBody } from "reactstrap";
import * as Yup from "yup";
import { useFormik } from "formik";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const Register = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordShow, setPasswordShow] = useState(false);
  const [confirmPasswordShow, setConfirmPasswordShow] = useState(false);

  document.title = 'Sign Up | Finance Portal';

  const validation = useFormik({
    initialValues: { email: '', first_name: '', password: '', confirm_password: '' },
    validationSchema: Yup.object({
      email: Yup.string().email('Invalid email').required('Please enter your email'),
      first_name: Yup.string().required('Please enter your name'),
      password: Yup.string()
        .min(8, 'Minimum 8 characters')
        .matches(/[A-Z]/, 'Must contain at least one uppercase letter')
        .matches(/[0-9]/, 'Must contain at least one number')
        .matches(/[!@#$%^&*]/, 'Must contain at least one special character (!@#$%^&*)')
        .required('Please enter your password'),
      confirm_password: Yup.string()
        .oneOf([Yup.ref('password'), ''], 'Passwords must match')
        .required('Please confirm your password'),
    }),
    onSubmit: async (values) => {
      setLoading(true);
      setError('');
      try {
        await signUp(values.email, values.password, values.first_name);
        setSuccess(true);
        setTimeout(() => navigate('/login'), 4000);
      } catch (err: any) {
        setError(err.message || 'Registration failed');
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
        position: 'absolute', top: '10%', right: '5%',
        width: 300, height: 300, borderRadius: '50%',
        background: 'rgba(64, 81, 137, 0.15)', filter: 'blur(60px)',
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', left: '5%',
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
            }}>
              <CardBody className="p-4 p-md-5">
                <div className="text-center mb-4">
                  <h4 className="fw-bold" style={{ color: '#1a1a2e' }}>Create Account</h4>
                  <p className="text-muted mb-0">Sign up to get started</p>
                </div>

                {success && (
                  <Alert color="success">
                    Account created! Check your email to verify, then{' '}
                    <Link to="/login">sign in</Link>. Redirecting...
                  </Alert>
                )}
                {error && <Alert color="danger">{error}</Alert>}

                <Form onSubmit={(e) => { e.preventDefault(); validation.handleSubmit(); }}>
                  <div className="mb-3">
                    <Label className="fw-semibold">Full Name <span className="text-danger">*</span></Label>
                    <Input
                      name="first_name" type="text"
                      placeholder="Enter your full name"
                      onChange={validation.handleChange} onBlur={validation.handleBlur}
                      value={validation.values.first_name}
                      invalid={validation.touched.first_name && !!validation.errors.first_name}
                      style={{ borderRadius: 10, padding: '10px 14px' }}
                    />
                    {validation.touched.first_name && validation.errors.first_name &&
                      <FormFeedback>{validation.errors.first_name}</FormFeedback>}
                  </div>

                  <div className="mb-3">
                    <Label className="fw-semibold">Email <span className="text-danger">*</span></Label>
                    <Input
                      name="email" type="email"
                      placeholder="Enter your email"
                      onChange={validation.handleChange} onBlur={validation.handleBlur}
                      value={validation.values.email}
                      invalid={validation.touched.email && !!validation.errors.email}
                      style={{ borderRadius: 10, padding: '10px 14px' }}
                    />
                    {validation.touched.email && validation.errors.email &&
                      <FormFeedback>{validation.errors.email}</FormFeedback>}
                  </div>

                  <div className="mb-3">
                    <Label className="fw-semibold">Password <span className="text-danger">*</span></Label>
                    <div className="position-relative">
                      <Input
                        name="password" type={passwordShow ? "text" : "password"}
                        placeholder="Min 8 chars, 1 uppercase, 1 number, 1 special"
                        onChange={validation.handleChange} onBlur={validation.handleBlur}
                        value={validation.values.password}
                        invalid={validation.touched.password && !!validation.errors.password}
                        style={{ borderRadius: 10, padding: '10px 14px', paddingRight: 40 }}
                      />
                      <button type="button" onClick={() => setPasswordShow(!passwordShow)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d' }}>
                        <i className={`ri-eye${passwordShow ? '-off' : ''}-fill`}></i>
                      </button>
                      {validation.touched.password && validation.errors.password &&
                        <FormFeedback>{validation.errors.password}</FormFeedback>}
                    </div>
                  </div>

                  <div className="mb-4">
                    <Label className="fw-semibold">Confirm Password <span className="text-danger">*</span></Label>
                    <div className="position-relative">
                      <Input
                        name="confirm_password" type={confirmPasswordShow ? "text" : "password"}
                        placeholder="Repeat your password"
                        onChange={validation.handleChange} onBlur={validation.handleBlur}
                        value={validation.values.confirm_password}
                        invalid={validation.touched.confirm_password && !!validation.errors.confirm_password}
                        style={{ borderRadius: 10, padding: '10px 14px', paddingRight: 40 }}
                      />
                      <button type="button" onClick={() => setConfirmPasswordShow(!confirmPasswordShow)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d' }}>
                        <i className={`ri-eye${confirmPasswordShow ? '-off' : ''}-fill`}></i>
                      </button>
                      {validation.touched.confirm_password && validation.errors.confirm_password &&
                        <FormFeedback>{validation.errors.confirm_password}</FormFeedback>}
                    </div>
                  </div>

                  <Button
                    color="success" disabled={loading} className="w-100 fw-semibold"
                    style={{ borderRadius: 10, padding: '11px', fontSize: 15 }}
                    type="submit"
                  >
                    {loading ? <Spinner size="sm" className="me-2" /> : null}
                    Create Account
                  </Button>
                </Form>

                <div className="mt-4 text-center">
                  <p className="text-muted mb-0">
                    Already have an account?{' '}
                    <Link to="/login" className="fw-semibold text-primary">Sign in</Link>
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

export default Register;