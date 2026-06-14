import sql from '../../../lib/db';

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token requerido' });

  const rests = await sql`SELECT id, nombre FROM restaurantes WHERE stock_token = ${token} LIMIT 1`;
  if (!rests.length) return res.status(404).json({ error: 'Link inválido' });
  const rest = rests[0];

  if (req.method === 'GET') {
    // Productos brutos habilitados
    const productos = await sql`
      SELECT id, nombre, unidad, merma, notas, factor_conversion, producto_base_id
      FROM productos
      WHERE restaurante_id = ${rest.id} AND stock_publico = true
      ORDER BY nombre`;

    // Recetas intermedias habilitadas con su factor calculado
    const intermedias = await sql`
      SELECT ri.id, ri.nombre,
        COALESCE(
          (SELECT SUM(ii.cantidad)
           FROM ingredientes_intermedias ii
           WHERE ii.receta_id = ri.id AND ii.tipo = 'producto'),
          1.0
        ) AS factor_auto,
        (SELECT STRING_AGG(p.nombre || ' (' || ii.cantidad || ' ' || ii.unidad || ')', ', ')
         FROM ingredientes_intermedias ii
         JOIN productos p ON p.id = ii.ref_id
         WHERE ii.receta_id = ri.id AND ii.tipo = 'producto'
        ) AS composicion
      FROM recetas_intermedias ri
      WHERE ri.restaurante_id = ${rest.id} AND ri.stock_publico_intermedia = true
      ORDER BY ri.nombre`;

    return res.json({ restaurante: rest.nombre, productos, intermedias });
  }

  if (req.method === 'POST') {
    const { fecha, items } = req.body;
    if (!fecha || !items?.length) return res.status(400).json({ error: 'Faltan datos' });

    for (const item of items) {
      const cantidad = parseFloat(item.cantidad) || 0;
      if (cantidad <= 0) continue;

      if (item.tipo === 'producto') {
        // Producto bruto directo (con posible conversión de estado)
        const prods = await sql`SELECT * FROM productos WHERE id=${item.id} AND restaurante_id=${rest.id}`;
        if (!prods.length) continue;
        const prod = prods[0];
        const factor = parseFloat(prod.factor_conversion) || 1.0;
        const cantConvertida = cantidad * factor;
        const prodFinalId = prod.producto_base_id || prod.id;
        const prodFinal = prod.producto_base_id
          ? await sql`SELECT nombre, unidad FROM productos WHERE id=${prod.producto_base_id}`
          : [{ nombre: prod.nombre, unidad: prod.unidad }];

        await sql`INSERT INTO stocks (restaurante_id, fecha, producto_id, producto_nombre, unidad, cantidad, notas)
          VALUES (${rest.id}, ${fecha}, ${prodFinalId}, ${prodFinal[0].nombre}, ${prodFinal[0].unidad},
                  ${cantConvertida},
                  ${factor !== 1.0 ? `Ingresado como ${prod.nombre}: ${cantidad} ${prod.unidad} × factor ${factor}` : null})`;

      } else if (item.tipo === 'intermedia') {
        // Receta intermedia: el factor es la suma de ingredientes brutos por kg de receta
        // Guardamos el stock como kg de receta intermedia directamente
        // Y también calculamos el equivalente en producto principal para comparativas
        const recetas = await sql`SELECT * FROM recetas_intermedias WHERE id=${item.id} AND restaurante_id=${rest.id}`;
        if (!recetas.length) continue;
        const receta = recetas[0];

        // Obtener ingredientes para calcular equivalencias
        const ings = await sql`
          SELECT ii.cantidad, ii.unidad, p.id as prod_id, p.nombre as prod_nombre, p.unidad as prod_unidad, p.merma
          FROM ingredientes_intermedias ii
          JOIN productos p ON p.id = ii.ref_id
          WHERE ii.receta_id = ${item.id} AND ii.tipo = 'producto'`;

        // Guardar stock de la receta intermedia
        await sql`INSERT INTO stocks (restaurante_id, fecha, producto_id, producto_nombre, unidad, cantidad, notas)
          VALUES (${rest.id}, ${fecha}, ${receta.id}, ${'[INT] ' + receta.nombre}, 'kg',
                  ${cantidad}, ${'Stock de receta intermedia'})`;

        // Por cada ingrediente bruto, guardar el equivalente consumido implícitamente
        for (const ing of ings) {
          const cantEquiv = parseFloat(ing.cantidad) * cantidad; // factor × kg de receta
          await sql`INSERT INTO stocks (restaurante_id, fecha, producto_id, producto_nombre, unidad, cantidad, notas)
            VALUES (${rest.id}, ${fecha}, ${ing.prod_id}, ${ing.prod_nombre}, ${ing.prod_unidad},
                    ${cantEquiv},
                    ${'Calculado desde stock de ' + receta.nombre + ': ' + cantidad + ' kg × ' + ing.cantidad})`;
        }
      }
    }

    return res.json({ ok: true });
  }

  res.status(405).end();
}
