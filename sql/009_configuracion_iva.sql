-- SmartPOS · 009 · Configuración del IVA
-- Ejecutar en Supabase → SQL Editor → New query → Run.
--
-- Usa una tabla propia (smartpos_config) porque el proyecto ya tenía otra
-- tabla llamada "configuracion" con una estructura distinta.

create table if not exists public.smartpos_config (
    clave text primary key,
    valor text not null,
    actualizado timestamptz not null default now()
);

insert into public.smartpos_config (clave, valor)
values ('iva_rate', '0.18')
on conflict (clave) do nothing;

-- Diagnóstico
select clave, valor from public.smartpos_config;
