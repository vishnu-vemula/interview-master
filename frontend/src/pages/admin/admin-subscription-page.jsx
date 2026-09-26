/**
 * AdminSubscriptionPage — subscription plan management: plan metrics, live / archived plan list,
 * create & edit (price, direct discount, credits, validity, features, coupons, publish),
 * quick publish / unpublish, archive (DELETE /admin/plans/:id is a soft archive) and restore.
 * APIs: GET /admin/plans · /admin/plans/stats, POST /admin/plans, PATCH/DELETE /admin/plans/:id
 */

import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Plus, Pencil, Archive, ArchiveRestore, Eye, EyeOff, LayoutGrid, CheckCircle2, ShieldCheck, Coins,
  RefreshCw, Layers,
} from 'lucide-react';
import {
  getAdminPlans, getAdminPlanStats, updateAdminPlan, deleteAdminPlan,
} from '@/services/admin.service';
import {
  Button, EmptyState, ErrorState, PageHeader, Pagination, Pill, Segmented, Skeleton, StatTile,
  TableShell, useConfirm,
} from '@/components/ui';
import { formatINR, getErrorMessage } from '@/utils';
import PlanFormModal from './admin-subscription/plan-form-modal';

const VIEWS = [
  { value: 'live', label: 'Live plans' },
  { value: 'archived', label: 'Archived' },
];

const COLUMN_COUNT = 7;

/** What PayU would charge for this plan, in rupees (falls back to price − discount for legacy rows). */
const checkoutRupees = (p) =>
  Number.isFinite(p.amountMinor) ? p.amountMinor / 100 : Math.max(0, (Number(p.price) || 0) - (Number(p.directDiscount) || 0));

function PlanStatus({ plan }) {
  const purchasable = Number.isFinite(plan.amountMinor) && plan.amountMinor >= 100 && plan.credits >= 1;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {plan.isArchived ? (
        <Pill tone="outline" mono>Archived</Pill>
      ) : plan.isPublished ? (
        <Pill tone="ok" mono>Published</Pill>
      ) : (
        <Pill tone="stone" mono>Draft</Pill>
      )}
      {!plan.isArchived && !purchasable && (
        <Pill tone="coral" mono title="Checkout price below ₹1 or no credits — hidden from the pricing page">Not purchasable</Pill>
      )}
    </div>
  );
}

