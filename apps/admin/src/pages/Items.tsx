import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { API, apiGet, authHeaders, imageUrl } from '../lib/api';
import type { AdminItem, ItemStatus } from '../types';

const TABS: ItemStatus[] = ['pending', 'approved', 'rejected'];
const TAB_LABELS: Record<ItemStatus, string> = {
  pending: 'En attente',
  approved: 'Approuvés',
  rejected: 'Rejetés',
};
const STATUS_STYLES: Record<ItemStatus, string> = {
  approved: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  rejected: 'bg-red-100 text-red-800',
};

export function Items() {
  const { token } = useAuth();
  const [status, setStatus] = useState<ItemStatus>('pending');
  const [items, setItems] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ items: AdminItem[] }>(
        `/admin/items?status=${status}`,
        token,
      );
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [status, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setItemStatus(id: number, next: ItemStatus) {
    await fetch(`${API}/admin/items/${id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    void load();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modération</h1>
          <p className="mt-1 text-sm text-gray-500">
            Approuver ou rejeter les items du jeu
          </p>
        </div>
        <div className="text-sm text-gray-500">{items.length} items</div>
      </div>

      {/* Status tabs */}
      <div className="card">
        <div className="flex gap-2">
          {TABS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                s === status
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {TAB_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="card">
          <p className="text-red-600">Erreur : {error}</p>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Image</th>
                <th className="table-header-cell">Label</th>
                <th className="table-header-cell">Statut</th>
                <th className="table-header-cell">Gauche</th>
                <th className="table-header-cell">Droite</th>
                <th className="table-header-cell">Signalements</th>
                <th className="table-header-cell">Actions</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {items.map((it) => (
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
                  <td className="table-cell">
                    {it.label ?? (
                      <span className="text-gray-400">Sans label</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_STYLES[it.status]}`}
                    >
                      {it.status}
                    </span>
                  </td>
                  <td className="table-cell">{it.votes_left}</td>
                  <td className="table-cell">{it.votes_right}</td>
                  <td className="table-cell">
                    {it.report_count > 0 ? (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        {it.report_count}
                      </span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center space-x-2">
                      {it.status !== 'approved' && (
                        <button
                          onClick={() => setItemStatus(it.id, 'approved')}
                          className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 p-1 rounded transition-colors"
                          title="Approuver"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                        </button>
                      )}
                      {it.status !== 'rejected' && (
                        <button
                          onClick={() => setItemStatus(it.id, 'rejected')}
                          className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-1 rounded transition-colors"
                          title="Rejeter"
                        >
                          <XCircleIcon className="h-4 w-4" />
                        </button>
                      )}
                      {it.status !== 'pending' && (
                        <button
                          onClick={() => setItemStatus(it.id, 'pending')}
                          className="text-gray-500 hover:text-gray-800 transition-colors"
                          title="Remettre en attente"
                        >
                          <ArrowUturnLeftIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && items.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucun item dans cette catégorie.</p>
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
