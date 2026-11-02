import bcrypt from "bcryptjs";
import express from "express";
import session from "express-session";
import initSqlJs from "sql.js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const dataDirectory = path.join(root, "data");
const databasePath = path.join(dataDirectory, "app.sqlite");
const port = Number(process.env.PORT || 3001);
const app = express();

fs.mkdirSync(dataDirectory, { recursive: true });

const SQL = await initSqlJs();
const database = fs.existsSync(databasePath)
  ? new SQL.Database(fs.readFileSync(databasePath))
  : new SQL.Database();

database.run("PRAGMA foreign_keys = ON");
database.run(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    sex TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function saveDatabase() {
  const temporaryPath = `${databasePath}.tmp`;
  fs.writeFileSync(temporaryPath, Buffer.from(database.export()));
  fs.renameSync(temporaryPath, databasePath);
}

saveDatabase();

function rows(sql, parameters = []) {
  const statement = database.prepare(sql);
  try {
    statement.bind(parameters);
    const result = [];
    while (statement.step()) result.push(statement.getAsObject());
    return result;
  } finally {
    statement.free();
  }
}

function row(sql, parameters = []) {
  return rows(sql, parameters)[0] ?? null;
}

function run(sql, parameters = []) {
  database.run(sql, parameters);
  saveDatabase();
  return database.exec("SELECT last_insert_rowid() AS id")[0]?.values[0][0];
}

const allowedSexes = new Set(["Femenino", "Masculino", "Otro", "Prefiero no decir"]);

function validatePerson(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return ["Proporciona un objeto con los datos de la persona."];
  }
  const person = {
    name: typeof input.name === "string" ? input.name.trim() : "",
    age: Number(input.age),
    sex: typeof input.sex === "string" ? input.sex : "",
    email: typeof input.email === "string" ? input.email.trim().toLowerCase() : "",
    phone: typeof input.phone === "string" ? input.phone.trim() : "",
  };
  const errors = [];
  if (!person.name || person.name.length > 100) errors.push("El nombre es obligatorio (máximo 100 caracteres).");
  if (input.age === "" || input.age === null || input.age === undefined || !Number.isInteger(person.age) || person.age < 0 || person.age > 150) errors.push("La edad debe ser un número entero entre 0 y 150.");
  if (!allowedSexes.has(person.sex)) errors.push("Selecciona una opción válida para sexo.");
  if (person.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email)) errors.push("Escribe un correo electrónico válido.");
  if (person.phone.length > 25 || !/^[+()\d\s.-]{7,25}$/.test(person.phone)) errors.push("Escribe un teléfono válido.");
  return errors.length ? errors : person;
}

function requireLogin(request, response, next) {
  if (!request.session.adminId) return response.status(401).json({ error: "Inicia sesión para continuar." });
  next();
}

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use(session({
  name: "cmd.sid",
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60 * 1000 },
}));

app.get("/api/setup-status", (_request, response) => {
  response.json({ needsSetup: !row("SELECT id FROM admins LIMIT 1") });
});

app.post("/api/setup", async (request, response) => {
  if (row("SELECT id FROM admins LIMIT 1")) return response.status(409).json({ error: "La configuración inicial ya fue completada." });
  const username = typeof request.body.username === "string" ? request.body.username.trim() : "";
  const password = typeof request.body.password === "string" ? request.body.password : "";
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) return response.status(400).json({ error: "El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo." });
  if (password.length < 10 || password.length > 128) return response.status(400).json({ error: "La contraseña debe tener entre 10 y 128 caracteres." });
  const passwordHash = await bcrypt.hash(password, 12);
  const adminId = run("INSERT INTO admins (username, password_hash) VALUES (?, ?)", [username, passwordHash]);
  request.session.adminId = adminId;
  response.status(201).json({ username });
});

app.post("/api/login", async (request, response) => {
  const username = typeof request.body.username === "string" ? request.body.username.trim() : "";
  const password = typeof request.body.password === "string" ? request.body.password : "";
  const admin = row("SELECT id, username, password_hash FROM admins WHERE username = ?", [username]);
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
    return response.status(401).json({ error: "Usuario o contraseña incorrectos." });
  }
  request.session.adminId = admin.id;
  response.json({ username: admin.username });
});

