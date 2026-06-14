# RecetasPro 🍽️

Sistema de gestión gastronómica: recetas, ventas, stock y consumo teórico.

---

## Setup en 15 minutos

### 1. Base de datos (Neon — gratis)

1. Entrá a **https://neon.tech** y creá una cuenta gratuita
2. Creá un nuevo proyecto (nombre: `recetaspro`)
3. Copiá la **Connection string** (empieza con `postgresql://...`)

---

### 2. Configurar el proyecto

```bash
# Cloná o descomprimí el proyecto, luego:
npm install

# Copiá el archivo de variables de entorno
cp .env.local.example .env.local
```

Editá `.env.local` y pegá:
```
DATABASE_URL=postgresql://tu_url_de_neon_aqui
JWT_SECRET=un_texto_largo_aleatorio_que_vos_elegis_123456789
NEXT_PUBLIC_APP_URL=https://tu-app.vercel.app
```

---

### 3. Crear las tablas

```bash
npm run db:init
```

Esto crea todas las tablas y 2 usuarios demo:
- `admin` / `admin123`
- `sushi` / `sushi123`

---

### 4. Probar en local

```bash
npm run dev
# Abrí http://localhost:3000
```

---

### 5. Deploy en Vercel

1. Subí el proyecto a **GitHub** (podés hacer un repo privado)
2. Entrá a **https://vercel.com**, conectá tu GitHub y seleccioná el repo
3. En **Environment Variables** de Vercel, agregá:
   - `DATABASE_URL` → tu URL de Neon
   - `JWT_SECRET` → tu secreto (el mismo del .env.local)
4. Hacé click en **Deploy**
5. ¡Listo! Vercel te da una URL pública (ej: `https://recetaspro.vercel.app`)

---

## Agregar usuarios para nuevos restaurantes

Corrés este script desde tu máquina (con el `.env.local` configurado):

```bash
node -e "
require('dotenv').config({path:'.env.local'});
const {neon}=require('@neondatabase/serverless');
const bcrypt=require('bcryptjs');
const sql=neon(process.env.DATABASE_URL);
(async()=>{
  const hash=await bcrypt.hash('PASSWORD_AQUI',10);
  await sql\`INSERT INTO restaurantes(nombre,username,password_hash) VALUES('NOMBRE_RESTAURANTE','USUARIO',\${hash})\`;
  console.log('Usuario creado');
  process.exit(0);
})()
"
```

---

## Estructura del proyecto

```
recetaspro/
├── pages/
│   ├── index.js              ← App completa (frontend)
│   ├── _app.js
│   └── api/
│       ├── auth/login.js     ← Login
│       ├── productos/        ← CRUD productos brutos
│       ├── intermedias/      ← CRUD recetas intermedias
│       ├── finales/          ← CRUD platos finales
│       ├── ventas/           ← CRUD ventas
│       ├── stocks/           ← CRUD stock semanal
│       └── consumo/          ← Cálculo consumo teórico
├── lib/
│   ├── db.js                 ← Conexión PostgreSQL
│   ├── auth.js               ← JWT helpers
│   └── db-init.js            ← Script init de tablas
├── styles/
│   └── globals.css
├── .env.local.example
└── package.json
```
