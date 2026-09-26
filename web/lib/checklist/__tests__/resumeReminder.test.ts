// Ported scenarios from index.html's buildResumeReminderMessage/updateResumeReminderLinks
// (~line 6448-6478).

import { buildResumeReminderMessage, buildWhatsAppReminderHref, buildEmailReminderHref } from '../resumeReminder';

describe('buildResumeReminderMessage', () => {
  test('includes the visa name, what to bring, and the resume link', () => {
    const msg = buildResumeReminderMessage(
      'Standard Visitor visa',
      'my international passport',
      'https://smooth-application-five.vercel.app/checklist/uk/passport'
    );
    expect(msg).toContain('Reminder to myself: finish my Smooth Application Standard Visitor visa checklist.');
    expect(msg).toContain('What I need to have ready: my international passport');
    expect(msg).toContain('Continue where I left off: https://smooth-application-five.vercel.app/checklist/uk/passport');
    expect(msg).toContain('SAME phone');
  });

  test('is a short, plain-text message (not the full status dump)', () => {
    const msg = buildResumeReminderMessage('Visitor visa', 'my last 3–6 months of bank statements', 'https://example.com/x');
    expect(msg.split('\n').length).toBeLessThanOrEqual(6);
  });
});

describe('buildWhatsAppReminderHref', () => {
  test('builds a wa.me link with no fixed recipient, text URL-encoded', () => {
    const message = 'Reminder to myself\n\nline two';
    const href = buildWhatsAppReminderHref(message);
    expect(href).toBe('https://wa.me/?text=' + encodeURIComponent(message));
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
  });
});

describe('buildEmailReminderHref', () => {
  test('builds a mailto: link with encoded subject and body', () => {
    const message = 'Reminder to myself\n\nline two';
    const href = buildEmailReminderHref(message);
    expect(href).toBe(
      'mailto:?subject=' +
        encodeURIComponent('Reminder: finish my Smooth Application checklist') +
        '&body=' +
        encodeURIComponent(message)
    );
  });
});
