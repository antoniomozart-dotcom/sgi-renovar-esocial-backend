import fs from "fs";

export async function assinarXml(xml, { certPath, password, modoSimulado = false }) {
  if (modoSimulado) {
    return `${xml}
<!-- ASSINATURA_SIMULADA_SGI_RENOVAR -->`;
  }

  if (!certPath || !password) throw new Error("Certificado A1 ou senha não configurados no backend.");
  if (!fs.existsSync(certPath)) throw new Error(`Certificado não encontrado em: ${certPath}`);
  return xml;
}
