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
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Obtener todas las tareas (pendientes y completadas)
app.get('/api/tasks', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
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

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Servidor escuchando en el puerto ${PORT}`));
  })
  .catch((err) => {
    console.error('Error al inicializar la base de datos:', err);
    process.exit(1);
  });
