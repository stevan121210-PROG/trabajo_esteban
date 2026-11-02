import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const emptyPerson = { name: "", age: "", sex: "", email: "", phone: "" };
const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const publicDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
const demoStorageKey = "cmd-public-demo-v1";

function readDemoData() {
  let serialized;
  try {
    serialized = window.localStorage.getItem(demoStorageKey);
  } catch {
    throw new Error("El navegador no permite acceder al almacenamiento local.");
  }
  if (!serialized) return { people: [], payments: [] };
  try {
    const data = JSON.parse(serialized);
    if (!Array.isArray(data.people) || !Array.isArray(data.payments)) throw new Error();
    return data;
  } catch {
    throw new Error("Los datos guardados de esta demo no se pueden leer. No se modificaron.");
  }
}

function writeDemoData(data) {
  try {
    window.localStorage.setItem(demoStorageKey, JSON.stringify(data));
  } catch {
    throw new Error("No se pudieron guardar los datos en este navegador. Comprueba el espacio disponible.");
  }
}

function demoApi(url, options) {
  const method = options.method || "GET";
  const data = readDemoData();
  const body = options.body ? JSON.parse(options.body) : {};
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  if (url === "/api/setup-status") return { needsSetup: false };
  if (url === "/api/session") return { admin: { username: "Demo pública" } };
  if (url === "/api/logout") return null;
  if (url === "/api/people" && method === "GET") return data.people;
  if (url === "/api/people" && method === "POST") {
    const person = { ...body, id: Math.max(0, ...data.people.map((item) => item.id)) + 1, created_at: now };
    data.people.unshift(person);
    writeDemoData(data);
    return person;
  }
  const personRoute = url.match(/^\/api\/people\/(\d+)$/);
  if (personRoute) {
    const id = Number(personRoute[1]);
    const index = data.people.findIndex((person) => person.id === id);
    if (index < 0) throw new Error("No se encontró la persona.");
    if (method === "PUT") {
      data.people[index] = { ...data.people[index], ...body, id };
      writeDemoData(data);
      return data.people[index];
    }
    if (method === "DELETE") {
      data.people.splice(index, 1);
      data.payments = data.payments.map((payment) => payment.personId === id ? { ...payment, personId: null } : payment);
      writeDemoData(data);
      return null;
    }
  }
  if (url === "/api/payments" && method === "GET") {
    return data.payments.map((payment) => ({
      ...payment,
      personName: data.people.find((person) => person.id === payment.personId)?.name || null,
    }));
  }
  if (url === "/api/payments" && method === "POST") {
    const personId = body.personId ? Number(body.personId) : null;
    const amount = Number(body.amount);
    if (personId !== null && !data.people.some((person) => person.id === personId)) {
      throw new Error("Selecciona una persona válida.");
    }
    if (!body.description?.trim() || !Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      throw new Error("Escribe una descripción y un importe válido.");
    }
    const payment = {
      id: Math.max(0, ...data.payments.map((item) => item.id)) + 1,
      personId,
      description: body.description.trim(),
      amountCents: Math.round(amount * 100),
      status: "completed",
      createdAt: now,
    };
    data.payments.unshift(payment);
    writeDemoData(data);
    return payment;
  }
  throw new Error("Esta operación no está disponible en la demo pública.");
}

async function api(url, options = {}) {
  if (publicDemoMode) return demoApi(url, options);
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Ocurrió un error inesperado.");
  return data;
}

function Icon({ name }) {
  const shared = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  if (name === "people") return <svg {...shared}><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  if (name === "payment") return <svg {...shared}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18m-14 5h4" /></svg>;
  if (name === "plus") return <svg {...shared}><path d="M12 5v14m-7-7h14" /></svg>;
  if (name === "edit") return <svg {...shared}><path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z" /></svg>;
  if (name === "delete") return <svg {...shared}><path d="M3 6h18m-2 0-.9 14H5.9L5 6m4 0V4h6v2m-5 4v6m4-6v6" /></svg>;
  if (name === "logout") return <svg {...shared}><path d="M10 17l5-5-5-5m5 5H3m9-9h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></svg>;
  return <svg {...shared}><path d="M12 3 2 20h20L12 3z" /><path d="M12 9v4m0 3h.01" /></svg>;
}

