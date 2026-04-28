import React, { useState } from "react";
import { Row, Col, Alert, Card, CardBody, Container, Input, Label, Form, FormFeedback, Spinner } from "reactstrap";
import { Link } from "react-router-dom";
import * as Yup from "yup";
import { useFormik } from "formik";
import { supabase } from "../../lib/supabase";
import ParticlesAuth from "../AuthenticationInner/ParticlesAuth";

const ForgetPasswordPage = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const validation = useFormik({
    initialValues: { email: '' },
    validationSchema: Yup.object({
      email: Yup.string().email('Invalid email').required('Please enter your email'),
    }),
    onSubmit: async (values) => {
      setLoading(true);
      setError('');
      setSuccess('');
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSuccess('Password reset link sent! Check your email inbox.');
      } catch (err: any) {
        setError(err.message || 'Failed to send reset email');
      } finally {
        setLoading(false);
      }
    }
  });

  document.title = 'Forgot Password | Finance Portal';

  return (
    <ParticlesAuth>
      <div className="auth-page-content mt-lg-5">
        <Container>
          <Row>
            <Col lg={12}>
              <div className="text-center mt-sm-5 mb-4 text-white-50">
                <h3 className="text-white fw-bold">
                  <i className="bx bx-wallet me-2"></i>Finance Portal
                </h3>
                <p className="mt-2 fs-15 fw-medium">Your complete financial picture</p>
              </div>
            </Col>
          </Row>

          <Row className="justify-content-center">
            <Col md={8} lg={6} xl={5}>
              <Card className="mt-4">
                <CardBody className="p-4">
                  <div className="text-center mt-2 mb-4">
                    <h5 className="text-primary">Forgot Password?</h5>
                    <p className="text-muted">Enter your email to receive a reset link</p>
                    <i className="ri-mail-send-line display-5 text-success"></i>
                  </div>

                  {success && <Alert color="success">{success}</Alert>}
                  {error && <Alert color="danger">{error}</Alert>}

                  <Form onSubmit={(e) => { e.preventDefault(); validation.handleSubmit(); }}>
                    <div className="mb-4">
                      <Label className="form-label">Email</Label>
                      <Input
                        name="email"
                        type="email"
                        placeholder="Enter your email"
                        onChange={validation.handleChange}
                        onBlur={validation.handleBlur}
                        value={validation.values.email}
                        invalid={validation.touched.email && !!validation.errors.email}
                      />
                      {validation.touched.email && validation.errors.email && (
                        <FormFeedback>{validation.errors.email}</FormFeedback>
                      )}
                    </div>
                    <button className="btn btn-success w-100" type="submit" disabled={loading}>
                      {loading && <Spinner size="sm" className="me-2" />}
                      Send Reset Link
                    </button>
                  </Form>
                </CardBody>
              </Card>

              <div className="mt-4 text-center">
                <p className="mb-0">
                  Remember your password?{' '}
                  <Link to="/login" className="fw-semibold text-primary text-decoration-underline">Sign in</Link>
                </p>
              </div>
            </Col>
          </Row>
        </Container>
      </div>
    </ParticlesAuth>
  );
};

export default ForgetPasswordPage;