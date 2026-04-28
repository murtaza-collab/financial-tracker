import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Button, Form, FormGroup, Label, Input, Alert, Spinner } from 'reactstrap';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import BreadCrumb from '../../Components/Common/BreadCrumb';

const UserProfile = () => {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Profile fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  document.title = 'Profile | Finance Portal';

  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setName(user.user_metadata?.name || '');
      fetchProfile();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProfile = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', user?.id)
      .single();
    if (data) {
      setName(data.name || user?.user_metadata?.name || '');
      setEmail(data.email || user?.email || '');
    }
    setLoading(false);
  };

  const handleUpdateProfile = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      // Update profile table
      await supabase.from('profiles').update({ name, email }).eq('id', user?.id);

      // Update auth metadata
      await supabase.auth.updateUser({ data: { name } });

      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setPwError('Please fill both fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters');
      return;
    }
    setPwSaving(true);
    setPwError('');
    setPwSuccess('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPwSuccess('Password changed successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwSuccess(''), 3000);
    } catch (err: any) {
      setPwError(err.message);
    } finally {
      setPwSaving(false);
    }
  };

  const initials = name ? name.charAt(0).toUpperCase() : email.charAt(0).toUpperCase();

  if (loading) return (
    <div className="page-content">
      <div className="text-center py-5"><Spinner color="primary" /></div>
    </div>
  );

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="Profile" pageTitle="Finance Portal" />

          <Row>
            <Col md={4}>
              {/* Profile Card */}
              <Card>
                <CardBody className="text-center py-4">
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: '#405189', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 32, margin: '0 auto 16px'
                  }}>
                    {initials}
                  </div>
                  <h5 className="mb-1">{name || 'User'}</h5>
                  <p className="text-muted mb-3">{email}</p>
                  <div className="d-flex justify-content-center gap-2">
                    <span className="badge bg-success-subtle text-success px-3 py-2">
                      <i className="ri-shield-check-line me-1"></i>Active Account
                    </span>
                  </div>
                </CardBody>
              </Card>

              {/* Account Info */}
              <Card>
                <CardHeader><h5 className="mb-0">Account Info</h5></CardHeader>
                <CardBody>
                  <div className="d-flex justify-content-between py-2 border-bottom">
                    <small className="text-muted">User ID</small>
                    <small className="fw-semibold text-truncate ms-2" style={{ maxWidth: 150 }}>{user?.id?.slice(0, 8)}...</small>
                  </div>
                  <div className="d-flex justify-content-between py-2 border-bottom">
                    <small className="text-muted">Email</small>
                    <small className="fw-semibold">{email}</small>
                  </div>
                  <div className="d-flex justify-content-between py-2 border-bottom">
                    <small className="text-muted">Currency</small>
                    <small className="fw-semibold">PKR (Rs.)</small>
                  </div>
                  <div className="d-flex justify-content-between py-2">
                    <small className="text-muted">Member Since</small>
                    <small className="fw-semibold">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-PK', { month: 'short', year: 'numeric' }) : '—'}
                    </small>
                  </div>
                </CardBody>
              </Card>

              {/* Logout */}
              <Card>
                <CardBody>
                  <Button color="danger" outline className="w-100" onClick={signOut}>
                    <i className="ri-logout-box-line me-2"></i>Sign Out
                  </Button>
                </CardBody>
              </Card>
            </Col>

            <Col md={8}>
              {/* Edit Profile */}
              <Card className="mb-4">
                <CardHeader><h5 className="mb-0">Edit Profile</h5></CardHeader>
                <CardBody>
                  {success && <Alert color="success">{success}</Alert>}
                  {error && <Alert color="danger">{error}</Alert>}
                  <Form>
                    <FormGroup>
                      <Label>Full Name</Label>
                      <Input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Your full name"
                      />
                    </FormGroup>
                    <FormGroup>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={email}
                        disabled
                        className="bg-light"
                      />
                      <small className="text-muted">Email cannot be changed</small>
                    </FormGroup>
                    <Button color="success" onClick={handleUpdateProfile} disabled={saving}>
                      {saving && <Spinner size="sm" className="me-2" />}
                      Save Changes
                    </Button>
                  </Form>
                </CardBody>
              </Card>

              {/* Change Password */}
              <Card>
                <CardHeader><h5 className="mb-0">Change Password</h5></CardHeader>
                <CardBody>
                  {pwSuccess && <Alert color="success">{pwSuccess}</Alert>}
                  {pwError && <Alert color="danger">{pwError}</Alert>}
                  <Form>
                    <FormGroup>
                      <Label>New Password</Label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Min 8 characters"
                      />
                    </FormGroup>
                    <FormGroup>
                      <Label>Confirm New Password</Label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                      />
                    </FormGroup>
                    <Button color="warning" onClick={handleChangePassword} disabled={pwSaving}>
                      {pwSaving && <Spinner size="sm" className="me-2" />}
                      Change Password
                    </Button>
                  </Form>
                </CardBody>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>
    </React.Fragment>
  );
};

export default UserProfile;