import React, { useState } from "react";
import { Col, Container, Input, Label, Row, Button, Form, FormFeedback, Alert, Spinner, Card, CardBody } from "reactstrap";
import * as Yup from "yup";
import { useFormik } from "formik";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";

const ForgetPasswordPage = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  document.title = 'Forgot Password | Finance Portal';

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

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
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
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%',
                    background: '#e8f5e9', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}>
                    <i className="ri-mail-send-line" style={{ fontSize: 28, color: '#0ab39c' }}></i>
                  </div>
                  <h4 className="fw-bold" style={{ color: '#1a1a2e' }}>Forgot Password?</h4>
                  <p className="text-muted mb-0">Enter your email to receive a reset link</p>
                </div>

                {success && <Alert color="success">{success}</Alert>}
                {error && <Alert color="danger">{error}</Alert>}

                <Form onSubmit={(e) => { e.preventDefault(); validation.handleSubmit(); }}>
                  <div className="mb-4">
                    <Label className="fw-semibold">Email</Label>
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

                  <Button
                    color="success" disabled={loading} className="w-100 fw-semibold"
                    style={{ borderRadius: 10, padding: '11px', fontSize: 15 }}
                    type="submit"
                  >
                    {loading ? <Spinner size="sm" className="me-2" /> : null}
                    Send Reset Link
                  </Button>
                </Form>

                <div className="mt-4 text-center">
                  <p className="text-muted mb-0">
                    Remember your password?{' '}
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

export default ForgetPasswordPage;