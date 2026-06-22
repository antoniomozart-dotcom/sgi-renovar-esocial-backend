/**
 * transmitir.js — Orquestra a transmissão de qualquer evento ao eSocial via Tecnospeed
 *
 * Fluxo:
 *  1. Busca evento em eventos_esocial
 *  2. Busca empresa (CNPJ, nome)
 *  3. Gera XML do evento (xml-builder.js)
 *  4. Assina XML com certificado A1 (xml-signer.js)
 *  5. Envolve no lote eSocial (gerarLote.js)
 *  6. Envia à Tecnospeed
 *  7. Atualiza eventos_esocial com protocolo/recibo/status
 */

import { createClient } from "@supabase/supabase-js";
import { gerarXmlEvento } from "./xml-builder.js";
import { assinarXml } from "./xml-signer.js";
import { gerarLoteEventos } from "./gerarLote.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TECNOSPEED_TOKEN = process.env.TECNOSPEED_TOKEN;
const TECNOSPEED_CNPJ_SH = process.env.TECNOSPEED_CNPJ_SH; // CNPJ da software house
const ESOCIAL_AMBIENTE = process.env.ESOCIAL_AMBIENTE || "homologacao";
const MODO_SIMULADO = ESOCIAL_AMBIENTE === "homologacao_simulada";

// URL da API Tecnospeed eSocial (sandbox x produção)
const TECNOSPEED_URL = ESOCIAL_AMBIENTE === "producao"
  ? "https://api.tecnospeed.com.br/esocial/v1/lote"
  : "https://api.sandbox.tecnospeed.com.br/esocial/v1/lote";

let _sb = null;
function getSupabase() {
  if (!_sb) _sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  return _sb;
}

// ─── Callback de senha: busca do .env por empresa (extensível para vault) ─────
async function senhaCallback(certId) {
  // Por enquanto usa variável de ambiente única.
  // Para multi-empresa com senhas diferentes, substitua por busca em vault/tabela criptografada.
  return process.env.CERT_SENHA || null;
}

// ─── Log em esocial_logs ───────────────────────────────────────────────────────
async function log(tipo, descricao, payload) {
  try {
    await getSupabase().from("esocial_logs").insert([{ tipo, descricao, payload }]);
  } catch (e) {
    console.warn("[log]", e.message);
  }
}

// ─── Atualiza evento no banco ──────────────────────────────────────────────────
async function atualizarEvento(eventoId, campos) {
  await getSupabase()
    .from("eventos_esocial")
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq("id", eventoId);
}

// ─── Envia lote à Tecnospeed ───────────────────────────────────────────────────
async function enviarTecnospeed(xmlLote, cnpjEmpregador) {
  if (MODO_SIMULADO) {
    return {
      protocolo: `PROTOCOLO-SIMULADO-${Date.now()}`,
      recibo: `RECIBO-SIMULADO-${Date.now()}`,
      ambiente: ESOCIAL_AMBIENTE,
      modo: "simulado",
    };
  }

  if (!TECNOSPEED_TOKEN) throw new Error("TECNOSPEED_TOKEN não configurado.");

  const resp = await fetch(TECNOSPEED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/xml",
      "Authorization": `Bearer ${TECNOSPEED_TOKEN}`,
      "cnpj-sh": TECNOSPEED_CNPJ_SH || "",
      "cnpj-empregador": cnpjEmpregador,
    },
    body: xmlLote,
  });

  const texto = await resp.text();
  if (!resp.ok) {
    throw new Error(`Tecnospeed retornou ${resp.status}: ${texto.slice(0, 400)}`);
  }

  // A Tecnospeed retorna XML — extrai protocolo e recibo
  const protocolo = texto.match(/<nrRec>(.*?)<\/nrRec>/)?.[1] || null;
  const recibo = texto.match(/<nrRecibo>(.*?)<\/nrRecibo>/)?.[1] || protocolo;

  return { protocolo, recibo, ambiente: ESOCIAL_AMBIENTE, modo: "real", resposta_raw: texto };
}

// ─── Ponto de entrada principal ───────────────────────────────────────────────
export async function transmitirEvento({ evento_id }) {
  if (!evento_id) throw new Error("evento_id obrigatório.");

  const sb = getSupabase();

  // 1. Busca evento
  const { data: evento, error: evErr } = await sb
    .from("eventos_esocial")
    .select("*")
    .eq("id", evento_id)
    .single();

  if (evErr || !evento) throw new Error(`Evento não encontrado: ${evento_id}`);
  if (!["rascunho", "erro"].includes(evento.status)) {
    return { sucesso: false, mensagem: `Evento já está com status "${evento.status}" — não reenviado.` };
  }

  // 2. Busca empresa
  const { data: empresa, error: empErr } = await sb
    .from("empresas")
    .select("id,razao_social,nome,cnpj")
    .eq("id", evento.empresa_id)
    .single();

  if (empErr || !empresa) throw new Error(`Empresa não encontrada: ${evento.empresa_id}`);
  if (!empresa.cnpj) throw new Error(`Empresa sem CNPJ: ${empresa.razao_social || empresa.nome}`);

  const cnpjLimpo = empresa.cnpj.replace(/\D/g, "");

  await log("inicio_transmissao", `Iniciando transmissão ${evento.evento_codigo} para ${empresa.razao_social || empresa.nome}`, { evento_id, cnpj: cnpjLimpo });
  await atualizarEvento(evento_id, { status: "enfileirado", tentativas: (evento.tentativas || 0) + 1, data_entrada_fila: new Date().toISOString() });

  try {
    // 3. Gera XML
    const xml = await gerarXmlEvento({ ...evento, ambiente: ESOCIAL_AMBIENTE }, empresa);

    // 4. Assina XML
    const xmlAssinado = await assinarXml(xml, { empresaId: evento.empresa_id, senhaCallback });

    // 5. Gera lote
    const xmlLote = gerarLoteEventos(xmlAssinado, cnpjLimpo);

    // 6. Transmite
    const retorno = await enviarTecnospeed(xmlLote, cnpjLimpo);

    // 7. Atualiza evento com sucesso
    await atualizarEvento(evento_id, {
      status: "transmitido",
      protocolo_esocial: retorno.protocolo,
      recibo_esocial: retorno.recibo,
      data_envio: new Date().toISOString(),
      erro_codigo: null,
      erro_mensagem: null,
    });

    await log("transmissao_ok", `Evento ${evento.evento_codigo} transmitido com sucesso`, retorno);

    return {
      sucesso: true,
      protocolo: retorno.protocolo,
      recibo: retorno.recibo,
      ambiente: retorno.ambiente,
      modo: retorno.modo,
    };

  } catch (err) {
    // Marca como erro no banco
    await atualizarEvento(evento_id, {
      status: "erro",
      erro_codigo: "TRANSMISSAO_FALHOU",
      erro_mensagem: err.message,
    });
    await log("erro_transmissao", err.message, { evento_id });
    throw err;
  }
}
