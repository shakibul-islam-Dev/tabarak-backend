const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

interface LayoutOptions {
  title: string;
  preheader?: string;
  body: string;
}

export function emailLayout({ title, preheader, body }: LayoutOptions): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f4;font-family:Helvetica,Arial,sans-serif;color:#1c1917;">
    ${preheader ? `<span style="display:none;visibility:hidden;opacity:0;height:0;width:0;">${escapeHtml(preheader)}</span>` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e7e5e4;">
            <tr>
              <td style="padding:24px 32px;border-bottom:1px solid #f0efee;">
                <strong style="font-size:20px;letter-spacing:0.02em;">TABARK</strong>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${escapeHtml(title)}</h1>
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #f0efee;color:#78716c;font-size:12px;">
                You received this email because of your account activity at Tabark.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function button(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;background:#1c1917;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">${escapeHtml(label)}</a></p>`;
}

export function text(value: string): string {
  return `<p style="margin:0 0 16px;line-height:1.6;color:#44403c;">${escapeHtml(value)}</p>`;
}

export const templates = {
  verification(name: string, url: string): { subject: string; html: string } {
    return {
      subject: 'Verify your Tabark email address',
      html: emailLayout({
        title: 'Verify your email',
        preheader: 'Confirm your email address to activate your Tabark account.',
        body:
          text(`Hi ${name || 'there'},`) +
          text('Confirm your email address to finish creating your Tabark account.') +
          button(url, 'Verify email') +
          text('If you did not create this account, you can safely ignore this email.'),
      }),
    };
  },
  passwordReset(name: string, url: string): { subject: string; html: string } {
    return {
      subject: 'Reset your Tabark password',
      html: emailLayout({
        title: 'Reset your password',
        preheader: 'Use the link below to choose a new password.',
        body:
          text(`Hi ${name || 'there'},`) +
          text('We received a request to reset your Tabark password.') +
          button(url, 'Reset password') +
          text('This link expires in one hour. If you did not request a reset, ignore this email.'),
      }),
    };
  },
  welcome(name: string): { subject: string; html: string } {
    return {
      subject: 'Welcome to Tabark',
      html: emailLayout({
        title: 'Welcome to Tabark',
        preheader: 'Your Tabark account is ready.',
        body:
          text(`Hi ${name || 'there'},`) +
          text('Thanks for joining Tabark. Explore our latest products and curated collections.') +
          button('/', 'Start shopping'),
      }),
    };
  },
  orderConfirmation(orderNumber: string, total: string): { subject: string; html: string } {
    return {
      subject: `Tabark order ${orderNumber} confirmed`,
      html: emailLayout({
        title: 'We received your order',
        preheader: `Order ${orderNumber} has been received.`,
        body:
          text(`Your order ${orderNumber} has been created successfully.`) +
          text(`Order total: ${total}`) +
          text('We will email you again when your order status changes.'),
      }),
    };
  },
  orderStatusUpdate(orderNumber: string, status: string): { subject: string; html: string } {
    return {
      subject: `Tabark order ${orderNumber} is now ${status.toLowerCase()}`,
      html: emailLayout({
        title: 'Order status updated',
        preheader: `Order ${orderNumber}: ${status}`,
        body:
          text(`Your order ${orderNumber} status changed to ${status}.`) +
          text('Thank you for shopping with Tabark.'),
      }),
    };
  },
  newsletterConfirmation(url: string): { subject: string; html: string } {
    return {
      subject: 'Confirm your Tabark newsletter subscription',
      html: emailLayout({
        title: 'Confirm your subscription',
        preheader: 'One click to join the Tabark newsletter.',
        body:
          text('Please confirm that you would like to receive Tabark news and offers.') +
          button(url, 'Confirm subscription'),
      }),
    };
  },
};