export default function AdminSubscriptionPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [view, setView] = useState('live');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const statsQuery = useQuery({
    queryKey: ['admin-plans', 'stats'],
    queryFn: getAdminPlanStats,
  });

  const plansQuery = useQuery({
    queryKey: ['admin-plans', 'list', { view, page }],
    queryFn: () => getAdminPlans(view === 'archived' ? { page, limit: 10, archived: 'true' } : { page, limit: 10 }),
    placeholderData: keepPreviousData,
  });

  const plans = plansQuery.data?.plans || [];
  const totalPages = plansQuery.data?.pages || 1;
  const totalItems = plansQuery.data?.total ?? 0;
  const stats = statsQuery.data;

  // If an archive/restore empties the current page, step back to the last page that has rows.
  useEffect(() => {
    if (plansQuery.data && !plansQuery.isFetching && page > 1 && page > (plansQuery.data.pages || 1)) {
      setPage(Math.max(1, plansQuery.data.pages || 1));
    }
  }, [plansQuery.data, plansQuery.isFetching, page]);

  const loadData = () => queryClient.invalidateQueries({ queryKey: ['admin-plans'] });

  const openCreate = () => { setSelectedPlan(null); setFormOpen(true); };
  const openEdit = (p) => { setSelectedPlan(p); setFormOpen(true); };

  const changeView = (v) => { setView(v); setPage(1); };

  const handleArchive = async (p) => {
    const ok = await confirm({
      title: `Archive “${p.name}”?`,
      description: 'Candidates who already bought this plan keep their access, but new buyers will no longer see it on the pricing page or be able to check out.',
      confirmLabel: 'Archive plan',
      tone: 'danger',
    });
    if (!ok) return;
    setBusyId(p._id);
    try {
      await deleteAdminPlan(p._id);
      toast.success('Plan archived. It is no longer visible to new buyers.');
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Couldn’t archive the plan.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleTogglePublish = async (p) => {
    setBusyId(p._id);
    try {
      await updateAdminPlan(p._id, { isPublished: !p.isPublished });
      toast.success(p.isPublished ? 'Plan unpublished — hidden from the pricing page.' : 'Plan published.');
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Couldn’t change the plan’s visibility.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (p) => {
    setBusyId(p._id);
    try {
      await updateAdminPlan(p._id, { isArchived: false });
      toast.success('Plan restored as a draft. Publish it when it’s ready.');
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Couldn’t restore the plan.'));
    } finally {
      setBusyId(null);
    }
  };

  const refreshing = (plansQuery.isFetching || statsQuery.isFetching) && !plansQuery.isLoading;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin · Billing"
        title="Subscription plans"
        description="Price and package the passes candidates buy through PayU. Amounts are in INR."
        actions={
          <>
            <Button variant="soft" icon={RefreshCw} onClick={loadData} loading={refreshing}>
              Refresh
            </Button>
            <Button variant="ink" icon={Plus} onClick={openCreate}>
              New plan
            </Button>
          </>
        }
      />

      {statsQuery.isError ? (
        <ErrorState
          compact
          title="Couldn’t load subscription statistics"
          description={getErrorMessage(statsQuery.error, 'The plans service did not respond.')}
          onRetry={statsQuery.refetch}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile tone="ink" icon={LayoutGrid} label="Live plans" value={stats?.totalPlans ?? 0} sub="Published and drafts" loading={statsQuery.isLoading} />
          <StatTile tone="lime" icon={CheckCircle2} label="Published" value={stats?.activePlans ?? 0} sub="Visible at checkout" loading={statsQuery.isLoading} />
          <StatTile icon={ShieldCheck} label="Premium candidates" value={stats?.premiumUsers ?? 0} sub="With an active paid pass" loading={statsQuery.isLoading} />
          <StatTile icon={Coins} label="Credits held" value={stats?.totalUserCredits ?? 0} sub="Across all user accounts" loading={statsQuery.isLoading} />
        </div>
      )}

      <section className="space-y-4" aria-labelledby="plans-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="plans-heading" className="text-[17px] font-medium tracking-tight1">Plans</h2>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-mono text-muted tabular">
              {plansQuery.isLoading ? 'Loading…' : `${totalItems} ${view === 'archived' ? 'archived' : 'live'} plan${totalItems === 1 ? '' : 's'} · sorted by price`}
            </p>
          </div>
          <Segmented ariaLabel="Plan list" size="sm" options={VIEWS} value={view} onChange={changeView} />
        </div>

        {plansQuery.isError ? (
          <ErrorState
            title="Couldn’t load subscription plans"
            description={getErrorMessage(plansQuery.error, 'Failed to load subscription plans.')}
            onRetry={plansQuery.refetch}
          />
        ) : plansQuery.isLoading ? (
          <TableShell minWidth={940}>
            <thead>
              <tr>{Array.from({ length: COLUMN_COUNT }).map((_, i) => <th key={i}><Skeleton className="h-3 w-16" /></th>)}</tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: COLUMN_COUNT }).map((__, j) => (
                    <td key={j}><Skeleton className="h-4 w-full max-w-[140px]" /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : plans.length === 0 ? (
          view === 'archived' ? (
            <EmptyState
              icon={Archive}
              title="No archived plans"
              description="Plans you archive are kept here so past purchases still resolve. You can restore them as drafts."
            />
          ) : (
            <EmptyState
              icon={Layers}
              title="No subscription plans yet"
              description="Create a plan to offer paid passes on the pricing page. Candidates pay the price after discount through PayU."
              action={<Button variant="ink" icon={Plus} onClick={openCreate}>New plan</Button>}
            />
          )
        ) : (
          <>
            <TableShell minWidth={940} className={plansQuery.isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th className="text-right">Checkout price</th>
                  <th className="text-right">Credits</th>
                  <th className="text-right">Validity</th>
                  <th>Promotion codes</th>
                  <th>Status</th>
                  <th className="relative text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const discount = Number(p.directDiscount) || 0;
                  const rowBusy = busyId === p._id;
                  const coupons = Array.isArray(p.coupons) ? p.coupons : [];
                  const featureCount = Array.isArray(p.features) ? p.features.length : 0;
                  return (
                    <tr key={p._id}>
                      <td className="max-w-[260px]">
                        <p className="truncate font-medium" title={p.name}>{p.name}</p>
                        <p className="mt-0.5 truncate font-mono text-[10.5px] uppercase tracking-mono text-muted">
                          {p.code || 'no code'} · {featureCount} feature{featureCount === 1 ? '' : 's'}
                        </p>
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <p className="whitespace-nowrap text-[15px] font-medium tabular">{formatINR(checkoutRupees(p))}</p>
                        {discount > 0 ? (
                          <p className="whitespace-nowrap text-[12px] text-muted tabular">
                            <span className="line-through">{formatINR(p.price)}</span>
                            <span className="ml-1.5 text-coral">−{formatINR(discount)}</span>
                          </p>
                        ) : (
                          <p className="whitespace-nowrap text-[12px] text-faint">No discount</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-right font-medium tabular">{p.credits ?? '—'}</td>
                      <td className="whitespace-nowrap text-right tabular">{p.durationDays ?? '—'} days</td>
                      <td>
                        {coupons.length > 0 ? (
                          <div className="flex max-w-[220px] flex-wrap gap-1">
                            {coupons.map((c) => (
                              <Pill key={c.code} tone={c.isActive === false ? 'outline' : 'lime'} mono title={c.isActive === false ? 'Inactive' : undefined}>
                                {c.code} −{c.discountPercent}%
                              </Pill>
                            ))}
                          </div>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td><PlanStatus plan={p} /></td>
                      <td className="whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1">
                          {p.isArchived ? (
                            <Button variant="soft" size="sm" icon={ArchiveRestore} loading={rowBusy} disabled={!!busyId} onClick={() => handleRestore(p)}>
                              Restore
                            </Button>
                          ) : (
                            <>
                              <Button variant="ghost" size="sm" iconOnly icon={Pencil} aria-label={`Edit ${p.name}`} title="Edit plan" disabled={!!busyId} onClick={() => openEdit(p)} />
                              <Button
                                variant="ghost"
                                size="sm"
                                iconOnly
                                icon={p.isPublished ? EyeOff : Eye}
                                aria-label={p.isPublished ? `Unpublish ${p.name}` : `Publish ${p.name}`}
                                title={p.isPublished ? 'Unpublish' : 'Publish'}
                                loading={rowBusy}
                                disabled={!!busyId}
                                onClick={() => handleTogglePublish(p)}
                              />
                              <Button variant="ghost" size="sm" iconOnly icon={Archive} aria-label={`Archive ${p.name}`} title="Archive plan" disabled={!!busyId} onClick={() => handleArchive(p)} className="hover:bg-coral-soft hover:text-coral" />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} disabled={plansQuery.isFetching} />
          </>
        )}
      </section>

      {formOpen && (
        <PlanFormModal
          plan={selectedPlan}
          onSaved={loadData}
          onClose={() => { setFormOpen(false); setSelectedPlan(null); }}
        />
      )}
    </div>
  );
}
