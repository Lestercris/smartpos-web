-- SmartPOS · 008 · Total cobrado (con IVA) y forma de pago en una sola llamada
-- Ejecutar en Supabase → SQL Editor → New query → Run.
--
-- La función realizar_venta guarda el total SIN IVA, pero el POS cobra el
-- total CON IVA. Esta función corrige el total de la venta al importe que
-- realmente se cobró y guarda la forma de pago.

create or replace function public.registrar_cobro(
    p_venta_id bigint,
    p_metodo text,
    p_recibido numeric,
    p_vuelto numeric,
    p_total numeric
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
           vuelto = p_vuelto,
           total = coalesce(p_total, total)
     where id = p_venta_id;
end;
$$;

grant execute on function public.registrar_cobro(bigint, text, numeric, numeric, numeric) to anon, authenticated;

-- DIAGNÓSTICO: ventas cuyo total no coincide con la suma de sus líneas
-- (las antiguas se quedaron con el total sin IVA).
select v.id,
       v.total                          as guardado,
       round(sum(d.cantidad * d.precio_unitario), 2) as base
from public.ventas v
join public.venta_detalles d on d.venta_id = v.id
group by v.id, v.total
having abs(v.total - sum(d.cantidad * d.precio_unitario)) > 0.01
order by v.id desc
limit 10;
