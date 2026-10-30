// Player reports / feedback: a Gmail address, a message and up to two screenshots, sent from the game straight to the
// developer's inbox (the player never sees the developer's address). Mail goes out through the Resend HTTPS API
// (free hosts such as Render block normal SMTP). Set on the server:  RESEND_API_KEY  and  REPORT_TO_EMAIL.
// Without them the report is saved to DATA_DIR/reports instead, so nothing is lost.
import express from 'express';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { byTokenString } from './accounts.js';
import { inboxAddress } from './inbox.js';

const TO = process.env.REPORT_TO_EMAIL || inboxAddress(), KEY = process.env.RESEND_API_KEY, APP_PASS = process.env.GMAIL_APP_PASSWORD;
const FROM = process.env.REPORT_FROM_EMAIL || 'The Last Ritual <onboarding@resend.dev>';
const DIR = process.env.DATA_DIR || path.resolve('data');
const hits = new Map(); // ip -> [timestamps]  (3 reports per hour per player)

export function mountReport(app) {
  app.post('/api/report', express.json({ limit: '9mb' }), async (req, res) => {
    try {
      const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
      const now = Date.now(), recent = (hits.get(ip) || []).filter((t) => now - t < 3600000);
      if (recent.length >= 3) return res.json({ ok: false, error: 'You have sent a few reports already. Please try again in a while.' });
      const b = req.body || {};
      const email = String(b.email || '').trim().slice(0, 120), message = String(b.message || '').trim().slice(0, 4000);
      if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email)) return res.json({ ok: false, error: 'Please enter a valid Gmail address so we can reply.' });
      if (message.length < 5) return res.json({ ok: false, error: 'Please write a few words about your report or opinion.' });
      const images = (Array.isArray(b.images) ? b.images : []).slice(0, 2).map((d, i) => {
        const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(d || ''));
        if (!m || m[2].length > 3.4e6) return null;
        return { filename: `screenshot-${i + 1}.${m[1].split('/')[1].replace('jpeg', 'jpg')}`, content: m[2] };
      }).filter(Boolean);
      const user = byTokenString(String(req.headers.authorization || '').replace(/^Bearer /, ''));
      hits.set(ip, [...recent, now]);
      const subject = `[The Last Ritual] Report from ${user?.name || 'a guest'}`;
      const text = `From: ${email}\nPlayer: ${user?.name || 'guest'}\nDevice: ${String(b.device || '').slice(0, 200)}\nTime: ${new Date().toISOString()}\n\n${message}\n\n(Reply to this e-mail to answer the player.)`;
      let sent = false;
      if (APP_PASS) { // Gmail itself: the address above is both sender and receiver, no other service involved
        try {
          for (const port of [465, 587]) {
            try {
              const tr = nodemailer.createTransport({ host: 'smtp.gmail.com', port, secure: port === 465, auth: { user: TO, pass: APP_PASS }, connectionTimeout: 9000, greetingTimeout: 9000, socketTimeout: 15000 });
              await tr.sendMail({ from: `The Last Ritual <${TO}>`, to: TO, replyTo: email, subject, text, attachments: images.map((i) => ({ filename: i.filename, content: i.content, encoding: 'base64' })) });
              sent = true; break;
            } catch (e) { console.error('gmail smtp', port, e.message); }
          }
        } catch (e) { console.error(e); }
      }
      if (sent) { /* delivered through Gmail */ } else if (KEY && TO) {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: FROM, to: [TO], reply_to: email, subject, text, attachments: images }),
        });
        if (!r.ok) { console.error('report mail failed', r.status, await r.text()); return res.json({ ok: false, error: 'The report could not be delivered right now. Please try again later.' }); }
      } else {
        fs.mkdirSync(path.join(DIR, 'reports'), { recursive: true });
        fs.writeFileSync(path.join(DIR, 'reports', `${now}.json`), JSON.stringify({ email, subject, text, images }));
        console.warn('REPORT saved to disk (set RESEND_API_KEY + REPORT_TO_EMAIL to e-mail them):', subject);
      }
      res.json({ ok: true });
    } catch (e) { console.error(e); res.json({ ok: false, error: 'Something went wrong. Please try again.' }); }
  });
}
