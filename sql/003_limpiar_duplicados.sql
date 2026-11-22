-- SmartPOS · 003 · Limpieza de líneas duplicadas y protección contra duplicados
-- Ejecutar en Supabase → SQL Editor → New query → Run.
--
-- Origen del problema: una versión del POS insertaba las líneas desde el
-- navegador además de las que ya creaba realizar_venta, dejando dos filas
-- idénticas por producto en la misma venta.

-- 1) Elimina las líneas repetidas conservando la de id más bajo
delete from public.venta_detalles a
using public.venta_detalles b
where a.venta_id = b.venta_id
  and a.producto_id = b.producto_id
  and a.id > b.id;

-- 2) Impide que vuelva a ocurrir
create unique index if not exists venta_detalles_venta_producto_idx
    on public.venta_detalles (venta_id, producto_id);

-- 3) Diagnóstico: "lineas" y "lineas_unicas" deben coincidir
select
    count(*) as lineas,
    count(distinct (venta_id, producto_id)) as lineas_unicas
from public.venta_detalles;

-- 4) Comprobación de la venta 18: debe quedar una sola fila de 7 unidades
select id, producto_id, cantidad, precio_unitario
from public.venta_detalles
where venta_id = 18
order by id;
