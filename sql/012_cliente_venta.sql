-- SmartPOS · 012 · Cliente en la venta
-- Ejecutar en Supabase → SQL Editor → New query → Run.

alter table public.ventas
    add column if not exists cliente_id bigint references public.clientes(id) on delete set null;

-- Guardamos también el nombre en el momento de la venta: si el cliente se
-- borra o cambia de nombre, el ticket histórico no se altera.
alter table public.ventas
    add column if not exists cliente_nombre text;

create or replace function public.registrar_cliente(
    p_venta_id bigint,
    p_cliente_id bigint,
    p_nombre text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.ventas
       set cliente_id = p_cliente_id,
           cliente_nombre = p_nombre
     where id = p_venta_id;
end;
$$;

grant execute on function public.registrar_cliente(bigint, bigint, text) to anon, authenticated;

-- Diagnóstico
select count(*) as ventas_con_cliente
from public.ventas
where cliente_id is not null;
