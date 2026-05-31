export async function transmitirEvento({ evento, ambiente }) {
  return {
    status: "enviado",
    ambiente,
    modo: "simulado",
    protocolo_esocial: `PROTOCOLO-SIMULADO-${Date.now()}`,
    recibo_esocial: `RECIBO-SIMULADO-${Date.now()}`,
    mensagem: "Evento processado em modo simulado. Nenhum dado foi enviado ao governo."
  };
}
