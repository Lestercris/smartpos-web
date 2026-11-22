-- SmartPOS · Corrección del esquema de ventas
-- Ejecutar en Supabase → SQL Editor → New query → Run

-- 1) La columna "estado" no existía y el código la necesita para anular ventas
--    y para los reportes. Queda 'EMITIDA' por defecto y se rellena el histórico.
alter table public.ventas
    add column if not exists estado text not null default 'EMITIDA';

-- 2) Índice para que el reporte por rango de fechas y el arqueo de caja vuelen
create index if not exists ventas_created_at_idx on public.ventas (created_at desc);

-- 3) Diagnóstico: ¿hay líneas de venta guardadas?
--    Si "lineas" sale 0 con ventas > 0, la función realizar_venta no guarda el detalle;
--    el POS ya lo guarda desde el navegador tras cada venta (cobrar → guardarDetallesVenta).
--    Si "lineas" sale > 0 pero la app no las muestra, el problema son las políticas RLS.
select
    (select count(*) from public.ventas)          as ventas,
    (select count(*) from public.venta_detalles)  as lineas;

-- 4) (Opcional) Solo si el navegador no puede insertar las líneas de venta por RLS:
-- create policy "venta_detalles_insert_anon" on public.venta_detalles
--     for insert to anon with check (true);
