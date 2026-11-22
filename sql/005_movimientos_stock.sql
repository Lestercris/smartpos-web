-- SmartPOS · 005 · Historial de entrada / salida de stock
-- Ejecutar en Supabase → SQL Editor → New query → Run.
--
-- Guarda cada movimiento de inventario (compra a proveedor, merma, rotura,
-- ajuste manual) para poder consultar el historial desde la ficha del producto.

create table if not exists public.movimientos_stock (
    id bigserial primary key,
    producto_id bigint not null references public.productos(id) on delete cascade,
    tipo text not null check (tipo in ('ENTRADA', 'SALIDA')),
    cantidad integer not null check (cantidad > 0),
    stock_anterior integer,
    stock_nuevo integer,
    motivo text,
    usuario text,
    created_at timestamptz not null default now()
);

create index if not exists movimientos_stock_producto_idx
    on public.movimientos_stock (producto_id, created_at desc);

-- Diagnóstico
select count(*) as movimientos from public.movimientos_stock;
