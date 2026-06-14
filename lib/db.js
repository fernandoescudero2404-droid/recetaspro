import { neon } from '@neondatabase/serverless';

let sql;
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definida en las variables de entorno');
}
sql = neon(process.env.DATABASE_URL);
export default sql;
