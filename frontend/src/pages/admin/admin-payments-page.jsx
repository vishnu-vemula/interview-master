/**
 * AdminPaymentsPage — PayU orders: confirmed revenue / refund stats, status filter,
 * transactions (request refund, verify refund) and recent verified PayU callbacks.
 * APIs: GET /admin/payments/transactions · /stats · /webhooks,
 *       POST /admin/payments/transactions/:id/refund · /:id/reconcile
 */

import { useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Wallet, Receipt, Undo2, XCircle, RefreshCw, BadgeCheck, Webhook, RotateCcw,
} from 'lucide-react';
import {
  getAdminTransactions, getAdminPaymentStats, refundAdminTransaction, getAdminWebhookLogs,
} from '@/services/admin.service';
import api from '@/lib/admin-axios';
import {
  Button, Card, EmptyState, ErrorState, PageHeader, Pagination, Pill, Segmented, Skeleton,
  StatTile, TableShell, useConfirm,
} from '@/components/ui';
import { formatDate, formatDateTime, getErrorMessage, timeAgo } from '@/utils';

const rupees = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_META = {
  pending: { label: 'Pending', tone: 'blue' },
  success: { label: 'Success', tone: 'ok' },
  failed: { label: 'Failed', tone: 'coral' },
  refund_pending: { label: 'Refund pending', tone: 'stone' },
  refunded: { label: 'Refunded', tone: 'coral' },
};

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'refund_pending', label: 'Refund pending' },
  { value: 'refunded', label: 'Refunded' },
];

const CALLBACK_TONE = { processed: 'ok', failed: 'coral', ignored: 'stone' };

function StatusPill({ status }) {
  const meta = STATUS_META[status] || { label: String(status || 'unknown').replace(/_/g, ' '), tone: 'stone' };
  return <Pill tone={meta.tone} mono>{meta.label}</Pill>;
}

const COLUMNS = ['Date', 'Order', 'Candidate', 'Plan', 'Amount', 'Status', ''];

