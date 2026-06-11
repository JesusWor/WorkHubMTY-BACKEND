export interface EventEmailPayload {
  guestName: string;
  eventTitle: string;
  startTime: Date;
  endTime: Date;
  creatorName: string;
  creatorTitle: string | null;
  detailsText: string | null;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Monterrey',
  });
}

function formatTime(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Monterrey',
    });
  return `${fmt(start)} – ${fmt(end)} (CST)`;
}

export function buildEventInvitationEmail(payload: EventEmailPayload): string {
  const {
    guestName,
    eventTitle,
    startTime,
    endTime,
    creatorName,
    creatorTitle,
    detailsText,
  } = payload;

  const organizerLine = creatorTitle
    ? `${creatorName} · ${creatorTitle}`
    : creatorName;

  const detailsBlock = detailsText
    ? `
        <tr>
          <td style="padding:0 40px 32px;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;">
              Event details
            </p>
            <p style="margin:0;font-size:14px;color:#333333;line-height:1.7;white-space:pre-line;font-family:Arial,Helvetica,sans-serif;">
              ${detailsText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
            </p>
          </td>
        </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Event Invitation – ${eventTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f0f0;padding:32px 0;">
    <tr>
      <td align="center">

        <!-- Email container -->
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.12);">

          <!-- ── Header ── -->
          <tr>
            <td style="background:#A100FF;padding:28px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;font-family:Arial,Helvetica,sans-serif;">
                    Accenture<span style="display:inline-block;width:8px;height:8px;background:#ffffff;border-radius:50%;margin-left:2px;vertical-align:middle;position:relative;top:-2px;"></span>
                  </td>
                  <td align="right" style="font-size:11px;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:1.5px;font-family:Arial,Helvetica,sans-serif;">
                    Event invitation
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Hero band ── -->
          <tr>
            <td style="background:#f7f2ff;border-left:4px solid #A100FF;padding:28px 40px;">
              <p style="margin:0 0 6px;font-size:11px;color:#A100FF;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">
                You're invited
              </p>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#1a1a1a;line-height:1.25;font-family:Arial,Helvetica,sans-serif;">
                ${eventTitle}
              </h1>
            </td>
          </tr>

          <!-- ── Greeting ── -->
          <tr>
            <td style="padding:32px 40px 0;">
              <p style="margin:0 0 16px;font-size:15px;color:#1a1a1a;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">
                Hello <strong>${guestName}</strong>,
              </p>
              <p style="margin:0;font-size:14px;color:#444444;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
                You have been invited to participate in an upcoming Accenture event. Please review the details below.
              </p>
            </td>
          </tr>

          <!-- ── Meta card ── -->
          <tr>
            <td style="padding:20px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#fafafa;border:1px solid #e8e8e8;border-radius:4px;padding:16px 20px;">
                <tr>
                  <td style="padding-bottom:10px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:11px;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:0.5px;min-width:64px;padding-right:12px;vertical-align:top;padding-top:1px;font-family:Arial,Helvetica,sans-serif;">Date</td>
                        <td style="font-size:13px;color:#1a1a1a;line-height:1.4;font-family:Arial,Helvetica,sans-serif;">${formatDate(startTime)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:10px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:11px;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:0.5px;min-width:64px;padding-right:12px;vertical-align:top;padding-top:1px;font-family:Arial,Helvetica,sans-serif;">Time</td>
                        <td style="font-size:13px;color:#1a1a1a;line-height:1.4;font-family:Arial,Helvetica,sans-serif;">${formatTime(startTime, endTime)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:11px;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:0.5px;min-width:64px;padding-right:12px;vertical-align:top;padding-top:1px;font-family:Arial,Helvetica,sans-serif;">Organizer</td>
                        <td style="font-size:13px;color:#1a1a1a;line-height:1.4;font-family:Arial,Helvetica,sans-serif;">${organizerLine}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Divider ── -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #ececec;margin:4px 0;">
            </td>
          </tr>

          <!-- ── Details text (conditional) ── -->
          ${detailsBlock}

          <!-- ── Footer ── -->
          <tr>
            <td style="background:#1a1a1a;padding:20px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:13px;color:#888888;font-family:Arial,Helvetica,sans-serif;">
                    <span style="color:#A100FF;font-weight:700;">Accenture</span> · WorkHub
                  </td>
                  <td align="right" style="font-size:11px;color:#555555;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">
                    © ${new Date().getFullYear()} Accenture. All rights reserved.<br>
                    This message was sent to an external guest.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Email container -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}
