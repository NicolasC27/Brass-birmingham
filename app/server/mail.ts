/* ------------------------------------------------------------------ */
/* The post.                                                           */
/*                                                                     */
/* Two letters leave the house: the one that proves an address is      */
/* yours, and the one that lets you choose a new password. With        */
/* RESEND_API_KEY set they go through Resend's HTTP API (no dependency, */
/* one fetch); without it they are printed on the server's console —   */
/* enough to run the house on one machine and follow the link by hand. */
/* ------------------------------------------------------------------ */

import { trIn } from '@/i18n';
import type { Lang } from '@/i18n';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  /** headers of the post's own, such as the one-click way out of a list */
  headers?: Record<string, string>;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
  /** the letters kept on the counter — only the console post keeps any */
  readonly kept?: Mail[];
}

export interface Letters {
  /** the address the links point at (the app, not the server) */
  appUrl: string;
  verify(to: string, name: string, token: string): Mail;
  reset(to: string, name: string, token: string): Mail;
}

export function letters(appUrl: string): Letters {
  const base = appUrl.replace(/\/+$/, '');
  return {
    appUrl: base,
    verify: (to, name, token) => ({
      to,
      subject: 'Blackrail — your seat at the register',
      text: [
        `${name},`,
        '',
        'An account at the Blackrail register was opened with this address.',
        'Follow the link to prove it is yours; the tables open once it is.',
        '',
        `${base}/account/verify/${token}`,
        '',
        'If you did not open it, ignore this letter: the account stays shut.',
        '',
        '— The Blackrail telegraph office',
      ].join('\n'),
    }),
    reset: (to, name, token) => ({
      to,
      subject: 'Blackrail — a new password',
      text: [
        `${name},`,
        '',
        'Someone asked for a new password for your Blackrail account.',
        'Follow the link within the hour to choose one:',
        '',
        `${base}/account/reset/${token}`,
        '',
        'If it was not you, ignore this letter: your password stands.',
        '',
        '— The Blackrail telegraph office',
      ].join('\n'),
    }),
  };
}

/** the letters to the waiting list, each in its reader's language: the
 *  one that asks the address to answer, and a circular with its way out.
 *  With the office's public address known, a circular also carries the
 *  one-click way out the mail services read (RFC 8058) */
export interface WaitLetters {
  confirm(to: string, lang: Lang, token: string): Mail;
  circular(to: string, lang: Lang, leave: string, subject: string, body: string): Mail;
}

export function waitLetters(appUrl: string, officeUrl = ''): WaitLetters {
  const base = appUrl.replace(/\/+$/, '');
  const office = officeUrl.replace(/\/+$/, '');
  return {
    confirm: (to, lang, token) => ({
      to,
      subject: trIn(lang, 'landing.letter.confirmSubject'),
      text: trIn(lang, 'landing.letter.confirmText', { link: `${base}/avant-premiere/confirmer/${token}` }),
    }),
    circular: (to, lang, leave, subject, body) => ({
      to,
      subject,
      text: `${body.trim()}\n\n--\n${trIn(lang, 'landing.letter.footer', { link: `${base}/avant-premiere/retrait/${leave}` })}\n`,
      headers: office
        ? { 'List-Unsubscribe': `<${office}/waitlist/leave?t=${leave}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
        : undefined,
    }),
  };
}

/** the post as the environment configures it */
export function mailerFromEnv(env: NodeJS.ProcessEnv = process.env): Mailer {
  const key = env.RESEND_API_KEY?.trim();
  const from = env.MAIL_FROM?.trim() || 'Blackrail <onboarding@resend.dev>';
  if (key) return resendMailer(key, from);
  return consoleMailer();
}

/** letters printed on the console, and kept on the counter for the
 *  /letters page — the house on one machine, where no post calls */
export function consoleMailer(out: (line: string) => void = (l) => console.log(l)): Mailer {
  const kept: Mail[] = [];
  return {
    kept,
    async send(mail) {
      kept.unshift(mail);
      kept.splice(50);
      out(`--- letter to ${mail.to} · ${mail.subject}`);
      for (const [k, v] of Object.entries(mail.headers ?? {})) out(`    ${k}: ${v}`);
      for (const line of mail.text.split('\n')) out(`    ${line}`);
      out('---');
    },
  };
}

/** letters through Resend (https://resend.com), one HTTP call each */
export function resendMailer(apiKey: string, from: string): Mailer {
  return {
    async send(mail) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text, ...(mail.headers ? { headers: mail.headers } : {}) }),
      });
      if (!res.ok) throw new Error(`resend: ${res.status} ${await res.text().catch(() => '')}`);
    },
  };
}
