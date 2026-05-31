-- SGI Renovar | Ajustes para backend eSocial

-- Opcional: marcar eventos simulados como enviados/processados durante testes.
-- Após validar transmissão real, ajustar status final para recibo real.

alter table eventos_esocial
add column if not exists backend_processado boolean default false;

alter table eventos_esocial
add column if not exists lote_id text;

notify pgrst, 'reload schema';
