import React, { useState } from "react";
import { Row, Col, CardBody, Card, Alert, Container, Input, Label, Form, FormFeedback, Button, Spinner } from "reactstrap";
import * as Yup from "yup";
import { useFormik } from "formik";
import { Link, useNavigate } from "react-router-dom";
import logoLight from "../../assets/images/logo-light.png";
import ParticlesAuth from "../AuthenticationInner/ParticlesAuth";
import { useAuth } from "../../context/AuthContext";

const Register = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

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
        setTimeout(() => navigate('/login'), 3000);
      } catch (err: any) {
        setError(err.message || 'Registration failed');
      } finally {
        setLoading(false);
      }
    }
  });

  document.title = "Sign Up | Finance Portal";

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
                      <h5 className="text-primary">Create Account</h5>
                      <p className="text-muted">Sign up to get started</p>
                    </div>
                    <div className="p-2 mt-4">
                      <Form onSubmit={(e) => { e.preventDefault(); validation.handleSubmit(); }}>

                        {success && (
                          <Alert color="success">
                            Account created! Check your email to verify, then <Link to="/login">sign in</Link>.
                          </Alert>
                        )}
                        {error && <Alert color="danger">{error}</Alert>}

                        <div className="mb-3">
                          <Label className="form-label">Full Name <span className="text-danger">*</span></Label>
                          <Input
                            name="first_name"
                            type="text"
                            placeholder="Enter your full name"
                            onChange={validation.handleChange}
                            onBlur={validation.handleBlur}
                            value={validation.values.first_name}
                            invalid={validation.touched.first_name && !!validation.errors.first_name}
                          />
                          {validation.touched.first_name && validation.errors.first_name &&
                            <FormFeedback>{validation.errors.first_name}</FormFeedback>}
                        </div>

                        <div className="mb-3">
                          <Label className="form-label">Email <span className="text-danger">*</span></Label>
                          <Input
                            name="email"
                            type="email"
                            placeholder="Enter email address"
                            onChange={validation.handleChange}
                            onBlur={validation.handleBlur}
                            value={validation.values.email}
                            invalid={validation.touched.email && !!validation.errors.email}
                          />
                          {validation.touched.email && validation.errors.email &&
                            <FormFeedback>{validation.errors.email}</FormFeedback>}
                        </div>

                        <div className="mb-3">
                          <Label className="form-label">Password <span className="text-danger">*</span></Label>
                          <Input
                            name="password"
                            type="password"
                            placeholder="Enter password (min 8 characters)"
                            onChange={validation.handleChange}
                            onBlur={validation.handleBlur}
                            value={validation.values.password}
                            invalid={validation.touched.password && !!validation.errors.password}
                          />
                          {validation.touched.password && validation.errors.password &&
                            <FormFeedback>{validation.errors.password}</FormFeedback>}
                        </div>

                        <div className="mb-3">
                          <Label className="form-label">Confirm Password <span className="text-danger">*</span></Label>
                          <Input
                            name="confirm_password"
                            type="password"
                            placeholder="Confirm your password"
                            onChange={validation.handleChange}
                            onBlur={validation.handleBlur}
                            value={validation.values.confirm_password}
                            invalid={validation.touched.confirm_password && !!validation.errors.confirm_password}
                          />
                          {validation.touched.confirm_password && validation.errors.confirm_password &&
                            <FormFeedback>{validation.errors.confirm_password}</FormFeedback>}
                        </div>

                        <div className="mt-4">
                          <Button color="success" className="w-100" type="submit" disabled={loading}>
                            {loading && <Spinner size="sm" className="me-2" />}
                            Create Account
                          </Button>
                        </div>
                      </Form>
                    </div>
                  </CardBody>
                </Card>
                <div className="mt-4 text-center">
                  <p className="mb-0">Already have an account? <Link to="/login" className="fw-semibold text-primary text-decoration-underline">Sign in</Link></p>
                </div>
              </Col>
            </Row>
          </Container>
        </div>
      </ParticlesAuth>
    </React.Fragment>
  );
};

export default Register;