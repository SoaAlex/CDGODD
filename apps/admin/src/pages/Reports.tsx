import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiGet } from '../lib/api';
import type { AdminReport, ItemStatus } from '../types';

const STATUS_STYLES: Record<ItemStatus, string> = {
  approved: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  rejected: 'bg-red-100 text-red-800',
};

export function Reports() {
  const { token } = useAuth();
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await apiGet<{ reports: AdminReport[] }>(
          '/admin/reports',
          token,
        );
        if (alive) setReports(data.reports);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Signalements</h1>
          <p className="mt-1 text-sm text-gray-500">
            Items signalés, les plus signalés en premier
          </p>
        </div>
        <div className="text-sm text-gray-500">{reports.length} signalements</div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Item</th>
                <th className="table-header-cell">Raison</th>
                <th className="table-header-cell">Total</th>
                <th className="table-header-cell">Statut item</th>
                <th className="table-header-cell">Date</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {reports.map((r) => (
                <tr key={r.id}>
                  <td className="table-cell">{r.label ?? `#${r.item_id}`}</td>
                  <td className="table-cell">
                    {r.reason ?? (
                      <span className="text-gray-400">Sans raison</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                      {r.report_count}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_STYLES[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="table-cell">
                    {new Date(r.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && reports.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucun signalement. </p>
          </div>
        )}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}
      </div>
    </div>
  );
}
