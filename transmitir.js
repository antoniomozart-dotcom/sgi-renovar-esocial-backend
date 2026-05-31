import axios from "axios";

/**
 * Transmissão placeholder.
 *
 * A transmissão real deve montar envelope SOAP conforme Manual do Desenvolvedor,
 * enviar lote de eventos e armazenar protocolo.
 */
export async function transmitirEvento({ evento, xmlAssinado, ambiente }) {
  const url = ambiente === "producao"
    ? process.env.ESOCIAL_ENVIO_PRODUCAO
    : process.env.ESOCIAL_ENVIO_RESTRITA;

  if (!url) {
    throw new Error("URL de envio eSocial não configurada.");
  }

  // MODO SEGURO INICIAL: não envia ainda ao governo.
  // Retorna simulação controlada para validar fluxo ponta a ponta.
  return {
    status: "enviado",
    ambiente,
    modo: "simulado",
    url,
    protocolo_esocial: `PROTOCOLO-SIMULADO-${Date.now()}`,
    mensagem: "Evento preparado pelo backend. Transmissão real SOAP ainda não ativada."
  };

  /*
  Exemplo futuro:
  const soapEnvelope = montarEnvelopeSOAP(xmlAssinado);
  const response = await axios.post(url, soapEnvelope, {
    headers: {
      "Content-Type": "text/xml;charset=UTF-8",
      "SOAPAction": "http://www.esocial.gov.br/servicos/empregador/enviarloteeventos/EnviarLoteEventos"
    },
    httpsAgent: agentComCertificadoA1
  });

  return parseRetorno(response.data);
  */
}
