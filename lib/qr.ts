import QRCode from "qrcode";

// QR codes are always generated server-side. The payload is an opaque,
// single-use token — it carries no wallet or price data the device could tamper
// with; the backend resolves the token to a Play Pass at scan time.
export async function generateQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 340,
    color: { dark: "#0b1220", light: "#ffffff" },
  });
}
