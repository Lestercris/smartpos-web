-- SmartPOS · 007 · Forma de pago y vuelto
-- Ejecutar en Supabase → SQL Editor → New query → Run.
--
-- Guarda cómo pagó el cliente (efectivo, tarjeta o transferencia), cuánto
-- entregó y el vuelto. La venta la sigue creando realizar_venta; estos datos
-- se añaden justo después con una función aparte.

alter table public.ventas
    add column if not exists metodo_pago text not null default 'EFECTIVO';

alter table public.ventas
    add column if not exists monto_recibido numeric(12,2);

alter table public.ventas
    add column if not exists vuelto numeric(12,2);

create or replace function public.registrar_pago(
    p_venta_id bigint,
    p_metodo text,
    p_recibido numeric,
    p_vuelto numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.ventas
       set metodo_pago = coalesce(nullif(p_metodo, ''), 'EFECTIVO'),
           monto_recibido = p_recibido,
           vuelto = p_vuelto
     where id = p_venta_id;
end;
$$;

grant execute on function public.registrar_pago(bigint, text, numeric, numeric) to anon, authenticated;

-- Diagnóstico: reparto de ventas por forma de pago
select metodo_pago, count(*) as ventas
from public.ventas
group by metodo_pago
order by ventas desc;
