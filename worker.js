import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { gerarXmlEvento } from "./xml-builder.js";
import { assinarXml } from "./xml-signer.js";
import { transmitirEvento } from "./transmitir.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const INTERVALO = Number(process.env.WORKER_INTERVAL_MS || 15000);
const WORKER_NOME = "render-worker-esocial";
const BACKEND_VERSAO = "0.3.0-continuo";

let processando = false;

function agoraISO(){
  return new Date().toISOString();
}

function esperar(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function atualizarEvento(id, update) {
  const { error } = await supabase
    .from("eventos_esocial")
    .update(update)
    .eq("id", id);

  if (error) throw error;
}

async function registrarLog(eventoId, statusAnterior, statusNovo, acao, mensagem, payload = {}, inicioMs = null) {
  const tempo = inicioMs ? Date.now() - inicioMs : null;

  await supabase.from("eventos_esocial_logs").insert([{
    evento_esocial_id: eventoId,
    status_anterior: statusAnterior,
    status_novo: statusNovo,
    acao,
    mensagem,
    payload,
    worker: WORKER_NOME,
    backend: BACKEND_VERSAO,
    tempo_processamento_ms: tempo
  }]);
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
  const inicio = Date.now();

  console.log(`Processando ${evento.evento_codigo} - ${evento.protocolo_interno}`);

  try {
    await atualizarEvento(evento.id, {
      status: "processando",
      processamento_iniciado_em: agoraISO(),
      worker_processador: WORKER_NOME,
      backend_versao: BACKEND_VERSAO,
      tentativas: (evento.tentativas || 0) + 1
    });

    await registrarLog(
      evento.id,
      evento.status,
      "processando",
      "INICIO_PROCESSAMENTO",
      "Worker iniciou o processamento do evento.",
      { protocolo_interno: evento.protocolo_interno },
      inicio
    );

    await atualizarEvento(evento.id, { status: "gerando_xml" });

    const xml = await gerarXmlEvento(evento);

    await atualizarEvento(evento.id, {
      xml_evento: xml,
      status: "assinando_xml"
    });

    const xmlAssinado = await assinarXml(xml, {
      certPath: process.env.CERT_A1_PATH,
      password: process.env.CERT_A1_PASSWORD,
      modoSimulado: process.env.ESOCIAL_MODO_SIMULADO === "true"
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
      data_envio: agoraISO(),
      data_retorno: agoraISO(),
      processamento_finalizado_em: agoraISO(),
      erro_codigo: null,
      erro_mensagem: null
    });

    await registrarLog(
      evento.id,
      "processando",
      retorno.status || "enviado",
      "PROCESSAMENTO_CONCLUIDO",
      "Evento processado pelo worker contínuo.",
      retorno,
      inicio
    );

    console.log(`Evento ${evento.protocolo_interno} processado: ${retorno.status || "enviado"}`);

  } catch (err) {
    console.error(err);

    await atualizarEvento(evento.id, {
      status: "erro",
      erro_codigo: "BACKEND_EXCEPTION",
      erro_mensagem: err.message,
      data_retorno: agoraISO(),
      processamento_finalizado_em: agoraISO()
    });

    await supabase.from("eventos_esocial_logs").insert([{
      evento_esocial_id: evento.id,
      status_anterior: evento.status,
      status_novo: "erro",
      acao: "ERRO_BACKEND",
      mensagem: err.message,
      payload: { stack: err.stack },
      stacktrace: err.stack,
      worker: WORKER_NOME,
      backend: BACKEND_VERSAO,
      tempo_processamento_ms: Date.now() - inicio
    }]);
  }
}

async function ciclo() {
  if (processando) return;

  processando = true;

  try {
    const fila = await buscarFila();

    if (!fila.length) {
      console.log(`[${new Date().toLocaleString("pt-BR")}] Nenhum evento na fila.`);
    } else {
      console.log(`[${new Date().toLocaleString("pt-BR")}] ${fila.length} evento(s) na fila.`);

      for (const evento of fila) {
        await processarEvento(evento);
      }
    }
  } catch (err) {
    console.error("Erro no ciclo do worker:", err);
  } finally {
    processando = false;
  }
}

async function main() {
  console.log("SGI Renovar eSocial Worker contínuo iniciado.");
  console.log(`Intervalo: ${INTERVALO}ms`);
  console.log(`Modo simulado: ${process.env.ESOCIAL_MODO_SIMULADO === "true" ? "SIM" : "NÃO"}`);

  await ciclo();

  while (true) {
    await esperar(INTERVALO);
    await ciclo();
  }
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
