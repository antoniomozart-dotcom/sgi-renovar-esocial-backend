import { create } from "xmlbuilder2";

/**
 * Gera XML base por evento.
 * Esta é uma estrutura inicial. Cada evento deverá ser expandido conforme o leiaute oficial S-1.3.
 */
export async function gerarXmlEvento(evento) {
  const payload = evento.payload || {};
  const codigo = evento.evento_codigo;

  if (codigo === "S-2210") return gerarS2210(evento, payload);
  if (codigo === "S-2220") return gerarS2220(evento, payload);
  if (codigo === "S-2221") return gerarS2221(evento, payload);
  if (codigo === "S-2240") return gerarS2240(evento, payload);

  throw new Error(`Evento não implementado no XML builder: ${codigo}`);
}

function baseEvento(nomeEvento, evento, conteudo) {
  return create({ version: "1.0", encoding: "UTF-8" })
    .ele("eSocial", { xmlns: "http://www.esocial.gov.br/schema/evt/evtBase/v_S_01_03_00" })
      .ele(nomeEvento, { Id: evento.protocolo_interno })
        .ele("ideEvento")
          .ele("tpAmb").txt(evento.ambiente === "producao" ? "1" : "2").up()
          .ele("procEmi").txt("1").up()
          .ele("verProc").txt("SGI_RENOVAR_0.1").up()
        .up()
        .ele("ideEmpregador")
          .ele("tpInsc").txt("1").up()
          .ele("nrInsc").txt(String(conteudo.cnpj_empresa || "").replace(/\D/g, "").slice(0, 8)).up()
        .up()
        .ele("ideTrabalhador")
          .ele("cpfTrab").txt(String(evento.cpf_trabalhador || "").replace(/\D/g, "")).up()
        .up()
      .up()
    .up()
    .end({ prettyPrint: true });
}

function gerarS2210(evento, payload) {
  return baseEvento("evtCAT", evento, payload);
}

function gerarS2220(evento, payload) {
  return baseEvento("evtMonit", evento, payload);
}

function gerarS2221(evento, payload) {
  return baseEvento("evtToxic", evento, payload);
}

function gerarS2240(evento, payload) {
  return baseEvento("evtExpRisco", evento, payload);
}
