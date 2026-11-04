// Send feedback: a message, an optional email for a reply and, if ticked, the app version and browser, posted to the
// site's Cloudflare Worker (worker/feedback.ts). Nothing from the tracker is attached.
import { useState } from 'preact/hooks';
import { track } from '../analytics.ts';
import { openModal } from './hooks.tsx';
import { t } from '../i18n.ts';

const MAX_MESSAGE = 4000;

/** The endpoint next to the app (app/ → ../api/feedback). */
export const FEEDBACK_URL = '../api/feedback';

export function openFeedback(version: string) {
  openModal((close) => <FeedbackForm version={version} close={close} />, { size: 'activity' });
}

type Status = 'editing' | 'sending' | 'sent' | 'failed';

function FeedbackForm({ version, close }: { version: string; close: () => void }) {
  const [status, setStatus] = useState<Status>('editing');
  const [withDevice, setWithDevice] = useState(true);
  const device = `${version} · ${navigator.userAgent}`;

  if (status === 'sent') {
    return (
      <div class="dialog-body">
        <h2 class="dialog-title">{t('feedback.thanks')}</h2>
        <p class="dialog-text">{t('feedback.sent')}</p>
        <div class="dialog-actions"><button class="primary" onClick={close}>{t('common.close')}</button></div>
      </div>
    );
  }

  const onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const message = String(form.get('message')).trim();
    if (!message) return;
    setStatus('sending');
    try {
      const res = await fetch(FEEDBACK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message, email: String(form.get('email')).trim(), website: String(form.get('website')),
          ...(withDevice ? { version, browser: navigator.userAgent } : {}),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      track('feedback');
      setStatus('sent');
    } catch {
      setStatus('failed');
    }
  };

  return (
    <form class="dialog-body feedback" onSubmit={onSubmit}>
      <h2 class="dialog-title">{t('feedback.title')}</h2>
      <p class="dialog-text">{t('feedback.intro')}</p>
      <textarea name="message" rows={6} maxLength={MAX_MESSAGE} required aria-label={t('feedback.message')} placeholder={t('feedback.message')} />
      <input type="email" name="email" maxLength={200} aria-label={t('feedback.email')} placeholder={t('feedback.emailHint')} />
      {/* Honeypot: hidden from people, filled in by spam bots. */}
      <input type="text" name="website" class="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label class="toggle">
        <input type="checkbox" checked={withDevice} onChange={(e) => setWithDevice(e.currentTarget.checked)} />
        <span class="toggle-text"><span>{t('feedback.device')}</span><span class="muted small">{device}</span></span>
      </label>
      {status === 'failed' && <p class="notice">{t('feedback.failed')}</p>}
      <div class="dialog-actions">
        <button type="button" class="secondary" onClick={close}>{t('common.cancel')}</button>
        <button type="submit" class="primary" disabled={status === 'sending'}>{t(status === 'sending' ? 'feedback.sending' : 'feedback.send')}</button>
      </div>
    </form>
  );
}
