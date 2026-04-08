import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatCurrency, formatDate } from '../lib/utils';
import type { ReceiptData } from '../types';

function buildReceiptHtml(data: ReceiptData): string {
  const { installment, sale, client, paidAmount, paidDate } = data;
  const remaining = installment.expected_amount - paidAmount;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #1a1a2e; }
    .page { max-width: 600px; margin: 0 auto; padding: 40px 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 3px solid #6366F1; margin-bottom: 28px; }
    .brand { font-size: 22px; font-weight: 800; color: #6366F1; letter-spacing: -0.5px; }
    .brand-sub { font-size: 12px; color: #888; margin-top: 2px; }
    .receipt-id { text-align: right; }
    .receipt-id-label { font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 1px; }
    .receipt-id-value { font-size: 18px; font-weight: 700; color: #1a1a2e; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 10px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .field-label { font-size: 11px; color: #888; margin-bottom: 3px; }
    .field-value { font-size: 15px; font-weight: 600; color: #1a1a2e; }
    .amount-box { background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 2px solid #10B981; border-radius: 16px; padding: 24px; text-align: center; margin: 28px 0; }
    .amount-label { font-size: 12px; color: #059669; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 6px; }
    .amount-value { font-size: 42px; font-weight: 800; color: #059669; }
    .divider { border: none; border-top: 1px solid #f0f0f0; margin: 20px 0; }
    .installment-badge { display: inline-block; background: #EEF2FF; color: #6366F1; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 700; }
    .remaining { display: flex; justify-content: space-between; align-items: center; background: #fafafa; border-radius: 10px; padding: 14px 16px; }
    .remaining-label { font-size: 13px; color: #666; }
    .remaining-value { font-size: 15px; font-weight: 700; color: ${remaining > 0 ? '#EF4444' : '#10B981'}; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
    .footer-left { font-size: 11px; color: #aaa; line-height: 1.6; }
    .footer-status { font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 8px; background: ${remaining <= 0 ? '#f0fdf4' : '#fff7ed'}; color: ${remaining <= 0 ? '#059669' : '#D97706'}; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="brand">Clientes & Stock</div>
        <div class="brand-sub">Sistema de Gestión Comercial</div>
      </div>
      <div class="receipt-id">
        <div class="receipt-id-label">Recibo N°</div>
        <div class="receipt-id-value">${String(installment.id).padStart(6, '0')}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Información del cliente</div>
      <div class="grid-2">
        <div>
          <div class="field-label">Nombre</div>
          <div class="field-value">${client.name}</div>
        </div>
        <div>
          <div class="field-label">DNI</div>
          <div class="field-value">${client.dni || '—'}</div>
        </div>
        <div>
          <div class="field-label">Teléfono</div>
          <div class="field-value">${client.phone || '—'}</div>
        </div>
        <div>
          <div class="field-label">Dirección</div>
          <div class="field-value">${client.address || '—'}</div>
        </div>
      </div>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">Detalle de la venta</div>
      <div class="grid-2">
        <div>
          <div class="field-label">Producto / Servicio</div>
          <div class="field-value">${sale.product_name || `Venta #${sale.id}`}</div>
        </div>
        <div>
          <div class="field-label">Cuota</div>
          <span class="installment-badge">${installment.installment_number} de ${sale.installments_count}</span>
        </div>
        <div>
          <div class="field-label">Vencimiento</div>
          <div class="field-value">${formatDate(installment.due_date)}</div>
        </div>
        <div>
          <div class="field-label">Fecha de pago</div>
          <div class="field-value">${formatDate(paidDate)}</div>
        </div>
      </div>
    </div>

    <div class="amount-box">
      <div class="amount-label">Monto abonado</div>
      <div class="amount-value">${formatCurrency(paidAmount)}</div>
    </div>

    ${remaining > 0 ? `
    <div class="remaining">
      <span class="remaining-label">Saldo pendiente de esta cuota</span>
      <span class="remaining-value">${formatCurrency(remaining)}</span>
    </div>
    ` : ''}

    <div class="footer">
      <div class="footer-left">
        Emitido el ${formatDate(new Date().toISOString().split('T')[0])}<br>
        Total venta: ${formatCurrency(sale.total_amount)}
      </div>
      <div class="footer-status">${remaining <= 0 ? '✓ CUOTA PAGADA' : '⏳ PAGO PARCIAL'}</div>
    </div>
  </div>
</body>
</html>`;
}

export async function generateAndShareReceipt(data: ReceiptData): Promise<void> {
  const html = buildReceiptHtml(data);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Recibo cuota ${data.installment.installment_number} — ${data.client.name}`,
      UTI: 'com.adobe.pdf',
    });
  }
}

export async function printReceipt(data: ReceiptData): Promise<void> {
  const html = buildReceiptHtml(data);
  await Print.printAsync({ html });
}
