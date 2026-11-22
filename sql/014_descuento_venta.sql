-- SmartPOS · 014 · Descuento manual en la venta
-- Ejecutar en Supabase → SQL Editor → New query → Run.

alter table public.ventas
    add column if not exists descuento numeric(12,2) not null default 0;

create or replace function public.registrar_descuento(
    p_venta_id bigint,
    p_descuento numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.ventas
       set descuento = coalesce(p_descuento, 0)
     where id = p_venta_id;
end;
$$;

grant execute on function public.registrar_descuento(bigint, numeric) to anon, authenticated;

-- Diagnóstico
select count(*) as ventas_con_descuento
from public.ventas
where descuento > 0;
