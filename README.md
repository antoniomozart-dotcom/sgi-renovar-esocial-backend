# SGI Renovar | Backend eSocial Starter

Este pacote é o início do backend para processar a fila `eventos_esocial`.

## Por que backend?

O envio real ao eSocial exige:

- geração de XML oficial conforme leiaute vigente;
- assinatura digital com certificado A1/ICP-Brasil;
- comunicação SOAP/Webservice;
- consulta de retorno;
- gravação de protocolo e recibo.

Nada disso deve ficar no HTML, porque exporia certificado, senha e regras sensíveis.

## Fluxo recomendado

1. O HTML salva CAT, ASO, S-2221, S-2240 ou PPP.
2. O botão envia para a tabela `eventos_esocial`.
3. O backend busca eventos `fila_envio`.
4. O backend gera XML.
5. O backend assina o XML com certificado A1.
6. O backend envia lote ao webservice do eSocial.
7. O backend salva protocolo.
8. O backend consulta retorno.
9. O backend salva recibo, erro ou rejeição.

## Instalação

```bash
npm install
cp .env.example .env
npm run worker
```

## Importante

Este starter ainda está em modo seguro de estruturação. A função `transmitirEvento()` está preparada para receber a implementação SOAP oficial.

Antes de produção, validar com:

- Manual de Orientação do Desenvolvedor eSocial vigente;
- Leiautes S-1.3 vigentes;
- URLs oficiais;
- certificado A1 válido;
- procuração eletrônica quando aplicável;
- ambiente de produção restrita antes do ambiente real.
