/**
 * xml-builder.js — Constrói o XML de cada evento eSocial
 *
 * Referências de leiaute:
 *  S-2210  evtCAT        — CAT (Comunicação de Acidente de Trabalho)
 *  S-2220  evtMonit      — Monitoramento da Saúde do Trabalhador (exames ocupacionais / ASO)
 *  S-2221  evtToxic      — Exame Toxicológico do Motorista Profissional
 *  S-2240  evtExpRisco   — Condições Ambientais do Trabalho (GHE)
 */

import { create } from "xmlbuilder2";

const VERSAO_PROC = "SGI_RENOVAR_1_0";

function limparCPF(v) {
  return String(v || "").replace(/\D/g, "");
}
function limparCNPJ(v) {
  return String(v || "").replace(/\D/g, "");
}
function limparData(v) {
  // aceita "2025-06-21" ou "21/06/2025" → retorna "2025-06-21"
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const p = v.split("/");
  if (p.length === 3) return `${p[2]}-${p[1]}-${p[0]}`;
  return v;
}
function tpAmb(ambiente) {
  return ambiente === "producao" ? "1" : "2";
}

// ─── S-2210 — CAT ─────────────────────────────────────────────────────────────
export function gerarXmlS2210(evento, empresa) {
  const p = evento.payload || {};
  const id = `E${limparCNPJ(empresa.cnpj)}${Date.now()}`;

  return create({ version: "1.0", encoding: "UTF-8" })
    .ele("eSocial", { xmlns: "http://www.esocial.gov.br/schema/evt/evtCAT/v_S_01_03_00" })
      .ele("evtCAT", { Id: id })
        .ele("ideEvento")
          .ele("tpAmb").txt(tpAmb(evento.ambiente)).up()
          .ele("procEmi").txt("1").up()
          .ele("verProc").txt(VERSAO_PROC).up()
        .up()
        .ele("ideEmpregador")
          .ele("tpInsc").txt("1").up()
          .ele("nrInsc").txt(limparCNPJ(empresa.cnpj).slice(0, 8)).up()
        .up()
        .ele("ideVinculo")
          .ele("cpfTrab").txt(limparCPF(evento.cpf_trabalhador)).up()
        .up()
        .ele("cat")
          .ele("dtAcid").txt(limparData(p.data_acidente)).up()
          .ele("tpAcid").txt(p.tipo_acidente === "Típico" ? "1" : p.tipo_acidente === "Doença" ? "2" : "3").up()
          .ele("iniciatCAT").txt(p.iniciativa_cat === "Empregador" ? "1" : "2").up()
          .ele("obsCAT").txt(p.descricao_acidente || "").up()
        .up()
      .up()
    .up()
    .end({ prettyPrint: true });
}

// ─── S-2220 — Monitoramento da Saúde (ASO / Exames Ocupacionais) ──────────────
export function gerarXmlS2220(evento, empresa) {
  const p = evento.payload || {};
  const id = `E${limparCNPJ(empresa.cnpj)}${Date.now()}`;

  const TIPO_EXAME = {
    admissional: "0",
    periodico: "1",
    retorno_trabalho: "2",
    mudanca_funcao: "3",
    demissional: "9",
  };

  const RESULTADO = {
    apto: "1",
    inapto: "2",
    apto_condicoes: "3",
    apto_restricao: "3",
  };

  return create({ version: "1.0", encoding: "UTF-8" })
    .ele("eSocial", { xmlns: "http://www.esocial.gov.br/schema/evt/evtMonit/v_S_01_03_00" })
      .ele("evtMonit", { Id: id })
        .ele("ideEvento")
          .ele("tpAmb").txt(tpAmb(evento.ambiente)).up()
          .ele("procEmi").txt("1").up()
          .ele("verProc").txt(VERSAO_PROC).up()
        .up()
        .ele("ideEmpregador")
          .ele("tpInsc").txt("1").up()
          .ele("nrInsc").txt(limparCNPJ(empresa.cnpj).slice(0, 8)).up()
        .up()
        .ele("ideVinculo")
          .ele("cpfTrab").txt(limparCPF(evento.cpf_trabalhador)).up()
        .up()
        .ele("aso")
          .ele("dtAso").txt(limparData(p.data_exame)).up()
          .ele("tpAso").txt(TIPO_EXAME[p.tipo_exame] || "1").up()
          .ele("resAso").txt(RESULTADO[p.resultado] || "1").up()
          .ele("medico")
            .ele("nmMed").txt(evento.medico_nome || "").up()
            .ele("nrCRM").txt(String(evento.medico_crm || "")).up()
            .ele("ufCRM").txt(evento.medico_uf || "").up()
          .up()
        .up()
      .up()
    .up()
    .end({ prettyPrint: true });
}

// ─── S-2221 — Exame Toxicológico do Motorista Profissional ────────────────────
export function gerarXmlS2221(evento, empresa) {
  const p = evento.payload || {};
  const id = `E${limparCNPJ(empresa.cnpj)}${Date.now()}`;

  const TIPO_EXAME = {
    admissional: "1",
    periodico: "2",
    mudanca_funcao: "3",
    demissional: "4",
    renovacao_cnh: "5",
  };

  const RESULTADO = {
    nao_reagente: "1",
    reagente: "2",
    inconclusivo: "3",
    amostra_insuficiente: "4",
  };

  return create({ version: "1.0", encoding: "UTF-8" })
    .ele("eSocial", { xmlns: "http://www.esocial.gov.br/schema/evt/evtToxic/v_S_01_03_00" })
      .ele("evtToxic", { Id: id })
        .ele("ideEvento")
          .ele("tpAmb").txt(tpAmb(evento.ambiente)).up()
          .ele("procEmi").txt("1").up()
          .ele("verProc").txt(VERSAO_PROC).up()
        .up()
        .ele("ideEmpregador")
          .ele("tpInsc").txt("1").up()
          .ele("nrInsc").txt(limparCNPJ(empresa.cnpj).slice(0, 8)).up()
        .up()
        .ele("ideVinculo")
          .ele("cpfTrab").txt(limparCPF(evento.cpf_trabalhador)).up()
        .up()
        .ele("exame")
          .ele("dtExame").txt(limparData(p.data_coleta)).up()
          .ele("tpExame").txt(TIPO_EXAME[p.tipo_exame] || "2").up()
          .ele("resultado").txt(RESULTADO[p.resultado] || "1").up()
          .ele("catCNH").txt(p.categoria_cnh || "C").up()
        .up()
      .up()
    .up()
    .end({ prettyPrint: true });
}

// ─── Router — escolhe o builder pelo código do evento ────────────────────────
export async function gerarXmlEvento(evento, empresa) {
  switch (evento.evento_codigo) {
    case "S-2210": return gerarXmlS2210(evento, empresa);
    case "S-2220": return gerarXmlS2220(evento, empresa);
    case "S-2221": return gerarXmlS2221(evento, empresa);
    default:
      throw new Error(`Código de evento não suportado: ${evento.evento_codigo}`);
  }
}
