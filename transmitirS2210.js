import axios from "axios";
import { supabase, baixarArquivoPrivado, salvarArquivoPrivado, registrarLog } from "./supabase.js";
import { carregarCertificadoPfx, assinarXmlEvento } from "./assinarXml.js";
import { gerarLoteEventos } from "./gerarLote.js";

export async function transmitirS2210({ cat_id, evento_id }) {
  let evento = null;

  if (evento_id) {
    const { data, error } = await supabase
      .from("esocial_eventos")
      .select("*, cat_comunicacoes(*), certificados_digitais(*)")
      .eq("id", evento_id)
      .single();

    if (error || !data) throw new Error("Evento eSocial não encontrado.");
    evento = data;
  } else {
    const { data, error } = await supabase
      .from("esocial_eventos")
      .select("*, cat_comunicacoes(*), certificados_digitais(*)")
      .eq("cat_id", cat_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Nenhum evento eSocial encontrado para esta CAT. Gere o XML primeiro.");
    evento = data;
  }

  await registrarLog(evento.id, "inicio_transmissao", "Iniciando transmissão S-2210", { evento_id: evento.id });

  const certificado = evento.certificados_digitais;

  if (!certificado?.arquivo_path) {
    throw new Error("Certificado sem arquivo_path.");
  }

  if (!certificado?.senha_certificado) {
    throw new Error("Certificado sem senha cadastrada. Use senha criptografada em produção.");
  }

  const xmlOriginal = evento.evento_xml;

  if (!xmlOriginal) {
    throw new Error("Evento sem XML para assinatura.");
  }

  const pfxBuffer = await baixarArquivoPrivado("certificados-digitais", certificado.arquivo_path);

  const dadosCertificado = carregarCertificadoPfx(pfxBuffer, certificado.senha_certificado);

  await registrarLog(evento.id, "certificado_lido", "Certificado A1 carregado", {
    subject: dadosCertificado.subject,
    issuer: dadosCertificado.issuer,
    serialNumber: dadosCertificado.serialNumber,
    validTo: dadosCertificado.validTo
  });

  const xmlAssinado = assinarXmlEvento(xmlOriginal, dadosCertificado);

  const xmlAssinadoPath = `${evento.empresa_id}/${evento.cat_id}/S-2210-assinado-${Date.now()}.xml`;

  await salvarArquivoPrivado("esocial-xml", xmlAssinadoPath, Buffer.from(xmlAssinado, "utf-8"), "text/xml");

  await registrarLog(evento.id, "xml_assinado", "XML assinado e salvo no Storage", { xmlAssinadoPath });

  const loteXml = gerarLoteEventos(xmlAssinado);

  const lotePath = `${evento.empresa_id}/${evento.cat_id}/lote-S-2210-${Date.now()}.xml`;

  await salvarArquivoPrivado("esocial-xml", lotePath, Buffer.from(loteXml, "utf-8"), "text/xml");

  await registrarLog(evento.id, "lote_gerado", "Lote eSocial gerado", { lotePath });

  const transmissaoHabilitada = false;

  if (!transmissaoHabilitada) {
    await supabase
      .from("esocial_eventos")
      .update({
        status: "xml_assinado",
        xml_path: xmlAssinadoPath,
        retorno: {
          mensagem: "XML assinado e lote gerado. Transmissão gov.br ainda desabilitada.",
          xmlAssinadoPath,
          lotePath
        }
      })
      .eq("id", evento.id);

    await supabase
      .from("cat_comunicacoes")
      .update({
        status: "pendente",
        status_esocial: "xml_assinado",
        xml_path: xmlAssinadoPath,
        retorno_esocial: {
          mensagem: "XML assinado e lote gerado. Transmissão gov.br ainda desabilitada.",
          evento_id: evento.id,
          xmlAssinadoPath,
          lotePath
        }
      })
      .eq("id", evento.cat_id);

    return {
      ok: true,
      status: "xml_assinado",
      mensagem: "XML assinado e lote gerado. Transmissão gov.br ainda desabilitada.",
      evento_id: evento.id,
      xmlAssinadoPath,
      lotePath
    };
  }

  const endpoint = process.env.ESOCIAL_ENDPOINT_ENVIO;

  const response = await axios.post(endpoint, loteXml, {
    headers: {
      "Content-Type": "text/xml;charset=UTF-8",
      "SOAPAction": "EnviarLoteEventos"
    },
    timeout: 60000
  });

  await registrarLog(evento.id, "retorno_gov", "Retorno do webservice eSocial", {
    status: response.status,
    data: response.data
  });

  return {
    ok: true,
    status: "enviado",
    retorno: response.data
  };
}