app.get("/api/session", (request, response) => {
  if (!request.session.adminId) return response.json({ admin: null });
  const admin = row("SELECT username FROM admins WHERE id = ?", [request.session.adminId]);
  if (!admin) return request.session.destroy(() => response.json({ admin: null }));
  response.json({ admin });
});

app.post("/api/logout", requireLogin, (request, response) => {
  request.session.destroy((error) => {
    if (error) return response.status(500).json({ error: "No se pudo cerrar la sesión." });
    response.clearCookie("cmd.sid", { httpOnly: true, sameSite: "strict" });
    response.status(204).end();
  });
});

app.get("/api/people", requireLogin, (_request, response) => {
  response.json(rows("SELECT id, name, age, sex, email, phone, created_at FROM people ORDER BY id DESC"));
});

app.post("/api/people", requireLogin, (request, response) => {
  const person = validatePerson(request.body);
  if (Array.isArray(person)) return response.status(400).json({ error: person.join(" ") });
  const id = run(
    "INSERT INTO people (name, age, sex, email, phone) VALUES (?, ?, ?, ?, ?)",
    [person.name, person.age, person.sex, person.email, person.phone],
  );
  response.status(201).json(row("SELECT * FROM people WHERE id = ?", [id]));
});

app.put("/api/people/:id", requireLogin, (request, response) => {
  const id = Number(request.params.id);
  const person = validatePerson(request.body);
  if (!Number.isInteger(id) || id < 1) return response.status(400).json({ error: "Identificador inválido." });
  if (Array.isArray(person)) return response.status(400).json({ error: person.join(" ") });
  if (!row("SELECT id FROM people WHERE id = ?", [id])) return response.status(404).json({ error: "No se encontró la persona." });
  database.run(
    "UPDATE people SET name = ?, age = ?, sex = ?, email = ?, phone = ? WHERE id = ?",
    [person.name, person.age, person.sex, person.email, person.phone, id],
  );
  saveDatabase();
  response.json(row("SELECT * FROM people WHERE id = ?", [id]));
});

app.delete("/api/people/:id", requireLogin, (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id < 1) return response.status(400).json({ error: "Identificador inválido." });
  if (!row("SELECT id FROM people WHERE id = ?", [id])) return response.status(404).json({ error: "No se encontró la persona." });
  database.run("DELETE FROM people WHERE id = ?", [id]);
  saveDatabase();
  response.status(204).end();
});

app.get("/api/payments", requireLogin, (_request, response) => {
  response.json(rows(`
    SELECT payments.id, payments.person_id AS personId, payments.description,
      payments.amount_cents AS amountCents, payments.status, payments.created_at AS createdAt,
      people.name AS personName
    FROM payments LEFT JOIN people ON people.id = payments.person_id
    ORDER BY payments.id DESC
  `));
});

app.post("/api/payments", requireLogin, (request, response) => {
  const description = typeof request.body.description === "string" ? request.body.description.trim() : "";
  const amount = Number(request.body.amount);
  const personId = request.body.personId ? Number(request.body.personId) : null;
  if (!description || description.length > 120) return response.status(400).json({ error: "La descripción es obligatoria (máximo 120 caracteres)." });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000 || Math.round(amount * 100) < 1) {
    return response.status(400).json({ error: "El importe debe ser mayor que cero y no superar 100,000." });
  }
  if (personId !== null && (!Number.isInteger(personId) || !row("SELECT id FROM people WHERE id = ?", [personId]))) {
    return response.status(400).json({ error: "Selecciona una persona válida." });
  }
  const id = run(
    "INSERT INTO payments (person_id, description, amount_cents) VALUES (?, ?, ?)",
    [personId, description, Math.round(amount * 100)],
  );
  response.status(201).json(row(`
    SELECT payments.id, payments.person_id AS personId, payments.description,
      payments.amount_cents AS amountCents, payments.status, payments.created_at AS createdAt,
      people.name AS personName
    FROM payments LEFT JOIN people ON people.id = payments.person_id
    WHERE payments.id = ?
  `, [id]));
});

const builtFrontend = path.join(root, "dist");
if (fs.existsSync(builtFrontend)) {
  app.use(express.static(builtFrontend));
  app.get("*path", (_request, response) => response.sendFile(path.join(builtFrontend, "index.html")));
}

app.listen(port, "127.0.0.1", () => {
  console.log(`Panel local disponible en http://127.0.0.1:${port}`);
});
