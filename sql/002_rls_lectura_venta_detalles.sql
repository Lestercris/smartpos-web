-- SmartPOS · 002 · Lectura del detalle de venta desde el navegador (RLS)
-- Ejecutar en Supabase → SQL Editor → New query → Run.
--
-- Síntoma que corrige:
--   Las líneas SÍ existen en public.venta_detalles (las crea la función
--   realizar_venta), pero el comprobante aparece vacío porque RLS bloquea
--   la lectura con la clave anon.
--
-- Solo actúa si RLS está activo en la tabla; si está desactivado, no hace nada.

do $$
declare
    v_rls boolean;
begin
    select relrowsecurity into v_rls
    from pg_class
    where oid = 'public.venta_detalles'::regclass;

    if coalesce(v_rls, false) then
        if not exists (
            select 1 from pg_policies
            where schemaname = 'public'
              and tablename = 'venta_detalles'
              and policyname = 'venta_detalles_lectura'
        ) then
            execute 'create policy venta_detalles_lectura on public.venta_detalles
                     for select to anon, authenticated using (true)';
        end if;
    end if;
end $$;

-- La función guardar_detalle_venta la creó una versión anterior de este script.
-- Ya no se usa: el detalle lo guarda realizar_venta. Se elimina para no confundir.
drop function if exists public.guardar_detalle_venta(bigint, jsonb);

-- Diagnóstico
select relrowsecurity as rls_activo
from pg_class
where oid = 'public.venta_detalles'::regclass;

select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'venta_detalles';
