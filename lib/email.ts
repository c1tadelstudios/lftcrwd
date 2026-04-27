import { Resend } from 'resend';

const FROM = 'lftcrwd <hello@lftcrwd.com>';

/**
 * Send a client invite email with a magic login link.
 */
export async function sendInviteEmail({
  to,
  magicLink,
  businessName,
}: {
  to: string;
  magicLink: string;
  businessName?: string;
}): Promise<void> {
  const coachName = businessName || 'Your coach';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited to lftcrwd</title>
</head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo / wordmark -->
          <tr>
            <td style="padding-bottom:32px;">
              <span style="font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#ffffff;">lftcrwd</span>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background:#111111;border-radius:16px;padding:36px 32px;">

              <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#30d158;">
                You're invited
              </p>

              <h1 style="margin:0 0 16px;font-size:28px;font-weight:700;line-height:1.2;color:#ffffff;">
                ${coachName} added you as a client
              </h1>

              <p style="margin:0 0 28px;font-size:17px;line-height:1.6;color:rgba(255,255,255,0.55);">
                lftcrwd is where you'll log your workouts, track nutrition, and stay connected with your coach. Tap the button below to get started — no password needed.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#30d158;border-radius:14px;">
                    <a href="${magicLink}"
                       style="display:inline-block;padding:16px 32px;font-size:17px;font-weight:600;color:#000000;text-decoration:none;border-radius:14px;">
                      Get started →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.3);line-height:1.6;">
                This link expires in 24 hours and can only be used once. If you didn't expect this email, you can safely ignore it.
              </p>

            </td>
          </tr>

          <!-- What to expect section -->
          <tr>
            <td style="padding:24px 0 0;">
              <p style="margin:0 0 16px;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.3);">
                What you can do in the app
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${[
                  ['💪', 'Log workouts', 'Track sets, reps, and weight for every session'],
                  ['🥗', 'Track nutrition', 'Log protein, water, meals, and daily habits'],
                  ['📈', 'See your progress', 'Charts showing your lifts and body weight over time'],
                ].map(([emoji, title, desc]) => `
                <tr>
                  <td style="padding:0 0 16px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:22px;padding-right:14px;vertical-align:top;">${emoji}</td>
                        <td>
                          <p style="margin:0 0 2px;font-size:15px;font-weight:600;color:#ffffff;">${title}</p>
                          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.4);">${desc}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join('')}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:32px;border-top:1px solid rgba(255,255,255,0.08);">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.2);line-height:1.6;">
                Sent by lftcrwd on behalf of ${coachName}.<br />
                <a href="https://app.lftcrwd.com" style="color:rgba(255,255,255,0.3);">app.lftcrwd.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `${coachName} invited you to lftcrwd`,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
