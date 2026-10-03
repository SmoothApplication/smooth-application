// Applicants whose balance is under the amount a reviewer typically expects get an offer of help from us,
// with a link to pay our fees. The payment page is set once through NEXT_PUBLIC_FEES_PAYMENT_URL (for
// example a Paystack or Flutterwave payment page); until it is set, the button opens WhatsApp to the founder
// with the details filled in, so nobody hits a dead link.
import { FOUNDER_WHATSAPP_NUMBER } from '@/lib/statement/supportContact';

export const MIN_BALANCE_NGN = 3_000_000;

export function needsHelpWithBalance(totalBalance: number): boolean {
  return totalBalance > 0 && totalBalance < MIN_BALANCE_NGN;
}

export function shortfall(totalBalance: number): number {
  return Math.max(0, MIN_BALANCE_NGN - totalBalance);
}

export function helpWhatsAppHref(totalBalance: number, visaName: string): string {
  const msg =
    `Hi! My bank balance (₦${Math.round(totalBalance).toLocaleString('en-NG')}) is below ₦3,000,000 for my ${visaName} application. ` +
    'Please can you help me with how to strengthen my application?';
  return `https://wa.me/${FOUNDER_WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

export function feesPaymentHref(totalBalance: number, visaName: string): string {
  const url = (process.env.NEXT_PUBLIC_FEES_PAYMENT_URL || '').trim();
  return url || helpWhatsAppHref(totalBalance, visaName);
}

export function hasFeesPaymentLink(): boolean {
  return !!(process.env.NEXT_PUBLIC_FEES_PAYMENT_URL || '').trim();
}
