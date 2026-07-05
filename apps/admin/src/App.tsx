import { useEffect, useState } from 'react';

interface AdminItem {
  id: number;
  label: string | null;
  status: string;
  votes_left: number;
  votes_right: number;
  report_count: number;
}

const API = '/api';

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

export default function App() {
  const { token, save } = useToken();
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState<AdminItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const headers = { authorization: `Bearer ${token}` };

  async function load() {
    setError(null);
    const res = await fetch(`${API}/admin/items?status=${status}`, { headers });
    if (!res.ok) {
      setError(`API ${res.status}`);
      return;
    }
    const data = (await res.json()) as { items: AdminItem[] };
    setItems(data.items);
  }

  async function setItemStatus(id: number, next: string) {
    await fetch(`${API}/admin/items/${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    void load();
  }

  useEffect(() => {
    if (token) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status]);

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 800, margin: '2rem auto' }}>
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
              <td align="center">{it.votes_left}</td>
              <td align="center">{it.votes_right}</td>
              <td align="center">{it.report_count}</td>
              <td align="center">
                <button onClick={() => setItemStatus(it.id, 'approved')}>
                  ✓
                </button>{' '}
                <button onClick={() => setItemStatus(it.id, 'rejected')}>
                  ✗
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
