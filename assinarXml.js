import forge from "node-forge";
import { SignedXml } from "xml-crypto";

export function carregarCertificadoPfx(pfxBuffer, senha) {
  try {
    const p12Der = forge.util.createBuffer(pfxBuffer.toString("binary"));
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, senha || "");

    let privateKey = null;
    let certificate = null;

    for (const safeContent of p12.safeContents) {
      for (const safeBag of safeContent.safeBags) {
        if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
          privateKey = safeBag.key;
        }
        if (safeBag.type === forge.pki.oids.certBag) {
          certificate = safeBag.cert;
        }
      }
    }

    if (!privateKey || !certificate) {
      throw new Error("Não foi possível extrair chave privada e certificado do PFX.");
    }

    return {
      privateKeyPem: forge.pki.privateKeyToPem(privateKey),
      certificatePem: forge.pki.certificateToPem(certificate),
      subject: certificate.subject.attributes.map(a => `${a.shortName || a.name}=${a.value}`).join(", "),
      issuer: certificate.issuer.attributes.map(a => `${a.shortName || a.name}=${a.value}`).join(", "),
      serialNumber: certificate.serialNumber,
      validFrom: certificate.validity.notBefore,
      validTo: certificate.validity.notAfter
    };
  } catch (error) {
    throw new Error("Falha ao abrir certificado PFX: " + error.message);
  }
}

export function assinarXmlEvento(xml, { privateKeyPem, certificatePem }) {
  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certificatePem,
    canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1"
  });

  sig.addReference({
    xpath: "//*[local-name(.)='evtCAT']",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
    ],
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1"
  });

  sig.computeSignature(xml, {
    location: {
      reference: "//*[local-name(.)='evtCAT']",
      action: "append"
    }
  });

  return sig.getSignedXml();
}
