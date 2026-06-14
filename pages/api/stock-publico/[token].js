import sql from '../../../lib/db';

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token requerido' });

  const rests = await sql`SELECT id, nombre FROM restaurantes WHERE stock_token = ${token} LIMIT 1`;
  if (!rests.length) return res.status(404).json({ error: 'Link inválido' });
  const rest = rests[0];

  if (req.method === 'GET') {
    const productos = await sql`
      SELECT id, nombre, unidad, merma, factor_conversion, producto_base_id
      FROM productos
      WHERE restaurante_id = ${rest.id} AND stock_publico = true
      ORDER BY nombre`;

    const intermedias = await sql`
      SELECT ri.id, ri.nombre,
        COALESCE(
          (SELECT SUM(ii.cantidad)
           FROM ingredientes_intermedias ii
           WHERE ii.receta_id = ri.id AND ii.tipo = 'producto'),
          1.0
        ) AS factor_auto
      FROM recetas_intermedias ri
      WHERE ri.restaurante_id = ${rest.id} AND ri.stock_publico_intermedia = true
      ORDER BY ri.nombre`;

    return res.json({ restaurante: rest.nombre, productos, intermedias });
  }

  if (req.method === 'POST') {
    try {
      const { fecha, items } = req.body;
      if (!fecha || !items?.length) return res.status(400).json({ error: 'Faltan datos' });

      for (const item of items) {
        const cantidad = parseFloat(item.cantidad) || 0;
        if (cantidad <= 0) continue;

        if (item.tipo === 'producto') {
          const prods = await sql`SELECT * FROM productos WHERE id = ${item.id} AND restaurante_id = ${rest.id}`;
          if (!prods.length) continue;
          const prod = prods[0];

          const factor = parseFloat(prod.factor_conversion) || 1.0;
          const cantFinal = cantidad * factor;
          const prodFinalId = prod.producto_base_id || prod.id;

          let prodNombre = prod.nombre;
          if (prod.producto_base_id) {
            const base = await sql`SELECT nombre FROM productos WHERE id = ${prod.producto_base_id}`;
            if (base.length) prodNombre = base[0].nombre;
          }

          await sql`
            INSERT INTO stocks (restaurante_id, fecha, producto_id, producto_nombre, unidad, cantidad, notas)
            VALUES (
              ${rest.id}, ${fecha}, ${prodFinalId}, ${prodNombre}, ${prod.unidad},
              ${cantFinal},
              ${factor !== 1.0 ? `Desde ${prod.nombre}: ${cantidad} × ${factor}` : null}
            )`;

        } else if (item.tipo === 'intermedia') {
          const recetas = await sql`SELECT * FROM recetas_intermedias WHERE id = ${item.id} AND restaurante_id = ${rest.id}`;
          if (!recetas.length) continue;
          const receta = recetas[0];

          // Guardar stock de la receta intermedia
          await sql`
            INSERT INTO stocks (restaurante_id, fecha, producto_id, producto_nombre, unidad, cantidad, notas)
            VALUES (${rest.id}, ${fecha}, ${receta.id}, ${receta.nombre}, 'kg', ${cantidad}, 'Stock receta intermedia')`;

          // Guardar equivalente en productos brutos
          const ings = await sql`
            SELECT ii.cantidad, ii.unidad, p.id as prod_id, p.nombre as prod_nombre, p.unidad as prod_unidad
            FROM ingredientes_intermedias ii
            JOIN productos p ON p.id = ii.ref_id
            WHERE ii.receta_id = ${item.id} AND ii.tipo = 'producto'`;

          for (const ing of ings) {
            const cantEquiv = parseFloat(ing.cantidad) * cantidad;
            await sql`
              INSERT INTO stocks (restaurante_id, fecha, producto_id, producto_nombre, unidad, cantidad, notas)
              VALUES (${rest.id}, ${fecha}, ${ing.prod_id}, ${ing.prod_nombre}, ${ing.prod_unidad},
                      ${cantEquiv}, ${'Calculado desde ' + receta.nombre + ': ' + cantidad + ' kg'})`;
          }
        }
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error('Error guardando stock:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).end();
}
