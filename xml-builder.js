import { create } from "xmlbuilder2";

export async function gerarXmlEvento(evento) {
  const nome = {
    "S-2210": "evtCAT",
    "S-2220": "evtMonit",
    "S-2221": "evtToxic",
    "S-2240": "evtExpRisco",
    "PPP": "evtPPPInterno"
  }[evento.evento_codigo] || "evtInterno";

  return create({ version: "1.0", encoding: "UTF-8" })
    .ele("eSocial", { xmlns: "http://www.esocial.gov.br/schema/evt/evtBase/v_S_01_03_00" })
      .ele(nome, { Id: evento.protocolo_interno })
        .ele("ideEvento")
          .ele("tpAmb").txt(evento.ambiente === "producao" ? "1" : "2").up()
          .ele("procEmi").txt("1").up()
          .ele("verProc").txt("SGI_RENOVAR_SIMULADO_0.2").up()
        .up()
        .ele("ideTrabalhador")
          .ele("cpfTrab").txt(String(evento.cpf_trabalhador || "").replace(/\D/g, "")).up()
        .up()
      .up()
    .up()
    .end({ prettyPrint: true });
}
