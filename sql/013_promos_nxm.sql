-- SmartPOS · 013 · Promociones "lleva N paga M"
-- Ejecutar en Supabase → SQL Editor → New query → Run.
--
-- Añade el tipo de promoción. Las de porcentaje siguen igual.
-- En las NXM, "descuento" guarda el porcentaje equivalente (2x1 = 50 %)
-- solo para poder comparar y mostrar; el cálculo real usa lleva/paga.

alter table public.promociones
    add column if not exists tipo text not null default 'PORCENTAJE';

alter table public.promociones
    add column if not exists lleva integer;

alter table public.promociones
    add column if not exists paga integer;

-- Diagnóstico
select id, nombre, tipo, descuento, lleva, paga, activa
from public.promociones
order by id desc;
