-- SmartPOS · 010 · Promociones
-- Ejecutar en Supabase → SQL Editor → New query → Run.
--
-- Una promoción rebaja un porcentaje a un producto concreto o a todos
-- (producto_id vacío), opcionalmente entre dos fechas.

create table if not exists public.promociones (
    id bigserial primary key,
    nombre text not null,
    producto_id bigint references public.productos(id) on delete cascade,
    descuento numeric(5,2) not null check (descuento > 0 and descuento <= 100),
    fecha_inicio date,
    fecha_fin date,
    activa boolean not null default true,
    created_at timestamptz not null default now()
);

create index if not exists promociones_producto_idx on public.promociones (producto_id);

-- Deja el precio de cada línea igual al que realmente se cobró (con la rebaja)
create or replace function public.actualizar_precios_venta(p_venta_id bigint, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_item jsonb;
begin
    for v_item in select * from jsonb_array_elements(p_items)
    loop
        update public.venta_detalles
           set precio_unitario = (v_item->>'precio')::numeric
         where venta_id = p_venta_id
           and producto_id = (v_item->>'id')::bigint;
    end loop;
end;
$$;

grant execute on function public.actualizar_precios_venta(bigint, jsonb) to anon, authenticated;

-- Diagnóstico
select count(*) as promociones from public.promociones;
