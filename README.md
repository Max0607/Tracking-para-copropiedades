# Registro de tareas — Copropiedades

App web para registrar tareas de administración de varias copropiedades: qué hay que hacer, en qué edificio, en qué fecha se agregó, y para marcarla como completada cuando quede lista. Las tareas completadas quedan guardadas en su propio apartado.

Funciona igual de bien en celular y en computador.

---

## ⚠️ Importante sobre la base de datos

Render ofrece una base de datos PostgreSQL gratuita, **pero se borra automáticamente a los 30 días** (con 14 días extra de gracia para pagar antes de perder los datos). Como esta app necesita guardar tareas de forma permanente, la vamos a conectar en cambio a **Neon** (https://neon.tech), que tiene un plan gratuito de PostgreSQL **que no expira**. El servidor web (donde corre la aplicación) sí se queda en Render, gratis, sin límite de tiempo.

Resumen: **Neon = base de datos permanente y gratis** + **Render = donde corre la app, gratis**.

---

## Paso 1 — Crear la base de datos en Neon (gratis, permanente)

1. Entra a https://neon.tech y crea una cuenta gratuita (puedes usar tu cuenta de Google/GitHub).
2. Crea un proyecto nuevo (cualquier nombre, ej. "tareas-copropiedades").
3. En el panel del proyecto, busca la sección **Connection string** (cadena de conexión) y cópiala. Se ve así:
   ```
   postgresql://usuario:contraseña@ep-xxxx-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Guarda ese texto, lo vas a necesitar en el Paso 3.

## Paso 2 — Subir el código a GitHub

1. Entra a https://github.com y crea una cuenta si no tienes.
2. Crea un repositorio nuevo (puede ser privado), por ejemplo `tareas-copropiedades`.
3. Sube todos los archivos de esta carpeta al repositorio. La forma más fácil si no usas git desde la terminal es:
   - En la página del repositorio nuevo, haz clic en "uploading an existing file"
   - Arrastra todos los archivos y carpetas (incluida la carpeta `public`)
   - Confirma el "commit"

   Si prefieres usar la terminal:
   ```bash
   cd tareas-copropiedades
   git init
   git add .
   git commit -m "Primera versión"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/tareas-copropiedades.git
   git push -u origin main
   ```

## Paso 3 — Desplegar en Render (gratis)

1. Entra a https://render.com y crea una cuenta gratuita (puedes usar GitHub para entrar directo).
2. Clic en **New +** → **Web Service**.
3. Conecta tu cuenta de GitHub y selecciona el repositorio `tareas-copropiedades`.
4. Configura así:
   - **Name**: el que quieras (ej. `tareas-copropiedades`)
   - **Region**: la más cercana (Oregon u Ohio están bien para Colombia)
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free**
5. Antes de crear el servicio, agrega la variable de entorno:
   - Ve a **Environment** → **Add Environment Variable**
   - Key: `DATABASE_URL`
   - Value: pega la cadena de conexión de Neon que copiaste en el Paso 1
6. Clic en **Create Web Service**. Render va a instalar las dependencias y arrancar la app (toma 2-3 minutos la primera vez).
7. Cuando termine, Render te da una URL pública como `https://tareas-copropiedades.onrender.com`. Esa es la dirección que tu mamá y su socia van a usar.

## Paso 4 — Probar y guardar el acceso

- Abre la URL que te dio Render y agrega una tarea de prueba para confirmar que todo funciona.
- En el celular, abran la página en Chrome o Safari y usen la opción **"Agregar a pantalla de inicio"** — así queda como un ícono de app normal, sin tener que buscar el link cada vez.

---

## Cosas que conviene saber

- **El servicio gratis de Render "se duerme"** después de 15 minutos sin uso. La primera vez que alguien entra después de eso, puede tardar 30-60 segundos en cargar — es normal, no está roto. Después de esa primera carga, funciona rápido.
- **Los datos son permanentes** gracias a Neon: no se borran ni por inactividad ni por tiempo.
- **Sin usuario ni contraseña**: cualquier persona con el link puede entrar y usar la app, tal como pidieron. Si más adelante quieren protegerla con una clave, se puede agregar.
- **Actualizaciones futuras**: si quieres cambiar algo del código más adelante, subes los cambios a GitHub (`git push`) y Render vuelve a desplegar la app automáticamente.

## Uso local (opcional, para probar en tu computador antes de desplegar)

```bash
cd tareas-copropiedades
cp .env.example .env
# Pega tu cadena de conexión de Neon en el archivo .env
npm install
npm start
```

Luego abre http://localhost:3000 en el navegador.