export default function AdminPaymentsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [busy, setBusy] = useState('');

  const ordersQuery = useQuery({
    queryKey: ['admin-payments', 'transactions', { page, status }],
    queryFn: () => getAdminTransactions({ page, status, limit: 20 }),
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery({
    queryKey: ['admin-payments', 'stats'],
    queryFn: getAdminPaymentStats,
  });
  const callbacksQuery = useQuery({
    queryKey: ['admin-payments', 'webhooks'],
    queryFn: () => getAdminWebhookLogs({ limit: 10 }),
  });

  const load = () => queryClient.invalidateQueries({ queryKey: ['admin-payments'] });

  const orders = ordersQuery.data?.transactions || [];
  const pages = ordersQuery.data?.pages || 1;
  const total = ordersQuery.data?.total ?? 0;
  const stats = statsQuery.data;
  const events = callbacksQuery.data?.logs || [];
  const refreshing = (ordersQuery.isFetching || statsQuery.isFetching || callbacksQuery.isFetching) && !ordersQuery.isLoading;

  const refund = async (order) => {
    const ok = await confirm({
      title: 'Request a PayU refund?',
      description: `PayU will be asked to refund ${rupees(order.amount)} for order ${order.transactionId}. The order stays “refund pending” until PayU confirms the refund.`,
      confirmLabel: 'Request refund',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(order._id);
    try {
      await refundAdminTransaction(order._id, 'Customer requested refund');
      toast.success('Refund submitted to PayU. It remains pending until confirmed.');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'PayU refund request failed'));
      load();
    } finally {
      setBusy('');
    }
  };

  const reconcile = async (order) => {
    setBusy(order._id);
    try {
      const { data } = await api.post(`/admin/payments/transactions/${order._id}/reconcile`);
      const next = data?.order?.status;
      if (next === 'refunded') toast.success('PayU confirmed the refund.');
      else if (next === 'success') toast.error('PayU reported the refund as failed — the order is back to paid.');
      else toast('PayU hasn’t settled this refund yet. Try verifying again later.');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Refund remains unverified'));
    } finally {
      setBusy('');
    }
  };

  const changeStatus = (value) => {
    setStatus(value);
    setPage(1);
  };

  const activeFilter = STATUS_FILTERS.find((f) => f.value === status);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin · Payments"
        title="PayU payments"
        description="Verified PayU orders, refunds and callbacks. All amounts are in INR."
        actions={
          <Button variant="soft" icon={RefreshCw} onClick={load} loading={refreshing}>
            Refresh
          </Button>
        }
      />

      {statsQuery.isError ? (
        <ErrorState
          compact
          title="Couldn’t load payment totals"
          description={getErrorMessage(statsQuery.error, 'The payments service did not respond.')}
          onRetry={statsQuery.refetch}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            tone="ink"
            icon={Wallet}
            label="Confirmed revenue"
            value={rupees(stats?.totalRevenue)}
            sub="Success + refund pending"
            loading={statsQuery.isLoading}
          />
          <StatTile
            tone="lime"
            icon={BadgeCheck}
            label="Confirmed sales"
            value={stats?.successfulSales ?? '—'}
            sub="Paid PayU orders"
            loading={statsQuery.isLoading}
          />
          <StatTile
            icon={Undo2}
            label="Refunded"
            value={rupees(stats?.totalRefunded)}
            sub={`${stats?.refundedSales ?? 0} refunded order${stats?.refundedSales === 1 ? '' : 's'}`}
            loading={statsQuery.isLoading}
          />
          <StatTile
            icon={XCircle}
            label="Failed orders"
            value={stats?.failedSales ?? '—'}
            sub="Marked failed by PayU"
            loading={statsQuery.isLoading}
          />
        </div>
      )}

      <section className="space-y-4" aria-labelledby="payments-orders-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="payments-orders-heading" className="text-[17px] font-medium tracking-tight1">Orders</h2>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-mono text-muted tabular">
              {ordersQuery.isLoading ? 'Loading…' : `${total} order${total === 1 ? '' : 's'}`}
            </p>
          </div>
          <Segmented
            ariaLabel="Filter orders by status"
            size="sm"
            options={STATUS_FILTERS}
            value={status}
            onChange={changeStatus}
          />
        </div>

        {ordersQuery.isError ? (
          <ErrorState
            title="Couldn’t load PayU orders"
            description={getErrorMessage(ordersQuery.error, 'Could not load PayU financial records.')}
            onRetry={ordersQuery.refetch}
          />
        ) : ordersQuery.isLoading ? (
          <TableShell minWidth={880}>
            <thead>
              <tr>{COLUMNS.map((c, i) => <th key={i}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {COLUMNS.map((c, j) => (
                    <td key={j}><Skeleton className="h-4 w-full max-w-[140px]" /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={status === 'all' ? 'No PayU orders yet' : `No ${activeFilter?.label.toLowerCase()} orders`}
            description={
              status === 'all'
                ? 'Orders appear here as soon as a candidate starts a PayU checkout.'
                : 'Try another status filter to see the rest of the orders.'
            }
            action={status !== 'all' ? <Button variant="soft" size="sm" onClick={() => changeStatus('all')}>Show all orders</Button> : null}
          />
        ) : (
          <>
            <TableShell minWidth={880} className={ordersQuery.isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Order</th>
                  <th>Candidate</th>
                  <th>Plan</th>
                  <th className="text-right">Amount</th>
                  <th>Status</th>
                  <th className="relative text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const rowBusy = busy === order._id;
                  return (
                    <tr key={order._id}>
                      <td className="whitespace-nowrap">
                        <p className="whitespace-nowrap text-[14px]">{formatDate(order.createdAt)}</p>
                        <p className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-mono text-faint">{timeAgo(order.createdAt)}</p>
                      </td>
                      <td>
                        <p className="whitespace-nowrap font-mono text-[12.5px]">{order.transactionId || '—'}</p>
                        {order.refundRequestId && (
                          <p className="mt-0.5 whitespace-nowrap font-mono text-[10.5px] text-muted">Refund req · {order.refundRequestId}</p>
                        )}
                      </td>
                      <td className="max-w-[240px]">
                        {order.userId ? (
                          <>
                            <p className="truncate font-medium">{order.userId.name || '—'}</p>
                            <p className="truncate text-[12.5px] text-muted">{order.userId.email || '—'}</p>
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">{order.planId?.name || <span className="text-muted">—</span>}</td>
                      <td className="whitespace-nowrap text-right font-medium tabular">{rupees(order.amount)}</td>
                      <td><StatusPill status={order.status} /></td>
                      <td className="whitespace-nowrap text-right">
                        {order.status === 'success' && (
                          <Button
                            variant="danger"
                            size="sm"
                            icon={Undo2}
                            disabled={!!busy}
                            loading={rowBusy}
                            onClick={() => refund(order)}
                          >
                            Request refund
                          </Button>
                        )}
                        {order.status === 'refund_pending' && (
                          <Button
                            variant="soft"
                            size="sm"
                            icon={RotateCcw}
                            disabled={!!busy}
                            loading={rowBusy}
                            onClick={() => reconcile(order)}
                          >
                            Verify refund
                          </Button>
                        )}
                        {order.status !== 'success' && order.status !== 'refund_pending' && (
                          <span className="text-faint" aria-hidden="true">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
            <Pagination page={page} totalPages={pages} onPageChange={setPage} disabled={ordersQuery.isFetching} />
          </>
        )}
      </section>

      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[17px] font-medium tracking-tight1">Recent verified callbacks</h2>
          <span className="mono-label text-muted">Latest 10 · PayU</span>
        </div>
        {callbacksQuery.isError ? (
          <ErrorState
            compact
            title="Couldn’t load PayU callbacks"
            description={getErrorMessage(callbacksQuery.error, 'The webhook log did not respond.')}
            onRetry={callbacksQuery.refetch}
          />
        ) : callbacksQuery.isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : events.length === 0 ? (
          <EmptyState
            compact
            icon={Webhook}
            title="No callbacks received"
            description="Verified PayU payment and refund notifications will be listed here."
          />
        ) : (
          <ul className="divide-y divide-line-2">
            {events.map((event) => (
              <li key={event._id} className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-r9 bg-stone-2 text-ink">
                    <Webhook size={15} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[12.5px]">{event.eventType || 'unknown event'}</p>
                    {event.eventId && <p className="truncate font-mono text-[10.5px] text-muted">{event.eventId}</p>}
                    {event.error && <p className="mt-0.5 break-words text-[12.5px] text-coral">{event.error}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-12 sm:pl-0">
                  <Pill tone={CALLBACK_TONE[event.status] || 'stone'} mono>{event.status || '—'}</Pill>
                  <span className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-mono text-faint" title={formatDateTime(event.createdAt)}>
                    {formatDateTime(event.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
