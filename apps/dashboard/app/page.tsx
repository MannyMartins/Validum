'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type Case = {
  id: string;
  reference: string;
  status: string;
  epsName: string | null;
  contact: { displayName: string | null; whatsappId: string };
  documents: unknown[];
};

const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const tokenKey = 'validum-dashboard-access-token';

export default function Page() {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCases = useCallback(async (accessToken: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/cases`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (response.status === 401) {
        sessionStorage.removeItem(tokenKey);
        setToken('');
        setCases([]);
        setError('La sesión expiró. Inicia sesión nuevamente.');
        return;
      }
      if (!response.ok) throw new Error(`API respondió ${response.status}`);
      setCases((await response.json()) as Case[]);
    } catch (requestError) {
      console.error(requestError);
      setError('No fue posible consultar la API. Revisa su URL y estado en Railway.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedToken = sessionStorage.getItem(tokenKey) || '';
    setToken(savedToken);
    if (savedToken) void loadCases(savedToken);
    else setLoading(false);
  }, [loadCases]);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!response.ok) {
        setError(response.status === 401 ? 'Correo o contraseña incorrectos.' : 'No fue posible iniciar sesión.');
        return;
      }
      const data = (await response.json()) as { accessToken?: string };
      if (!data.accessToken) throw new Error('La API no devolvió un token de acceso');
      sessionStorage.setItem(tokenKey, data.accessToken);
      setToken(data.accessToken);
      setPassword('');
      await loadCases(data.accessToken);
    } catch (requestError) {
      console.error(requestError);
      setError('No fue posible conectar con la API.');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem(tokenKey);
    setToken('');
    setCases([]);
    setError('');
  };

  if (!token) {
    return (
      <main style={{ maxWidth: 420, margin: '10vh auto' }}>
        <h1>Panel de casos</h1>
        <p>Inicia sesión con el usuario administrativo de la API.</p>
        <form onSubmit={login} style={{ display: 'grid', gap: 12 }}>
          <label>
            Correo
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} style={{ display: 'block', width: '100%', padding: 10, marginTop: 4 }} />
          </label>
          <label>
            Contraseña
            <input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} style={{ display: 'block', width: '100%', padding: 10, marginTop: 4 }} />
          </label>
          <button type="submit" disabled={loading} style={{ padding: 12 }}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
        {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      </main>
    );
  }

  return (
    <main>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1>Formularios EPS</h1>
          <p>Casos recibidos por WhatsApp.</p>
        </div>
        <button type="button" onClick={logout}>Cerrar sesión</button>
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      {loading ? <p>Cargando casos…</p> : (
        <>
          <table cellPadding="10">
            <thead><tr><th>Referencia</th><th>Contacto</th><th>EPS</th><th>Estado</th><th>Documentos</th></tr></thead>
            <tbody>{cases.map((item) => (
              <tr key={item.id}>
                <td>{item.reference}</td>
                <td>{item.contact.displayName || item.contact.whatsappId}</td>
                <td>{item.epsName || 'Por identificar'}</td>
                <td>{item.status}</td>
                <td>{item.documents.length}</td>
              </tr>
            ))}</tbody>
          </table>
          {!cases.length && <p>Aún no hay casos recibidos.</p>}
        </>
      )}
    </main>
  );
}
