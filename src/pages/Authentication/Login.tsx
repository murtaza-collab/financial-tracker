import React, { useState } from 'react';
import { Card, CardBody, Col, Container, Input, Label, Row, Button, Form, FormFeedback, Alert, Spinner } from 'reactstrap';
import ParticlesAuth from "../AuthenticationInner/ParticlesAuth";
import { Link, useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { useFormik } from "formik";
import { useAuth } from "../../context/AuthContext";
import logoLight from "../../assets/images/logo-light.png";

const Login = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [passwordShow, setPasswordShow] = useState(false);

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
        await signIn(values.email, values.password);
        navigate('/dashboard');
      } catch (err: any) {
        setError(err.message || 'Login failed');
      } finally {
        setLoading(false);
      }
    }
  });

  document.title = "Sign In | Finance Portal";

  return (
    <React.Fragment>
      <ParticlesAuth>
        <div className="auth-page-content mt-lg-5">
          <Container>
            <Row>
              <Col lg={12}>
                <div className="text-center mt-sm-5 mb-4 text-white-50">
                  <div>
                    <Link to="/" className="d-inline-block auth-logo">
                      <img src={logoLight} alt="" height="20" />
                    </Link>
                  </div>
                  <p className="mt-3 fs-15 fw-medium">Personal Finance Portal</p>
                </div>
              </Col>
            </Row>
            <Row className="justify-content-center">
              <Col md={8} lg={6} xl={5}>
                <Card className="mt-4">
                  <CardBody className="p-4">
                    <div className="text-center mt-2">
                      <h5 className="text-primary">Welcome Back!</h5>
                      <p className="text-muted">Sign in to your finance portal</p>
                    </div>
                    {error && <Alert color="danger">{error}</Alert>}
                    <div className="p-2 mt-4">
                      <Form onSubmit={(e) => { e.preventDefault(); validation.handleSubmit(); }}>
                        <div className="mb-3">
                          <Label htmlFor="email" className="form-label">Email</Label>
                          <Input
                            name="email"
                            type="email"
                            placeholder="Enter email"
                            onChange={validation.handleChange}
                            onBlur={validation.handleBlur}
                            value={validation.values.email}
                            invalid={validation.touched.email && !!validation.errors.email}
                          />
                          {validation.touched.email && validation.errors.email &&
                            <FormFeedback>{validation.errors.email}</FormFeedback>}
                        </div>
                        <div className="mb-3">
                          <div className="float-end">
                            <Link to="/forgot-password" className="text-muted">Forgot password?</Link>
                          </div>
                          <Label className="form-label">Password</Label>
                          <div className="position-relative auth-pass-inputgroup mb-3">
                            <Input
                              name="password"
                              type={passwordShow ? "text" : "password"}
                              placeholder="Enter password"
                              onChange={validation.handleChange}
                              onBlur={validation.handleBlur}
                              value={validation.values.password}
                              invalid={validation.touched.password && !!validation.errors.password}
                            />
                            {validation.touched.password && validation.errors.password &&
                              <FormFeedback>{validation.errors.password}</FormFeedback>}
                            <button className="btn btn-link position-absolute end-0 top-0 text-decoration-none text-muted" type="button" onClick={() => setPasswordShow(!passwordShow)}>
                              <i className="ri-eye-fill align-middle"></i>
                            </button>
                          </div>
                        </div>
                        <div className="mt-4">
                          <Button color="success" disabled={loading} className="btn btn-success w-100" type="submit">
                            {loading && <Spinner size="sm" className="me-2" />}
                            Sign In
                          </Button>
                        </div>
                      </Form>
                    </div>
                  </CardBody>
                </Card>
                <div className="mt-4 text-center">
                  <p className="mb-0">Don't have an account? <Link to="/register" className="fw-semibold text-primary text-decoration-underline">Sign up</Link></p>
                </div>
              </Col>
            </Row>
          </Container>
        </div>
      </ParticlesAuth>
    </React.Fragment>
  );
};

export default Login;