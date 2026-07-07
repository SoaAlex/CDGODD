import { useCallback, useEffect, useState } from 'react';

// Prod builds point straight at the API worker; dev uses the Vite proxy.
const API = import.meta.env.VITE_API_URL ?? '/api';

interface AdminItem {
  id: number;
  label: string | null;
  status: string;
  image_key: string | null;
  votes_left: number;
  votes_right: number;
  report_count: number;
}

interface AdminReport {
  id: number;
  item_id: number;
  label: string | null;
  reason: string | null;
  status: string;
  report_count: number;
  created_at: number;
}

interface Category {
  key: string;
  name: string;
}

/** v1 admin auth: bearer token pasted once, kept in sessionStorage. */
function useToken() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem('admin_token') ?? '',
  );
  const save = (t: string) => {
    sessionStorage.setItem('admin_token', t);
    setToken(t);
  };
  return { token, save };
}

function ItemsTab({ headers }: { headers: Record<string, string> }) {
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState<AdminItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`${API}/admin/items?status=${status}`, { headers });
    if (!res.ok) {
      setError(`API ${res.status}`);
      return;
    }
    const data = (await res.json()) as { items: AdminItem[] };
    setItems(data.items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, headers.authorization]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setItemStatus(id: number, next: string) {
    await fetch(`${API}/admin/items/${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    void load();
  }

  return (
    <>
      <div style={{ margin: '1rem 0' }}>
        {['pending', 'approved', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            style={{ fontWeight: s === status ? 'bold' : 'normal', marginRight: 8 }}
          >
            {s}
          </button>
        ))}
      </div>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <table width="100%" cellPadding={6}>
        <thead>
          <tr>
            <th align="left">Label</th>
            <th>Image</th>
            <th>Gauche</th>
            <th>Droite</th>
            <th>Reports</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td>{it.label ?? <em>(no label)</em>}</td>
              <td align="center">
                {it.image_key ? (
                  <img
                    src={`${API}/img/${it.image_key}`}
                    alt=""
                    style={{ height: 40, borderRadius: 4 }}
                  />
                ) : (
                  '—'
                )}
              </td>
              <td align="center">{it.votes_left}</td>
              <td align="center">{it.votes_right}</td>
              <td align="center">{it.report_count}</td>
              <td align="center">
                <button onClick={() => setItemStatus(it.id, 'approved')}>✓</button>{' '}
                <button onClick={() => setItemStatus(it.id, 'rejected')}>✗</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function CreateTab({ headers }: { headers: Record<string, string> }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/categories?lang=fr`)
      .then((r) => r.json())
      .then((d: { categories: Category[] }) => setCategories(d.categories))
      .catch(() => setCategories([]));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setMessage(null);
    const res = await fetch(`${API}/admin/items`, {
      method: 'POST',
      headers,
      body: new FormData(form),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (data.ok) {
      setMessage('Item créé ✓');
      form.reset();
    } else {
      setMessage(`Erreur: ${data.error ?? res.status}`);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: 'grid', gap: 12, maxWidth: 420, marginTop: '1rem' }}
    >
      <label>
        Label (fr)
        <br />
        <input name="label" required maxLength={80} style={{ width: '100%' }} />
      </label>
      <label>
        Catégorie
        <br />
        <select name="categoryKey" style={{ width: '100%' }}>
          <option value="">(aucune)</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Image
        <br />
        <input name="image" type="file" accept="image/*" />
      </label>
      <button type="submit">Créer (publié directement)</button>
      {message && <p>{message}</p>}
    </form>
  );
}

function ReportsTab({ headers }: { headers: Record<string, string> }) {
  const [reports, setReports] = useState<AdminReport[]>([]);

  useEffect(() => {
    fetch(`${API}/admin/reports`, { headers })
      .then((r) => r.json())
      .then((d: { reports: AdminReport[] }) => setReports(d.reports))
      .catch(() => setReports([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers.authorization]);

  return (
    <table width="100%" cellPadding={6} style={{ marginTop: '1rem' }}>
      <thead>
        <tr>
          <th align="left">Item</th>
          <th align="left">Raison</th>
          <th>Total reports</th>
          <th>Statut item</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {reports.map((r) => (
          <tr key={r.id}>
            <td>{r.label ?? `#${r.item_id}`}</td>
            <td>{r.reason ?? <em>(sans raison)</em>}</td>
            <td align="center">{r.report_count}</td>
            <td align="center">{r.status}</td>
            <td align="center">
              {new Date(r.created_at).toLocaleDateString('fr-FR')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function App() {
  const { token, save } = useToken();
  const [tab, setTab] = useState<'items' | 'create' | 'reports'>('items');
  const headers = { authorization: `Bearer ${token}` };

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 860, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>CDGODD Admin</h1>

      <label>
        Admin token{' '}
        <input
          type="password"
          value={token}
          onChange={(e) => save(e.target.value)}
          placeholder="Bearer token"
        />
      </label>

      <nav style={{ margin: '1.5rem 0', display: 'flex', gap: 8 }}>
        {(
          [
            ['items', 'Modération'],
            ['create', 'Créer un item'],
            ['reports', 'Signalements'],
          ] as const
        ).map(([key, name]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{ fontWeight: tab === key ? 'bold' : 'normal' }}
          >
            {name}
          </button>
        ))}
      </nav>

      {tab === 'items' && <ItemsTab headers={headers} />}
      {tab === 'create' && <CreateTab headers={headers} />}
      {tab === 'reports' && <ReportsTab headers={headers} />}
    </main>
  );
}
