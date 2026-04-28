import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Badge, Spinner } from 'reactstrap';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/currency';
import BreadCrumb from '../../Components/Common/BreadCrumb';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    type: string;
    amount?: number;
    description?: string;
  };
}

const FinancialCalendar = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  document.title = 'Financial Calendar | Finance Portal';

  const fetchEvents = async () => {
    setLoading(true);
    const calendarEvents: CalendarEvent[] = [];

    // Credit card bill due dates
    const { data: bills } = await supabase
      .from('bills')
      .select('*, accounts!bills_account_id_fkey(name)')
      .eq('user_id', user?.id)
      .not('due_date', 'is', null);

    bills?.forEach(bill => {
      if (bill.due_date) {
        const isPaid = bill.status === 'paid';
        calendarEvents.push({
          id: `bill-${bill.id}`,
          title: `💳 ${bill.accounts?.name} Bill`,
          date: bill.due_date,
          backgroundColor: isPaid ? '#0ab39c' : '#f06548',
          borderColor: isPaid ? '#0ab39c' : '#f06548',
          textColor: '#fff',
          extendedProps: {
            type: 'Credit Card Bill',
            amount: bill.statement_amount || 0,
            description: isPaid ? 'Paid ✓' : `Remaining: ${formatCurrency(Math.max(0, (bill.statement_amount || 0) - (bill.total_paid || 0)))}`,
          },
        });
      }
    });

    // EMI due dates
    const { data: emiPayments } = await supabase
      .from('emi_payments')
      .select('*, emis!emi_payments_emi_id_fkey(loan_name, emi_amount)')
      .eq('user_id', user?.id)
      .order('due_date', { ascending: true });

    emiPayments?.forEach(p => {
      calendarEvents.push({
        id: `emi-${p.id}`,
        title: `🏦 ${p.emis?.loan_name} EMI`,
        date: p.due_date,
        backgroundColor: p.paid_date ? '#0ab39c' : '#405189',
        borderColor: p.paid_date ? '#0ab39c' : '#405189',
        textColor: '#fff',
        extendedProps: {
          type: 'EMI Payment',
          amount: p.emis?.emi_amount || 0,
          description: p.paid_date
            ? `Paid on ${new Date(p.paid_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}`
            : 'Pending',
        },
      });
    });

    // Loan due dates
    const { data: loans } = await supabase
      .from('loans')
      .select('*')
      .eq('user_id', user?.id)
      .eq('status', 'active')
      .not('due_date', 'is', null);

    loans?.forEach(loan => {
      calendarEvents.push({
        id: `loan-${loan.id}`,
        title: `${loan.direction === 'given' ? '📤' : '📥'} ${loan.person_name} Loan`,
        date: loan.due_date,
        backgroundColor: loan.direction === 'given' ? '#f7b84b' : '#f06548',
        borderColor: loan.direction === 'given' ? '#f7b84b' : '#f06548',
        textColor: '#fff',
        extendedProps: {
          type: loan.direction === 'given' ? 'Loan to Receive' : 'Loan to Pay',
          amount: loan.outstanding,
          description: `Outstanding: ${formatCurrency(loan.outstanding)}`,
        },
      });
    });

    // Recurring due dates
    const { data: recurringInstances } = await supabase
      .from('recurring_instances')
      .select('*, recurring_rules(name, amount)')
      .eq('user_id', user?.id)
      .order('due_date', { ascending: true });

    recurringInstances?.forEach(instance => {
      calendarEvents.push({
        id: `recurring-${instance.id}`,
        title: `🔄 ${instance.recurring_rules?.name}`,
        date: instance.due_date,
        backgroundColor: instance.status === 'confirmed' ? '#0ab39c' : instance.status === 'skipped' ? '#878a99' : '#299cdb',
        borderColor: instance.status === 'confirmed' ? '#0ab39c' : instance.status === 'skipped' ? '#878a99' : '#299cdb',
        textColor: '#fff',
        extendedProps: {
          type: 'Recurring Transaction',
          amount: instance.recurring_rules?.amount || 0,
          description: instance.status === 'confirmed' ? 'Confirmed ✓' : instance.status === 'skipped' ? 'Skipped' : 'Pending confirmation',
        },
      });
    });

    setEvents(calendarEvents);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEventClick = (info: any) => {
    setSelectedEvent({
      title: info.event.title,
      date: info.event.startStr,
      type: info.event.extendedProps.type,
      amount: info.event.extendedProps.amount,
      description: info.event.extendedProps.description,
      color: info.event.backgroundColor,
    });
  };

  const legend = [
    { color: '#f06548', label: 'Credit Card Bills / Loans to Pay' },
    { color: '#405189', label: 'EMI Payments' },
    { color: '#f7b84b', label: 'Loans to Receive' },
    { color: '#299cdb', label: 'Recurring (Pending)' },
    { color: '#0ab39c', label: 'Paid / Confirmed' },
    { color: '#878a99', label: 'Skipped' },
  ];

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="Financial Calendar" pageTitle="Finance Portal" />

          <Row className="mb-4">
            {/* Legend */}
            <Col>
              <Card>
                <CardBody className="py-2">
                  <div className="d-flex flex-wrap gap-3 align-items-center">
                    <small className="text-muted fw-semibold">Legend:</small>
                    {legend.map(l => (
                      <div key={l.label} className="d-flex align-items-center gap-1">
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color }}></div>
                        <small className="text-muted">{l.label}</small>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>

          <Row>
            <Col md={selectedEvent ? 9 : 12}>
              <Card>
                <CardBody>
                  {loading ? (
                    <div className="text-center py-5"><Spinner color="primary" /></div>
                  ) : (
                    <FullCalendar
                      plugins={[dayGridPlugin, listPlugin]}
                      initialView="dayGridMonth"
                      headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,listMonth',
                      }}
                      events={events}
                      eventClick={handleEventClick}
                      height="auto"
                      eventDisplay="block"
                      dayMaxEvents={3}
                      buttonText={{
                        today: 'Today',
                        month: 'Month',
                        list: 'List',
                      }}
                    />
                  )}
                </CardBody>
              </Card>
            </Col>

            {selectedEvent && (
              <Col md={3}>
                <Card className="border">
                  <CardHeader className="d-flex justify-content-between align-items-center" style={{ borderLeft: `4px solid ${selectedEvent.color}` }}>
                    <h6 className="mb-0">Event Details</h6>
                    <button className="btn btn-sm btn-ghost-secondary" onClick={() => setSelectedEvent(null)}>
                      <i className="ri-close-line"></i>
                    </button>
                  </CardHeader>
                  <CardBody>
                    <h6 className="mb-3">{selectedEvent.title}</h6>
                    <div className="d-flex justify-content-between mb-2">
                      <small className="text-muted">Date</small>
                      <small className="fw-semibold">
                        {new Date(selectedEvent.date).toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </small>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <small className="text-muted">Type</small>
                      <Badge color="soft-primary" className="text-primary">{selectedEvent.type}</Badge>
                    </div>
                    {selectedEvent.amount > 0 && (
                      <div className="d-flex justify-content-between mb-2">
                        <small className="text-muted">Amount</small>
                        <small className="fw-semibold text-danger">{formatCurrency(selectedEvent.amount)}</small>
                      </div>
                    )}
                    {selectedEvent.description && (
                      <div className="d-flex justify-content-between">
                        <small className="text-muted">Status</small>
                        <small className="fw-semibold">{selectedEvent.description}</small>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </Col>
            )}
          </Row>
        </Container>
      </div>
    </React.Fragment>
  );
};

export default FinancialCalendar;