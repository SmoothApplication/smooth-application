import { needsHelpWithBalance, shortfall, feesPaymentHref, helpWhatsAppHref, MIN_BALANCE_NGN } from '../helpOffer';

describe('help offer for balances under ₦3,000,000', () => {
  it('flags only balances under the minimum', () => {
    expect(needsHelpWithBalance(2229805)).toBe(true);
    expect(needsHelpWithBalance(MIN_BALANCE_NGN)).toBe(false);
    expect(needsHelpWithBalance(0)).toBe(false);
    expect(shortfall(2229805)).toBe(770195);
  });
  it('falls back to WhatsApp when no payment link is configured', () => {
    delete process.env.NEXT_PUBLIC_FEES_PAYMENT_URL;
    expect(feesPaymentHref(2000000, 'Standard Visitor visa')).toBe(helpWhatsAppHref(2000000, 'Standard Visitor visa'));
  });
  it('uses the configured payment page', () => {
    process.env.NEXT_PUBLIC_FEES_PAYMENT_URL = 'https://paystack.com/pay/example';
    expect(feesPaymentHref(2000000, 'x')).toBe('https://paystack.com/pay/example');
    delete process.env.NEXT_PUBLIC_FEES_PAYMENT_URL;
  });
});
