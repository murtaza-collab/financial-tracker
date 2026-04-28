import React, { useState, useEffect } from 'react';
import { Row, Col, Card, CardBody, Container, Input, Label, Form, Alert, Spinner } from 'reactstrap';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import ParticlesAuth from '../AuthenticationInner/ParticlesAuth';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validSession, setValidSession] = useState(false);

  document.title = 'Reset Password | Finance Portal';

  useEffect(() => {
    // Check if we have a valid session from the reset link
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValidSession(true);
    });
  }, []);

  const handleReset = async () => {
    if (!password || !confirmPassword) {
      setError('Please fill both fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        supabase.auth.signOut();
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
              </div>
            </Col>
          </Row>
          <Row className="justify-content-center">
            <Col md={8} lg={6} xl={5}>
              <Card className="mt-4">
                <CardBody className="p-4">
                  <div className="text-center mt-2 mb-4">
                    <h5 className="text-primary">Reset Password</h5>
                    <p className="text-muted">Enter your new password below</p>
                    <i className="ri-lock-password-line display-5 text-success"></i>
                  </div>

                  {success && <Alert color="success">{success}</Alert>}
                  {error && <Alert color="danger">{error}</Alert>}

                  {!validSession ? (
                    <Alert color="warning">
                      Invalid or expired reset link. Please request a new one.{' '}
                      <Link to="/forgot-password">Click here</Link>
                    </Alert>
                  ) : (
                    <Form onSubmit={e => { e.preventDefault(); handleReset(); }}>
                      <div className="mb-3">
                        <Label>New Password</Label>
                        <Input
                          type="password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder="Min 8 characters"
                        />
                      </div>
                      <div className="mb-4">
                        <Label>Confirm New Password</Label>
                        <Input
                          type="password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="Repeat new password"
                        />
                      </div>
                      <button className="btn btn-success w-100" type="submit" disabled={loading}>
                        {loading && <Spinner size="sm" className="me-2" />}
                        Reset Password
                      </button>
                    </Form>
                  )}
                </CardBody>
              </Card>
              <div className="mt-4 text-center">
                <Link to="/login" className="text-white-50">Back to Login</Link>
              </div>
            </Col>
          </Row>
        </Container>
      </div>
    </ParticlesAuth>
  );
};

export default ResetPassword;