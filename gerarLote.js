export function gerarLoteEventos(xmlAssinado) {
  const idLote = Date.now();

  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/lote/eventos/envio/v1_1_1">
  <envioLoteEventos grupo="2">
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc></nrInsc>
    </ideEmpregador>
    <ideTransmissor>
      <tpInsc>1</tpInsc>
      <nrInsc></nrInsc>
    </ideTransmissor>
    <eventos>
      <evento Id="IDLOTE${idLote}">
        ${xmlAssinado}
      </evento>
    </eventos>
  </envioLoteEventos>
</eSocial>`;
}
