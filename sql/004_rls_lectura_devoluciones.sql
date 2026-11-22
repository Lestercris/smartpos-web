-- SmartPOS · 004 · Lectura de devoluciones desde el navegador (RLS)
-- Ejecutar en Supabase → SQL Editor → New query → Run.
--
-- Síntoma que corrige:
--   La devolución se guarda (la función procesar_devolucion escribe con permisos
--   de propietario), pero el comprobante sigue mostrando 0 devuelto porque RLS
--   bloquea la lectura de devoluciones y devolucion_detalles con la clave anon.
--
-- Solo actúa si RLS está activo en cada tabla; si está desactivado, no hace nada.

do $$
declare
    v_tabla  text;
    v_rls    boolean;
    v_poliza text;
begin
    foreach v_tabla in array array['devoluciones', 'devolucion_detalles']
    loop
        select relrowsecurity into v_rls
        from pg_class
        where oid = format('public.%I', v_tabla)::regclass;

        if coalesce(v_rls, false) then
            v_poliza := v_tabla || '_lectura';

            if not exists (
                select 1 from pg_policies
                where schemaname = 'public'
                  and tablename = v_tabla
                  and policyname = v_poliza
            ) then
                execute format(
                    'create policy %I on public.%I for select to anon, authenticated using (true)',
                    v_poliza, v_tabla
                );
            end if;
        end if;
    end loop;
end $$;

-- DIAGNÓSTICO: estas consultas sí ven todo (el editor usa un rol privilegiado)
select id, venta_id, usuario, motivo, fecha
from public.devoluciones
order by fecha desc
limit 5;

select id, devolucion_id, producto_id, cantidad
from public.devolucion_detalles
order by id desc
limit 10;

select id, nombre, stock
from public.productos
where id = 36;
