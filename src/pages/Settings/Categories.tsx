import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Button, Input, Alert, Badge, Spinner } from 'reactstrap';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import BreadCrumb from '../../Components/Common/BreadCrumb';

const DEFAULT_CATEGORIES = [
  'Grocery', 'Restaurant & Food', 'Fuel', 'Utility Bills',
  'Mobile & Internet', 'Medical', 'Transport', 'Shopping',
  'Education', 'Rent', 'Salary', 'Freelance Income',
  'Business Income', 'Reimbursement', 'Family',
  'Entertainment', 'Travel', 'Office Expense', 'Other',
];

interface CustomCategory { id: string; name: string; }

const Categories = () => {
  const { user } = useAuth();
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  document.title = 'Custom Categories | Finance Portal';

  const fetchCategories = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('custom_categories').select('*')
      .eq('user_id', user?.id)
      .order('name');
    if (data) setCustomCategories(data);
    setLoading(false);
  };

  useEffect(() => { fetchCategories(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed) { setError('Please enter a category name'); return; }
    if (DEFAULT_CATEGORIES.map(c => c.toLowerCase()).includes(trimmed.toLowerCase())) {
      setError('This category already exists in defaults');
      return;
    }
    if (customCategories.find(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('You already have this custom category');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await supabase.from('custom_categories').insert({
        user_id: user?.id,
        name: trimmed,
      });
      setNewCategory('');
      setSuccess(`"${trimmed}" added successfully`);
      setTimeout(() => setSuccess(''), 3000);
      fetchCategories();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? Existing transactions with this category won't be affected.`)) return;
    await supabase.from('custom_categories').delete().eq('id', id);
    fetchCategories();
  };

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="Custom Categories" pageTitle="Settings" />

          <Row>
            <Col md={6}>
              {/* Add new category */}
              <Card className="mb-4">
                <CardHeader><h5 className="mb-0">Add Custom Category</h5></CardHeader>
                <CardBody>
                  {error && <Alert color="danger">{error}</Alert>}
                  {success && <Alert color="success">{success}</Alert>}
                  <div className="d-flex gap-2">
                    <Input
                      placeholder="e.g. Petrol, Household, Gym..."
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    />
                    <Button color="success" onClick={handleAdd} disabled={saving}>
                      {saving ? <Spinner size="sm" /> : <i className="ri-add-line"></i>}
                    </Button>
                  </div>
                  <small className="text-muted mt-2 d-block">Press Enter or click + to add</small>
                </CardBody>
              </Card>

              {/* Custom categories */}
              <Card>
                <CardHeader><h5 className="mb-0">Your Custom Categories</h5></CardHeader>
                <CardBody>
                  {loading ? (
                    <div className="text-center py-3"><Spinner color="primary" /></div>
                  ) : customCategories.length === 0 ? (
                    <p className="text-muted text-center py-3">No custom categories yet.</p>
                  ) : (
                    <div className="d-flex flex-wrap gap-2">
                      {customCategories.map(cat => (
                        <div key={cat.id} className="d-flex align-items-center gap-1 border rounded px-2 py-1">
                          <span className="fs-13">{cat.name}</span>
                          <button
                            className="btn btn-sm p-0 ms-1 text-danger"
                            onClick={() => handleDelete(cat.id, cat.name)}
                            style={{ lineHeight: 1 }}
                          >
                            <i className="ri-close-line"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            </Col>

            <Col md={6}>
              {/* Default categories reference */}
              <Card>
                <CardHeader><h5 className="mb-0">Default Categories</h5></CardHeader>
                <CardBody>
                  <div className="d-flex flex-wrap gap-2">
                    {DEFAULT_CATEGORIES.map(cat => (
                      <Badge key={cat} color="light" className="text-dark border fs-12 fw-normal px-2 py-1">
                        {cat}
                      </Badge>
                    ))}
                  </div>
                  <small className="text-muted mt-3 d-block">These are built-in and cannot be deleted.</small>
                </CardBody>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>
    </React.Fragment>
  );
};

export default Categories;