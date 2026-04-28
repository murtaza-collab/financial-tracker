import React, { useState, useEffect } from 'react';
import { Dropdown, DropdownMenu, DropdownToggle } from 'reactstrap';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface Notification {
  type: string;
  message: string;
  link: string;
  urgency: string;
}

const NotificationDropdown = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const toggle = () => setIsOpen(!isOpen);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchNotifications = async () => {
    const alerts: Notification[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7Days = new Date(today);
    in7Days.setDate(today.getDate() + 7);

    // Check credit card bills due soon
    const { data: bills } = await supabase
      .from('bills')
      .select('*, accounts!bills_account_id_fkey(name)')
      .eq('user_id', user?.id)
      .neq('status', 'paid')
      .not('due_date', 'is', null);

    bills?.forEach(bill => {
      const dueDate = new Date(bill.due_date);
      const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
      if (daysLeft < 0) {
        alerts.push({
          type: 'danger',
          message: `${bill.accounts?.name} bill overdue by ${Math.abs(daysLeft)} days`,
          link: '/credit-cards',
          urgency: 'high',
        });
      } else if (daysLeft <= 7) {
        alerts.push({
          type: 'warning',
          message: `${bill.accounts?.name} bill due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
          link: '/credit-cards',
          urgency: 'medium',
        });
      }
    });

    // Check EMIs due soon
    const { data: emiPayments } = await supabase
      .from('emi_payments')
      .select('*, emis!emi_payments_emi_id_fkey(loan_name)')
      .eq('user_id', user?.id)
      .is('paid_date', null)
      .lte('due_date', in7Days.toISOString().split('T')[0])
      .order('due_date', { ascending: true });

    emiPayments?.forEach(p => {
      const daysLeft = Math.ceil((new Date(p.due_date).getTime() - today.getTime()) / 86400000);
      if (daysLeft < 0) {
        alerts.push({
          type: 'danger',
          message: `${p.emis?.loan_name} EMI overdue`,
          link: '/emis',
          urgency: 'high',
        });
      } else {
        alerts.push({
          type: 'warning',
          message: `${p.emis?.loan_name} EMI due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
          link: '/emis',
          urgency: 'medium',
        });
      }
    });

    // Check pending recurring transactions
    const { data: pending } = await supabase
      .from('recurring_instances')
      .select('*, recurring_rules(name)')
      .eq('user_id', user?.id)
      .eq('status', 'pending');

    if (pending && pending.length > 0) {
      alerts.push({
        type: 'info',
        message: `${pending.length} recurring transaction${pending.length > 1 ? 's' : ''} pending confirmation`,
        link: '/recurring',
        urgency: 'low',
      });
    }

    // Check overdue loans
    const { data: loans } = await supabase
      .from('loans')
      .select('person_name, outstanding, due_date, direction')
      .eq('user_id', user?.id)
      .eq('status', 'active')
      .not('due_date', 'is', null);

    loans?.forEach(loan => {
      const daysLeft = Math.ceil((new Date(loan.due_date).getTime() - today.getTime()) / 86400000);
      if (daysLeft < 0 && loan.direction === 'given') {
        alerts.push({
          type: 'danger',
          message: `Loan from ${loan.person_name} overdue`,
          link: '/loans-given',
          urgency: 'high',
        });
      }
    });

    // Sort by urgency
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    alerts.sort((a, b) => order[a.urgency] - order[b.urgency]);
    setNotifications(alerts.slice(0, 10));
  };

  const getIcon = (type: string) => {
    if (type === 'danger') return <i className="ri-error-warning-line text-danger fs-16"></i>;
    if (type === 'warning') return <i className="ri-time-line text-warning fs-16"></i>;
    return <i className="ri-information-line text-info fs-16"></i>;
  };

  const getBg = (type: string) => {
    if (type === 'danger') return 'bg-danger-subtle';
    if (type === 'warning') return 'bg-warning-subtle';
    return 'bg-info-subtle';
  };

  return (
    <React.Fragment>
      <Dropdown isOpen={isOpen} toggle={toggle} className="topbar-head-dropdown ms-1 header-item">
        <DropdownToggle type="button" tag="button" className="btn btn-icon btn-topbar btn-ghost-secondary rounded-circle">
          <i className='bx bx-bell fs-22'></i>
          {notifications.length > 0 && (
            <span className="position-absolute topbar-badge fs-10 translate-middle badge rounded-pill bg-danger">
              {notifications.length}
            </span>
          )}
        </DropdownToggle>
        <DropdownMenu className="dropdown-menu-lg dropdown-menu-end p-0">
          <div className="dropdown-head bg-primary bg-pattern rounded-top p-3">
            <div className="d-flex justify-content-between align-items-center">
              <h6 className="m-0 fs-16 fw-semibold text-white">Notifications</h6>
              <span className="badge bg-light-subtle text-body fs-13">
                {notifications.length} Alert{notifications.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div style={{ maxHeight: 350, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div className="text-center py-4">
                <i className="ri-checkbox-circle-line fs-1 text-success"></i>
                <p className="text-muted mt-2 mb-0">All caught up! No alerts.</p>
              </div>
            ) : (
              notifications.map((n, i) => (
                <Link to={n.link} key={i} className="text-reset notification-item d-block dropdown-item" onClick={() => setIsOpen(false)}>
                  <div className="d-flex align-items-center gap-3 py-2">
                    <div className={`avatar-xs ${getBg(n.type)} rounded-circle d-flex align-items-center justify-content-center`}>
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-grow-1">
                      <p className="mb-0 fs-13">{n.message}</p>
                    </div>
                    <i className="ri-arrow-right-s-line text-muted"></i>
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="p-2 border-top">
            <Link to="/dashboard" className="btn btn-sm btn-soft-primary w-100" onClick={() => setIsOpen(false)}>
              Go to Dashboard
            </Link>
          </div>
        </DropdownMenu>
      </Dropdown>
    </React.Fragment>
  );
};

export default NotificationDropdown;