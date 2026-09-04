require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  console.error(
    'Falta la variable de entorno DATABASE_URL. Revisa tu archivo .env (local) ' +
    'o la configuración de variables de entorno en Render (producción).'
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      description TEXT NOT NULL,
      copropiedad TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed BOOLEAN NOT NULL DEFAULT false,
      completed_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS copropiedades (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_notes (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      text TEXT,
      image_data TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Evita duplicados sin importar mayúsculas/minúsculas (ej. "Los Robles" y "los robles")
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS copropiedades_name_lower_idx
    ON copropiedades (LOWER(name));
  `);

  // Migración: si ya había tareas con copropiedades escritas a mano, las
  // agrega automáticamente a la lista para que no se pierda nada.
  await pool.query(`
    INSERT INTO copropiedades (name)
    SELECT DISTINCT copropiedad FROM tasks
    ON CONFLICT ((LOWER(name))) DO NOTHING;
  `);
}

app.use(express.json({ limit: '6mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Obtener todas las tareas (pendientes y completadas), con el número de notas de cada una
app.get('/api/tasks', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*, COALESCE(n.notes_count, 0)::int AS notes_count
      FROM tasks t
      LEFT JOIN (
        SELECT task_id, COUNT(*) AS notes_count FROM task_notes GROUP BY task_id
      ) n ON n.task_id = t.id
      ORDER BY t.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudieron obtener las tareas.' });
  }
});

// Crear una tarea nueva
app.post('/api/tasks', async (req, res) => {
  const { description, copropiedad } = req.body || {};
  if (!description || !description.trim() || !copropiedad || !copropiedad.trim()) {
    return res.status(400).json({ error: 'La tarea y la copropiedad son obligatorias.' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO tasks (description, copropiedad) VALUES ($1, $2) RETURNING *',
      [description.trim(), copropiedad.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo guardar la tarea.' });
  }
});

// Marcar como completada o reabrir una tarea
app.patch('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const completed = Boolean(req.body && req.body.completed);
  try {
    const { rows } = await pool.query(
      `UPDATE tasks
       SET completed = $1,
           completed_at = CASE WHEN $1 THEN now() ELSE NULL END
       WHERE id = $2
       RETURNING *`,
      [completed, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Tarea no encontrada.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo actualizar la tarea.' });
  }
});

// Eliminar una tarea (por si se creó por error)
app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Tarea no encontrada.' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo eliminar la tarea.' });
  }
});

// Listar copropiedades (para el dropdown y el panel de administración)
app.get('/api/copropiedades', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM copropiedades ORDER BY LOWER(name) ASC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudieron obtener las copropiedades.' });
  }
});

// Agregar una copropiedad nueva a la lista
app.post('/api/copropiedades', async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre de la copropiedad es obligatorio.' });
  }
  const trimmed = name.trim();
  try {
    const { rows } = await pool.query(
      'INSERT INTO copropiedades (name) VALUES ($1) RETURNING *',
      [trimmed]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      // Ya existe (comparación sin distinguir mayúsculas/minúsculas): la devolvemos tal cual.
      const { rows } = await pool.query('SELECT * FROM copropiedades WHERE LOWER(name) = LOWER($1)', [trimmed]);
      return res.status(200).json(rows[0]);
    }
    console.error(err);
    res.status(500).json({ error: 'No se pudo agregar la copropiedad.' });
  }
});

// Eliminar una copropiedad (solo si ya no tiene tareas asociadas)
app.delete('/api/copropiedades/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('SELECT name FROM copropiedades WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Copropiedad no encontrada.' });

    const { rows: usageRows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM tasks WHERE LOWER(copropiedad) = LOWER($1)',
      [rows[0].name]
    );
    if (usageRows[0].count > 0) {
      return res.status(409).json({
        error: `No se puede eliminar: tiene ${usageRows[0].count} tarea(s) asociada(s). Elimina o reasigna esas tareas primero.`,
      });
    }

    await pool.query('DELETE FROM copropiedades WHERE id = $1', [id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo eliminar la copropiedad.' });
  }
});

// Listar las notas de una tarea (orden cronológico)
app.get('/api/tasks/:id/notes', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM task_notes WHERE task_id = $1 ORDER BY created_at ASC',
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudieron obtener las notas.' });
  }
});

// Agregar una nota (texto y/o imagen) a una tarea
app.post('/api/tasks/:id/notes', async (req, res) => {
  const { id } = req.params;
  const { text, image_data: imageData } = req.body || {};
  const trimmedText = (text || '').trim();

  if (!trimmedText && !imageData) {
    return res.status(400).json({ error: 'Escribe algo o adjunta una foto para guardar la nota.' });
  }
  if (imageData && (typeof imageData !== 'string' || !imageData.startsWith('data:image/'))) {
    return res.status(400).json({ error: 'La imagen no tiene un formato válido.' });
  }
  if (imageData && imageData.length > 6 * 1024 * 1024) {
    return res.status(413).json({ error: 'La imagen es demasiado grande.' });
  }

  try {
    const taskCheck = await pool.query('SELECT id FROM tasks WHERE id = $1', [id]);
    if (!taskCheck.rows.length) return res.status(404).json({ error: 'Tarea no encontrada.' });

    const { rows } = await pool.query(
      'INSERT INTO task_notes (task_id, text, image_data) VALUES ($1, $2, $3) RETURNING *',
      [id, trimmedText || null, imageData || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo guardar la nota.' });
  }
});

// Eliminar una nota
app.delete('/api/notes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM task_notes WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Nota no encontrada.' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo eliminar la nota.' });
  }
});

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Servidor escuchando en el puerto ${PORT}`));
  })
  .catch((err) => {
    console.error('Error al inicializar la base de datos:', err);
    process.exit(1);
  });
