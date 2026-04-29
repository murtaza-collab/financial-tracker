import React, { useState, useEffect } from 'react';
import { Col, Container, Row, Card, CardBody, Input, Label, Form, Alert, Spinner, Button } from 'reactstrap';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validSession, setValidSession] = useState(false);
  const [passwordShow, setPasswordShow] = useState(false);
  const [confirmPasswordShow, setConfirmPasswordShow] = useState(false);

  document.title = 'Reset Password | Finance Portal';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValidSession(true);
    });
  }, []);

  const handleReset = async () => {
    if (!password || !confirmPassword) { setError('Please fill both fields'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => { supabase.auth.signOut(); navigate('/login'); }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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

            <Card style={{ borderRadius: 20, border: 'none', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}>
              <CardBody className="p-4 p-md-5">
                <div className="text-center mb-4">
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%',
                    background: '#e8f5e9', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}>
                    <i className="ri-lock-password-line" style={{ fontSize: 28, color: '#0ab39c' }}></i>
                  </div>
                  <h4 className="fw-bold" style={{ color: '#1a1a2e' }}>Reset Password</h4>
                  <p className="text-muted mb-0">Enter your new password below</p>
                </div>

                {success && <Alert color="success">{success}</Alert>}
                {error && <Alert color="danger">{error}</Alert>}

                {!validSession ? (
                  <Alert color="warning" className="text-center">
                    Invalid or expired reset link.{' '}
                    <Link to="/forgot-password" className="fw-semibold">Request a new one</Link>
                  </Alert>
                ) : (
                  <Form onSubmit={e => { e.preventDefault(); handleReset(); }}>
                    <div className="mb-3">
                      <Label className="fw-semibold">New Password</Label>
                      <div className="position-relative">
                        <Input
                          type={passwordShow ? "text" : "password"}
                          value={password} onChange={e => setPassword(e.target.value)}
                          placeholder="Min 8 characters"
                          style={{ borderRadius: 10, padding: '10px 14px', paddingRight: 40 }}
                        />
                        <button type="button" onClick={() => setPasswordShow(!passwordShow)}
                          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d' }}>
                          <i className={`ri-eye${passwordShow ? '-off' : ''}-fill`}></i>
                        </button>
                      </div>
                    </div>
                    <div className="mb-4">
                      <Label className="fw-semibold">Confirm New Password</Label>
                      <div className="position-relative">
                        <Input
                          type={confirmPasswordShow ? "text" : "password"}
                          value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="Repeat new password"
                          style={{ borderRadius: 10, padding: '10px 14px', paddingRight: 40 }}
                        />
                        <button type="button" onClick={() => setConfirmPasswordShow(!confirmPasswordShow)}
                          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d' }}>
                          <i className={`ri-eye${confirmPasswordShow ? '-off' : ''}-fill`}></i>
                        </button>
                      </div>
                    </div>
                    <Button color="success" disabled={loading} className="w-100 fw-semibold"
                      style={{ borderRadius: 10, padding: '11px', fontSize: 15 }} type="submit">
                      {loading && <Spinner size="sm" className="me-2" />}
                      Reset Password
                    </Button>
                  </Form>
                )}

                <div className="mt-4 text-center">
                  <Link to="/login" className="text-muted fs-13">
                    <i className="ri-arrow-left-line me-1"></i>Back to Login
                  </Link>
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

export default ResetPassword;