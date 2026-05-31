# SGI Renovar | Worker Contínuo eSocial

Esta versão fica rodando em loop no Render e processa automaticamente a fila `eventos_esocial`.

## Variáveis no Render

SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ESOCIAL_AMBIENTE=producao_restrita
ESOCIAL_MODO_SIMULADO=true
WORKER_INTERVAL_MS=15000
CERT_A1_PATH=./certificados/empresa-a1.pfx
CERT_A1_PASSWORD=teste123

## Build Command

npm install

## Start Command

node worker.js

## Como funciona

A cada 15 segundos, o worker:
1. busca eventos com `status = fila_envio`;
2. muda para `processando`;
3. gera XML;
4. simula assinatura;
5. simula transmissão;
6. grava protocolo e recibo;
7. atualiza logs.
