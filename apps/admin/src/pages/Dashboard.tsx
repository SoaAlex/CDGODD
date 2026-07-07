import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TableCellsIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  FlagIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { apiGet, imageUrl } from '../lib/api';
import type { AdminItem, AdminReport, ItemStatus, Stats } from '../types';

const STATUS_STYLES: Record<ItemStatus, string> = {
  approved: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  rejected: 'bg-red-100 text-red-800',
};

function StatusBadge({ status }: { status: ItemStatus }) {
  return (
    <span
      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export function Dashboard() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pending, setPending] = useState<AdminItem[]>([]);
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [reportsCount, setReportsCount] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [statsRes, pendingRes, approvedRes, rejectedRes, reportsRes] =
          await Promise.all([
            apiGet<{ totals: Stats }>('/admin/stats', token),
            apiGet<{ items: AdminItem[] }>('/admin/items?status=pending', token),
            apiGet<{ items: AdminItem[] }>('/admin/items?status=approved', token),
            apiGet<{ items: AdminItem[] }>('/admin/items?status=rejected', token),
            apiGet<{ reports: AdminReport[] }>('/admin/reports', token),
          ]);
        if (!alive) return;
        setStats(statsRes.totals);
        setPending(pendingRes.items);
        setApprovedCount(approvedRes.items.length);
        setRejectedCount(rejectedRes.items.length);
        setReportsCount(reportsRes.reports.length);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const cards = [
    { label: 'Items approuvés', value: stats?.items ?? approvedCount, icon: TableCellsIcon, color: 'text-gray-400' },
    { label: 'En attente', value: pending.length, icon: ClockIcon, color: 'text-yellow-400' },
    { label: 'Approuvés', value: approvedCount, icon: CheckCircleIcon, color: 'text-green-400' },
    { label: 'Rejetés', value: rejectedCount, icon: XCircleIcon, color: 'text-red-400' },
    { label: 'Signalements', value: reportsCount, icon: FlagIcon, color: 'text-orange-400' },
  ];

  const quickActions = [
    { name: 'Créer un item', description: 'Ajouter un item avec image', href: '/add-item', icon: PlusIcon, color: 'bg-blue-500' },
    { name: 'Modération', description: 'Traiter la file d’attente', href: '/items', icon: TableCellsIcon, color: 'bg-purple-500' },
    { name: 'Signalements', description: 'Voir les items signalés', href: '/reports', icon: FlagIcon, color: 'bg-orange-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gérez les items du jeu « C&apos;est de gauche ou de droite ? »
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <c.icon className={`h-6 w-6 ${c.color}`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">{c.label}</p>
                <p className="text-2xl font-semibold text-gray-900">{c.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">Actions rapides</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.name}
              to={action.href}
              className="card hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-center">
                <div className={`flex-shrink-0 p-2 rounded-lg ${action.color}`}>
                  <action.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">{action.name}</p>
                  <p className="text-sm text-gray-500">{action.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Pending queue */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          File de modération
        </h2>
        <div className="card">
          <div className="overflow-hidden">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Image</th>
                  <th className="table-header-cell">Label</th>
                  <th className="table-header-cell">Statut</th>
                  <th className="table-header-cell">Gauche</th>
                  <th className="table-header-cell">Droite</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {pending.slice(0, 5).map((it) => (
                  <tr key={it.id}>
                    <td className="table-cell">
                      {it.image_key ? (
                        <img
                          src={imageUrl(it.image_key)}
                          alt=""
                          className="h-10 w-10 object-cover rounded"
                        />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="table-cell">{it.label ?? 'Sans label'}</td>
                    <td className="table-cell">
                      <StatusBadge status={it.status} />
                    </td>
                    <td className="table-cell">{it.votes_left}</td>
                    <td className="table-cell">{it.votes_right}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pending.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">Aucun item en attente. </p>
            </div>
          )}
          {pending.length > 5 && (
            <div className="px-6 py-3 border-t border-gray-200">
              <Link to="/items" className="text-sm text-blue-600 hover:text-blue-500">
                Voir toute la file →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
