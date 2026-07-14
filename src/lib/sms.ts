/**
 * SMS-сервис — абстракция над провайдером отправки кодов.
 *
 * Dev-режим: код всегда 000000, выводится в консоль.
 * Production: Twilio (когда SMS_ENABLED=true и заданы TWILIO_* переменные).
 */

const isDev = process.env.NODE_ENV !== 'production';
const smsEnabled = process.env.SMS_ENABLED === 'true';

interface SmsResult {
  success: boolean;
  code: string;
  provider: 'dev' | 'twilio';
  sid?: string;
}

export async function sendSmsCode(phone: string): Promise<SmsResult> {
  // Dev: всегда 000000, просто логируем
  if (isDev || !smsEnabled) {
    const code = '000000';
    console.log(`[SMS DEV] Code for ${phone}: ${code}`);
    return { success: true, code, provider: 'dev' };
  }

  // Production: Twilio
  const code = String(Math.floor(100000 + Math.random() * 900000));

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.error('[SMS] Twilio not configured — TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER required');
    // Fallback: возвращаем код, но не отправляем (для тестирования без Twilio)
    console.log(`[SMS FALLBACK] Code for ${phone}: ${code}`);
    return { success: true, code, provider: 'dev' };
  }

  try {
    const message = `Your NailMasters verification code: ${code}`;
    const body = new URLSearchParams({ To: phone, From: from, Body: message });
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${auth}`,
        },
        body: body.toString(),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[SMS] Twilio error:', err);
      return { success: false, code, provider: 'twilio' };
    }

    const data = await res.json();
    console.log(`[SMS] Sent to ${phone}, SID: ${data.sid}`);
    return { success: true, code, provider: 'twilio', sid: data.sid };
  } catch (err) {
    console.error('[SMS] Twilio request failed:', err);
    return { success: false, code, provider: 'twilio' };
  }
}