function AuthScreen({ needsSetup, onAuthenticated }) {
  const [form, setForm] = useState({ username: "", password: "", confirmation: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (needsSetup && form.password !== form.confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const { confirmation: _confirmation, ...credentials } = form;
      const admin = await api(needsSetup ? "/api/setup" : "/api/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      onAuthenticated(admin);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">&gt;_</div>
        <p className="eyebrow">CMD · ADMINISTRACIÓN LOCAL</p>
        <h1>{needsSetup ? "Inicializar sistema" : "Iniciar sesión"}</h1>
        <p className="muted">{needsSetup ? "Crea las credenciales de administrador para proteger tus datos." : "Acceso al directorio y al registro de pagos de demostración."}</p>
        <form onSubmit={submit} className="stack-form">
          <label>Usuario<input autoComplete="username" required minLength={3} maxLength={30} value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
          <label>Contraseña<input autoComplete={needsSetup ? "new-password" : "current-password"} type="password" required minLength={needsSetup ? 10 : 1} maxLength={128} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          {needsSetup && <label>Confirmar contraseña<input autoComplete="new-password" type="password" required value={form.confirmation} onChange={(event) => setForm({ ...form, confirmation: event.target.value })} /></label>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button primary full-width" disabled={busy}>{busy ? "Un momento..." : needsSetup ? "Crear cuenta de administrador" : "Entrar al panel"}</button>
        </form>
        <p className="auth-footnote"><span className="status-dot" /> Base de datos SQLite guardada en este dispositivo.</p>
      </section>
    </main>
  );
}

function PersonForm({ initialValue, onSave, onCancel }) {
  const [form, setForm] = useState(initialValue || emptyPerson);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSave({ ...form, age: Number(form.age) });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="person-form" onSubmit={submit}>
      <div className="form-grid">
        <label>Nombre completo<input autoFocus required maxLength={100} placeholder="Ej. Alex Rivera" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>Edad<input required type="number" min="0" max="150" placeholder="28" value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} /></label>
        <label>Sexo<select required value={form.sex} onChange={(event) => setForm({ ...form, sex: event.target.value })}><option value="">Selecciona una opción</option><option>Femenino</option><option>Masculino</option><option>Otro</option><option>Prefiero no decir</option></select></label>
        <label>Correo electrónico<input required type="email" maxLength={254} placeholder="alex@correo.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label className="span-two">Número de teléfono<input required type="tel" minLength={7} maxLength={25} placeholder="+52 55 1234 5678" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" className="button secondary" onClick={onCancel}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? "Guardando..." : "Guardar persona"}</button></div>
    </form>
  );
}

function App() {
  const [boot, setBoot] = useState({ loading: true, needsSetup: false, admin: null, error: null });
  const [people, setPeople] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activeTab, setActiveTab] = useState("people");
  const [query, setQuery] = useState("");
  const searchInput = useRef(null);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");
  const [paymentForm, setPaymentForm] = useState({ personId: "", description: "", amount: "" });
  const [paymentError, setPaymentError] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);

  const loadData = useCallback(async () => {
    const [nextPeople, nextPayments] = await Promise.all([api("/api/people"), api("/api/payments")]);
    setPeople(nextPeople);
    setPayments(nextPayments);
  }, []);

  useEffect(() => {
    let active = true;
    if (publicDemoMode) {
      setBoot({ loading: false, needsSetup: false, admin: { username: "Demo pública" }, error: null });
      return () => { active = false; };
    }
    Promise.all([api("/api/setup-status"), api("/api/session")])
      .then(([setup, session]) => {
        if (active) setBoot({ loading: false, needsSetup: setup.needsSetup, admin: session.admin, error: null });
      })
      .catch((error) => { if (active) setBoot({ loading: false, needsSetup: false, admin: null, error: error.message }); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!boot.admin) return;
    loadData().catch((error) => setNotice(error.message));
  }, [boot.admin, loadData]);

  useEffect(() => {
    function focusSearch(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const filteredPeople = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    if (!normalized) return people;
    return people.filter((person) => [person.name, person.email, person.phone, person.sex].some((value) => value.toLocaleLowerCase("es").includes(normalized)));
  }, [people, query]);
  const totalPaid = payments.reduce((total, payment) => total + payment.amountCents, 0);

  async function savePerson(person) {
    const isEditing = Boolean(editing);
    await api(isEditing ? `/api/people/${editing.id}` : "/api/people", {
      method: isEditing ? "PUT" : "POST",
      body: JSON.stringify(person),
    });
    setEditing(null);
    setAdding(false);
    setNotice(isEditing ? "Los datos se actualizaron correctamente." : "La persona se agregó correctamente.");
    await loadData();
  }

  async function deletePerson(person) {
    if (!window.confirm(`¿Eliminar a ${person.name}? Sus pagos se conservarán sin persona asociada.`)) return;
    try {
      await api(`/api/people/${person.id}`, { method: "DELETE" });
      setNotice("Persona eliminada. El historial de pagos se conservó.");
      await loadData();
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function createPayment(event) {
    event.preventDefault();
    setPaymentError("");
    setPaymentBusy(true);
    try {
      await api("/api/payments", {
        method: "POST",
        body: JSON.stringify({ ...paymentForm, personId: paymentForm.personId || null, amount: Number(paymentForm.amount) }),
      });
      setPaymentForm({ personId: "", description: "", amount: "" });
      setNotice("Pago de demostración registrado correctamente.");
      await loadData();
    } catch (error) {
      setPaymentError(error.message);
    } finally {
      setPaymentBusy(false);
    }
  }

  async function logout() {
    if (publicDemoMode) return;
    try {
      await api("/api/logout", { method: "POST" });
      setBoot((current) => ({ ...current, admin: null }));
      setPeople([]);
      setPayments([]);
    } catch (error) {
      setNotice(error.message);
    }
  }

  if (boot.loading) return <main className="loading-screen"><span className="status-dot" /> Iniciando panel local...</main>;
  if (boot.error) return <main className="auth-page"><section className="auth-card"><div className="brand-mark">&gt;_</div><p className="eyebrow">CMD · ADMINISTRACIÓN LOCAL</p><h1>Servidor no disponible</h1><p className="muted">{boot.error} Comprueba que el servidor esté activo y vuelve a intentarlo.</p><button className="button primary full-width" onClick={() => window.location.reload()}>Volver a intentar</button></section></main>;
  if (!boot.admin) return <AuthScreen needsSetup={boot.needsSetup} onAuthenticated={(admin) => setBoot((current) => ({ ...current, admin, needsSetup: false }))} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => event.preventDefault()}><span className="brand-mark small">&gt;_</span><span>cmd<span className="brand-period">.</span><small>{publicDemoMode ? "DEMO PÚBLICA" : "PANEL LOCAL"}</small></span></a>
        <p className="side-label">ESPACIO DE TRABAJO</p>
        <nav className="side-nav" aria-label="Secciones">
          <button className={activeTab === "people" ? "nav-item active" : "nav-item"} onClick={() => setActiveTab("people")}><Icon name="people" /> Personas <span className="nav-count">{people.length}</span></button>
          <button className={activeTab === "payments" ? "nav-item active" : "nav-item"} onClick={() => setActiveTab("payments")}><Icon name="payment" /> Pagos</button>
        </nav>
        <div className="sidebar-bottom"><span className="secure-badge"><span className="status-dot" /> {publicDemoMode ? "Almacenamiento del navegador" : "SQLite local"}</span><div className="admin-info"><span className="avatar">{boot.admin.username.slice(0, 1).toUpperCase()}</span><div><strong>{boot.admin.username}</strong><small>{publicDemoMode ? "Sin inicio de sesión" : "Administrador"}</small></div>{!publicDemoMode && <button className="icon-button logout-button" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={logout}><Icon name="logout" /></button>}</div></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><span><span className="breadcrumb-muted">Workspace</span><span className="breadcrumb-divider">/</span>{activeTab === "people" ? "Personas" : "Pagos"}</span><span className="live-indicator"><span className="status-dot" /> {publicDemoMode ? "DEMO PÚBLICA" : "SISTEMA EN LÍNEA"}</span></header>
        <div className="page-content">
          {publicDemoMode && <div className="public-demo-warning" role="note"><strong>DEMO PÚBLICA · SIN PROTECCIÓN</strong><span>No introduzcas nombres, teléfonos, correos ni ningún dato real. Los registros se guardan en este navegador y no son privados.</span></div>}
          <div className="page-heading"><div><p className="eyebrow">PANEL DE CONTROL <span className="green-slash">//</span> {activeTab === "people" ? "DIRECTORIO" : "TRANSACCIONES"}</p><h1>{activeTab === "people" ? "Personas" : "Pagos"}</h1><p className="muted">{activeTab === "people" ? publicDemoMode ? "Prueba el directorio usando solo datos ficticios." : "Administra la información de tus registros." : publicDemoMode ? "Prueba registros de pago ficticios; no se realizan cobros." : "Consulta y registra pagos simulados de forma local."}</p></div>{activeTab === "people" && <button className="button primary add-button" onClick={() => { setAdding(true); setEditing(null); }}><Icon name="plus" /> Agregar persona</button>}</div>

          <section className="stats-grid" aria-label="Resumen">
            <article className="stat-card"><div className="stat-label"><span>PERSONAS REGISTRADAS</span><Icon name="people" /></div><div className="stat-value">{people.length}</div><div className="stat-note">{publicDemoMode ? "En este navegador solamente" : "En tu base de datos local"}</div></article>
            <article className="stat-card"><div className="stat-label"><span>PAGOS REGISTRADOS</span><Icon name="payment" /></div><div className="stat-value">{payments.length}</div><div className="stat-note">Transacciones de demostración</div></article>
            <article className="stat-card"><div className="stat-label"><span>IMPORTE REGISTRADO</span><span className="currency-sign">$</span></div><div className="stat-value">{currency.format(totalPaid / 100)}</div><div className="stat-note">Suma de pagos simulados · MXN</div></article>
          </section>

          {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Cerrar aviso" onClick={() => setNotice("")}>×</button></div>}

          {activeTab === "people" ? (
            <section className="panel">
              <div className="panel-toolbar"><div><h2>Directorio de personas</h2><p>{people.length} {people.length === 1 ? "registro" : "registros"} en total</p></div><label className="search-field"><span aria-hidden="true">⌕</span><input ref={searchInput} aria-label="Buscar personas" placeholder="Buscar por nombre, correo..." value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></label></div>
              {(adding || editing) && <div className="editor-panel"><div className="editor-heading"><div><span className="terminal-prompt">root@cmd:~$</span><h3>{editing ? "Editar registro" : "Nuevo registro"}</h3></div><button className="icon-button" aria-label="Cerrar formulario" onClick={() => { setAdding(false); setEditing(null); }}>×</button></div><PersonForm key={editing?.id || "new"} initialValue={editing || undefined} onSave={savePerson} onCancel={() => { setAdding(false); setEditing(null); }} /></div>}
              <div className="table-scroll"><table><thead><tr><th>PERSONA</th><th>EDAD / SEXO</th><th>TELÉFONO</th><th>CONTACTO</th><th className="actions-heading">ACCIONES</th></tr></thead><tbody>
                {filteredPeople.map((person) => <tr key={person.id}><td><div className="person-cell"><span className="person-avatar">{person.name.trim().slice(0, 1).toUpperCase()}</span><div><strong>{person.name}</strong><small>#{String(person.id).padStart(4, "0")}</small></div></div></td><td><span>{person.age} años</span><small className="cell-subtext">{person.sex}</small></td><td>{person.phone}</td><td><a className="email-link" href={`mailto:${person.email}`}>{person.email}</a></td><td><div className="row-actions"><button className="icon-button" title="Editar" aria-label={`Editar ${person.name}`} onClick={() => { setEditing(person); setAdding(false); }}><Icon name="edit" /></button><button className="icon-button danger-hover" title="Eliminar" aria-label={`Eliminar ${person.name}`} onClick={() => deletePerson(person)}><Icon name="delete" /></button></div></td></tr>)}
                {!filteredPeople.length && <tr><td colSpan="5"><div className="empty-state"><span className="empty-icon"><Icon name="people" /></span><strong>{query ? "No hay resultados" : "Tu directorio está listo"}</strong><p>{query ? "Prueba con otro término de búsqueda." : "Agrega una persona para comenzar a organizar tus registros."}</p>{!query && <button className="button secondary" onClick={() => setAdding(true)}><Icon name="plus" /> Agregar primer registro</button>}</div></td></tr>}
              </tbody></table></div>
              <div className="table-footer"><span>{publicDemoMode ? "Almacenamiento del navegador // No es privado" : "Base de datos local // Solo visible para tu cuenta"}</span><span>{filteredPeople.length} resultado{filteredPeople.length === 1 ? "" : "s"}</span></div>
            </section>
          ) : (
            <section className="payments-layout">
              <div className="panel payment-form-panel"><div className="panel-toolbar"><div><h2>Nuevo pago de demostración</h2><p>No se realizan cobros reales.</p></div><span className="demo-badge">MODO DEMO</span></div><form onSubmit={createPayment} className="stack-form payment-form">
                <label>Persona asociada <span className="optional-label">OPCIONAL</span><select value={paymentForm.personId} onChange={(event) => setPaymentForm({ ...paymentForm, personId: event.target.value })}><option value="">Sin asociar</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
                <label>Descripción<input required maxLength={120} placeholder="Ej. Membresía mensual" value={paymentForm.description} onChange={(event) => setPaymentForm({ ...paymentForm, description: event.target.value })} /></label>
                <label>Importe (MXN)<div className="amount-input"><span>$</span><input required type="number" min="0.01" max="100000" step="0.01" placeholder="0.00" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} /><span>MXN</span></div></label>
                <div className="demo-explanation"><span className="demo-shield">✓</span><p>Esto solo guarda un registro de prueba en tu base de datos. No conecta con un banco ni solicita datos de tarjeta.</p></div>
                {paymentError && <p className="form-error" role="alert">{paymentError}</p>}
                <button className="button primary full-width" disabled={paymentBusy}>{paymentBusy ? "Registrando..." : "Simular pago exitoso"}</button>
              </form></div>
              <div className="panel history-panel"><div className="panel-toolbar"><div><h2>Historial de pagos</h2><p>{payments.length} {payments.length === 1 ? "transacción" : "transacciones"}</p></div></div>
                {payments.length ? <div className="payment-list">{payments.map((payment) => <article className="payment-row" key={payment.id}><div className="payment-icon"><Icon name="payment" /></div><div className="payment-description"><strong>{payment.description}</strong><small>{payment.personName || "Sin persona asociada"} · {new Date(`${payment.created_at?.replace(" ", "T") || payment.createdAt.replace(" ", "T")}Z`).toLocaleString("es-MX")}</small></div><div className="payment-amount"><strong>{currency.format(payment.amountCents / 100)}</strong><small><span className="status-dot" /> Completado · Demo</small></div></article>)}</div> : <div className="empty-state"><span className="empty-icon"><Icon name="payment" /></span><strong>Aún no hay pagos</strong><p>Los registros de prueba aparecerán aquí.</p></div>}
              </div>
            </section>
          )}
          <footer className="page-footer"><span><span className="green-slash">&gt;</span> hecho para trabajar localmente</span><span>CMD PANEL <span className="brand-period">·</span> SIN CONEXIÓN EXTERNA</span></footer>
        </div>
      </main>
    </div>
  );
}

export default App;
