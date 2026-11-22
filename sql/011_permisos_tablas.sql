-- SmartPOS · 011 · Permisos de las tablas nuevas
-- Ejecutar en Supabase → SQL Editor → New query → Run.
--
-- En este proyecto, las tablas creadas por SQL quedan con RLS activo y sin
-- políticas, así que el navegador no puede insertar. Esto lo resuelve para
-- promociones, movimientos_stock y smartpos_config.

do $$
declare
    v_tabla text;
begin
    foreach v_tabla in array array['promociones', 'movimientos_stock', 'smartpos_config']
    loop
        -- Permisos sobre la tabla
        execute format('grant select, insert, update, delete on public.%I to anon, authenticated', v_tabla);

        -- Política permisiva (solo se aplica si RLS está activo)
        if not exists (
            select 1 from pg_policies
            where schemaname = 'public'
              and tablename = v_tabla
              and policyname = v_tabla || '_todo'
        ) then
            execute format(
                'create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
                v_tabla || '_todo', v_tabla
            );
        end if;
    end loop;
end $$;

-- Permisos sobre las secuencias (necesarios para los "id" automáticos)
grant usage, select on all sequences in schema public to anon, authenticated;

-- Para las tablas que se creen en el futuro
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;

-- Diagnóstico
select relname, relrowsecurity as rls_activo
from pg_class
where relname in ('promociones', 'movimientos_stock', 'smartpos_config');
