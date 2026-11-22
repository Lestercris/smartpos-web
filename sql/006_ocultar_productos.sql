-- SmartPOS · 006 · Ocultar productos y permitir borrados con RLS
-- Ejecutar en Supabase → SQL Editor → New query → Run.
--
-- 1) Los productos con ventas no se pueden borrar sin romper el historial,
--    así que se "ocultan": dejan de aparecer en el listado y en el POS.
alter table public.productos
    add column if not exists activo boolean not null default true;

create index if not exists productos_activo_idx on public.productos (activo);

-- 2) Si RLS está activo en las tablas de catálogo, permite borrar desde la app.
--    (Si RLS está desactivado, este bloque no hace nada.)
do $$
declare
    v_tabla  text;
    v_rls    boolean;
    v_poliza text;
begin
    foreach v_tabla in array array['clientes', 'proveedores', 'categorias', 'subcategorias',
                                   'ubicaciones', 'unidades_medida', 'tipos_documento']
    loop
        select relrowsecurity into v_rls
        from pg_class
        where oid = format('public.%I', v_tabla)::regclass;

        if coalesce(v_rls, false) then
            v_poliza := v_tabla || '_borrar';
            if not exists (
                select 1 from pg_policies
                where schemaname = 'public' and tablename = v_tabla and policyname = v_poliza
            ) then
                execute format(
                    'create policy %I on public.%I for delete to anon, authenticated using (true)',
                    v_poliza, v_tabla
                );
            end if;
        end if;
    end loop;
end $$;

-- Diagnóstico
select count(*) filter (where activo is false) as ocultos,
       count(*) as total
from public.productos;
