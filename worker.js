import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { gerarXmlEvento } from "./xml-builder.js";
import { assinarXml } from "./xml-signer.js";
import { transmitirEvento } from "./transmitir.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function registrarLog(eventoId, statusAnterior, statusNovo, acao, mensagem, payload = {}) {
  await supabase.from("eventos_esocial_logs").insert([{
    evento_esocial_id: eventoId,
    status_anterior: statusAnterior,
    status_novo: statusNovo,
    acao,
    mensagem,
    payload
  }]);
}

async function atualizarEvento(id, update) {
  const { error } = await supabase
    .from("eventos_esocial")
    .update(update)
    .eq("id", id);

  if (error) throw error;
}

async function buscarFila() {
  const { data, error } = await supabase
    .from("eventos_esocial")
    .select("*")
    .eq("status", "fila_envio")
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) throw error;
  return data || [];
}

async function processarEvento(evento) {
  console.log(`Processando ${evento.evento_codigo} - ${evento.protocolo_interno}`);

  try {
    await atualizarEvento(evento.id, {
      status: "gerando_xml",
      tentativas: (evento.tentativas || 0) + 1
    });

    const xml = await gerarXmlEvento(evento);

    await atualizarEvento(evento.id, {
      xml_evento: xml,
      status: "assinando_xml"
    });

    const xmlAssinado = await assinarXml(xml, {
      certPath: process.env.CERT_A1_PATH,
      password: process.env.CERT_A1_PASSWORD
    });

    await atualizarEvento(evento.id, {
      xml_assinado: xmlAssinado,
      status: "enviando"
    });

    const retorno = await transmitirEvento({
      evento,
      xmlAssinado,
      ambiente: process.env.ESOCIAL_AMBIENTE || "producao_restrita"
    });

    await atualizarEvento(evento.id, {
      status: retorno.status || "enviado",
      protocolo_esocial: retorno.protocolo_esocial || null,
      recibo_esocial: retorno.recibo_esocial || null,
      retorno,
      data_envio: new Date().toISOString(),
      data_retorno: retorno.recibo_esocial ? new Date().toISOString() : null
    });

    await registrarLog(
      evento.id,
      evento.status,
      retorno.status || "enviado",
      "TRANSMISSAO_EVENTO",
      "Evento processado pelo backend.",
      retorno
    );

  } catch (err) {
    console.error(err);

    await atualizarEvento(evento.id, {
      status: "erro",
      erro_codigo: "BACKEND_EXCEPTION",
      erro_mensagem: err.message,
      data_retorno: new Date().toISOString()
    });

    await registrarLog(
      evento.id,
      evento.status,
      "erro",
      "ERRO_BACKEND",
      err.message,
      { stack: err.stack }
    );
  }
}

async function main() {
  console.log("SGI Renovar eSocial Worker iniciado.");

  const fila = await buscarFila();

  if (!fila.length) {
    console.log("Nenhum evento na fila.");
    return;
  }

  for (const evento of fila) {
    await processarEvento(evento);
  }
}

main()
  .then(() => {
    console.log("Worker finalizado.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Erro geral:", err);
    process.exit(1);
  });
