import sql from '../../../lib/db';

// Expande recursivamente una receta intermedia hasta llegar a productos brutos
// Retorna array de { prod_id, prod_nombre, prod_unidad, merma, cantidad_bruta }
async function expandirIntermedia(recetaId, cantidadKg, rid, visited = new Set()) {
  if (visited.has(recetaId)) return [];
  visited.add(recetaId);

  const ings = await sql`
    SELECT ii.tipo, ii.ref_id, ii.cantidad, ii.unidad,
           p.id as prod_id, p.nombre as prod_nombre, p.unidad as prod_unidad, p.merma as prod_merma
    FROM ingredientes_intermedias ii
    LEFT JOIN productos p ON p.id = ii.ref_id AND ii.tipo = 'producto'
    WHERE ii.receta_id = ${recetaId}`;

  const resultado = [];

  for (const ing of ings) {
    const factorIng = parseFloat(ing.cantidad) * cantidadKg;

    if (ing.tipo === 'producto') {
      // Producto bruto: aplicar merma para obtener equivalente bruto
      const merma = parseFloat(ing.prod_merma) || 0;
      const cantBruta = merma > 0 ? factorIng / ((100 - merma) / 100) : factorIng;
      resultado.push({
        prod_id: ing.prod_id,
        prod_nombre: ing.prod_nombre,
        prod_unidad: ing.prod_unidad,
        merma,
        cantidad_neta: factorIng,
        cantidad_bruta: cantBruta,
      });
    } else if (ing.tipo === 'intermedia') {
      // Receta intermedia anidada: expandir recursivamente
      const sub = await expandirIntermedia(ing.ref_id, factorIng, rid, new Set(visited));
      resultado.push(...sub);
    }
  }

  return resultado;
}

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
      SELECT ri.id, ri.nombre, ri.stock_publico_intermedia
      FROM recetas_intermedias ri
      WHERE ri.restaurante_id = ${rest.id} AND ri.stock_publico_intermedia = true
      ORDER BY ri.nombre`;

    // Calcular factor de cada intermedia (expandiendo recursivamente)
    const intermediasConFactor = await Promise.all(intermedias.map(async ri => {
      const expandido = await expandirIntermedia(ri.id, 1, rest.id);
      const factorTotal = expandido.reduce((sum, e) => sum + e.cantidad_bruta, 0);
      return { ...ri, factor_auto: factorTotal };
    }));

    return res.json({ restaurante: rest.nombre, productos, intermedias: intermediasConFactor });
  }

  if (req.method === 'POST') {
    try {
      const { fecha, items } = req.body;
      if (!fecha || !items?.length) return res.status(400).json({ error: 'Faltan datos' });

      for (const item of items) {
        const cantidad = parseFloat(item.cantidad) || 0;
        if (cantidad <= 0) continue;

        if (item.tipo === 'producto') {
          // Producto bruto directo (con posible conversión de estado)
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
            VALUES (${rest.id}, ${fecha}, ${prodFinalId}, ${prodNombre}, ${prod.unidad},
                    ${cantFinal},
                    ${factor !== 1.0 ? `Conversion: ${prod.nombre} → ${cantidad} ${prod.unidad} × ${factor}` : null})`;

        } else if (item.tipo === 'intermedia') {
          // Receta intermedia: guardar línea de la receta Y expandir a productos brutos
          const recetas = await sql`SELECT * FROM recetas_intermedias WHERE id = ${item.id} AND restaurante_id = ${rest.id}`;
          if (!recetas.length) continue;
          const receta = recetas[0];

          // Guardar stock de la receta intermedia (para referencia)
          await sql`
            INSERT INTO stocks (restaurante_id, fecha, producto_id, producto_nombre, unidad, cantidad, notas)
            VALUES (${rest.id}, ${fecha}, ${receta.id}, ${receta.nombre}, 'kg', ${cantidad}, 'Stock receta intermedia')`;

          // Expandir recursivamente hasta productos brutos con merma aplicada
          const expandido = await expandirIntermedia(receta.id, cantidad, rest.id);

          for (const e of expandido) {
            await sql`
              INSERT INTO stocks (restaurante_id, fecha, producto_id, producto_nombre, unidad, cantidad, notas)
              VALUES (${rest.id}, ${fecha}, ${e.prod_id}, ${e.prod_nombre}, ${e.prod_unidad},
                      ${Math.round(e.cantidad_bruta * 10000) / 10000},
                      ${'Calculado desde ' + receta.nombre + ': ' + cantidad + ' kg (incluye merma ' + e.merma + '%)'})`;
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
