/**
 * gerarLote.js — Envolve o XML assinado no envelope de lote eSocial
 * Schema: http://www.esocial.gov.br/schema/lote/eventos/envio/v1_1_1
 */

export function gerarLoteEventos(xmlAssinado, cnpjEmpregador) {
  const idLote = `LOTE${Date.now()}`;
  const cnpjRaiz = String(cnpjEmpregador || "").replace(/\D/g, "").slice(0, 8);
  const cnpjCompleto = String(cnpjEmpregador || "").replace(/\D/g, "");

  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/lote/eventos/envio/v1_1_1">
  <envioLoteEventos grupo="2">
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpjRaiz}</nrInsc>
    </ideEmpregador>
    <ideTransmissor>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpjCompleto}</nrInsc>
    </ideTransmissor>
    <eventos>
      <evento Id="${idLote}">
        ${xmlAssinado}
      </evento>
    </eventos>
  </envioLoteEventos>
</eSocial>`;
}
