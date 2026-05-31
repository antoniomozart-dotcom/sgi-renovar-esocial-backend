import fs from "fs";

/**
 * Assinatura XML placeholder.
 *
 * A assinatura ICP-Brasil do eSocial deve ser implementada com:
 * - certificado A1 PFX/P12;
 * - senha segura no backend;
 * - canonicalização;
 * - referência e enveloped signature conforme exigências do eSocial.
 *
 * Nunca assine no navegador.
 */
export async function assinarXml(xml, { certPath, password }) {
  if (!certPath || !password) {
    throw new Error("Certificado A1 ou senha não configurados no backend.");
  }

  if (!fs.existsSync(certPath)) {
    throw new Error(`Certificado não encontrado em: ${certPath}`);
  }

  // Implementação real virá aqui.
  // Por segurança, mantemos o retorno do XML original no starter.
  return xml;
}
