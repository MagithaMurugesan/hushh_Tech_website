// cloud-run/email-template-api/emails/SalesNotification.js
// Gmail-safe: NO Tailwind, NO JS. Table-based + inline styles.
// Plus Jakarta Sans font with Arial fallback for Gmail compatibility.

const escapeHtml = (val = "") =>
  String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const stripHtml = (val = "") =>
  String(val)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function SalesNotification(input = {}) {
  const d = input || {};

  // Palette
  const C = {
    primary: "#0088cc",
    bg: "#f5f7f8",
    card: "#ffffff",
    border: "#f3f4f6",
    gray900: "#111827",
    gray800: "#1f2937",
    gray700: "#374151",
    gray600: "#4b5563",
    gray500: "#6b7280",
    gray400: "#9ca3af",
    gray300: "#d1d5db",
  };

  // Font stack - Gmail-safe: Plus Jakarta Sans with Google Sans/Roboto fallbacks
  // Gmail doesn't support webfonts, so we use Google Sans/Roboto as fallbacks
  const fontFamily = "'Plus Jakarta Sans','Google Sans',Roboto,Arial,Helvetica,sans-serif";

  // ---- URLs ----
  const logoUrl = escapeHtml(d.logoUrl ?? "https://www.hushhtech.com/images/hushh-logo-email.png");
  const siteUrl = escapeHtml(d.siteUrl ?? "https://www.hushhtech.com/");
  const calendlyUrl = escapeHtml(d.calendlyUrl ?? "https://calendly.com/hushh");
  const privacyUrl = escapeHtml(d.privacyUrl ?? "https://www.hushhtech.com/");
  const unsubscribeUrl = escapeHtml(d.unsubscribeUrl ?? "#");

  // ---- Defaults ----
  const subject = escapeHtml(d.subject ?? "Hushh Technologies");
  const previewText = escapeHtml(d.previewText ?? "Hushh Technologies — AI-Powered Investment Management");

  const viewInBrowserText = escapeHtml(d.viewInBrowserText ?? "View in browser");
  const viewInBrowserUrl = escapeHtml(d.viewInBrowserUrl ?? siteUrl);

  const brand = escapeHtml(d.brand ?? "Hushh");
  const siteLinkText = escapeHtml(d.siteLinkText ?? "https://www.hushhtech.com/ 🤫");

  const whoTitle = escapeHtml(d.whoTitle ?? "Who we are");
  const whoP1 = escapeHtml(
    d.whoP1 ??
      "Hushh Technologies is an investment management firm that employs human intelligence & psychology along with AI, data, mathematical and statistical methods in the design and execution of its investment programs."
  );
  const whoP2 = escapeHtml(
    d.whoP2 ??
      "Our mission is to generate sustainable alpha while delivering trust, value, and transparency as an AI powered Berkshire Hathaway."
  );

  const inspTitle = escapeHtml(d.inspTitle ?? "Our Inspiration");
  const inspIntro = escapeHtml(d.inspIntro ?? "We are inspired by the timeless strategies of industry pioneers:");
  const inspItems = Array.isArray(d.inspItems) && d.inspItems.length ? d.inspItems : [
    { name: "Renaissance Technologies:", desc: "Quantitative precision and market-leading algorithms." },
    { name: "Bridgewater Associates:", desc: "Radical transparency and systematic diversification." },
    { name: "Berkshire Hathaway:", desc: "Long-term value creation driven by Warren Buffett and Charlie Munger's enduring philosophy." },
  ];

  const valuesTitle = escapeHtml(d.valuesTitle ?? "Core Values");
  const valuesItems = Array.isArray(d.valuesItems) && d.valuesItems.length ? d.valuesItems : [
    { name: "Human-Centered Design:", desc: "Leveraging psychological insights to optimize decision-making." },
    { name: "AI-Driven Precision:", desc: "Uncovering market inefficiencies using advanced machine learning and analytics." },
    { name: "Quantitative Rigor:", desc: "Applying consistent, scalable, and repeatable strategies backed by mathematics and statistics." },
    { name: "Long-Term Thinking:", desc: "Owning the best free cash flow businesses and compounding returns over decades." },
  ];

  const approachTitle = escapeHtml(d.approachTitle ?? "Our Approach");
  const approachItems = Array.isArray(d.approachItems) && d.approachItems.length ? d.approachItems : [
    { name: "AI Meets Alpha:", desc: "Proprietary algorithms combined with behavioral finance principles to adapt dynamically to markets." },
    { name: "Disciplined Execution:", desc: "Fully data-driven processes to eliminate emotional bias." },
    { name: "Transparency and Integrity:", desc: "Aligned with Bridgewater's principles, ensuring clarity in performance, risks, and fees." },
  ];

  const whyTitle = escapeHtml(d.whyTitle ?? "Why Hushh Technologies?");
  const whyIntro = escapeHtml(d.whyIntro ?? "We are crafting the future of alpha generation by:");
  const whyItems = Array.isArray(d.whyItems) && d.whyItems.length ? d.whyItems : [
    { name: "Blending Human Intuition with Machine Intelligence:", desc: "Merging creativity and decision-making with computational power." },
    { name: "Setting New Standards in Alpha Creation:", desc: "Emulating the best practices of our role models while innovating." },
    { name: "Building Generational Wealth:", desc: "Creating lasting value for investors, employees, and stakeholders." },
  ];

  const quoteText = escapeHtml(
    d.quoteText ?? '"Welcome to the future of investment management, where tradition meets innovation."'
  );

  const ctaText = escapeHtml(d.ctaText ?? "Connect Now");
  const journeyText = escapeHtml(d.journeyText ?? "Start Your Journey");

  const copyrightText = escapeHtml(d.copyrightText ?? "© 2024 Hushh Technologies");
  const footerAddress = escapeHtml(
    d.footerAddress ?? "Hushh 🤫 Technologies LLC, 1021 5th St W, Kirkland, WA 98033"
  );
  const footerReason = escapeHtml(
    d.footerReason ?? "You are receiving this email because you signed up for our newsletter."
  );
  const unsubscribeText = escapeHtml(d.unsubscribeText ?? "Unsubscribe");
  const privacyText = escapeHtml(d.privacyText ?? "Privacy Policy");

  // ---- UI helpers for lists (email-safe) ----
  const bulletRows = (items) =>
    (items || [])
      .map((it) => {
        const name = escapeHtml(it?.name ?? "");
        const desc = escapeHtml(it?.desc ?? "");
        return `
          <tr>
            <td valign="top" width="18" style="padding:6px 10px 0 0;font-family:${fontFamily};font-size:18px;line-height:18px;color:${C.gray600};">•</td>
            <td style="padding:0 0 12px 0;font-family:${fontFamily};font-size:16px;line-height:26px;color:${C.gray600};">
              <strong style="color:${C.gray900};font-weight:600;">${name}</strong> ${desc}
            </td>
          </tr>
        `;
      })
      .join("");

  const orderedRows = (items) =>
    (items || [])
      .map((it, idx) => {
        const name = escapeHtml(it?.name ?? "");
        const desc = escapeHtml(it?.desc ?? "");
        const n = String(idx + 1);
        return `
          <tr>
            <td valign="top" width="26" style="padding:6px 10px 0 0;font-family:${fontFamily};font-size:16px;line-height:16px;color:${C.gray600};font-weight:600;">
              ${n}.
            </td>
            <td style="padding:0 0 12px 0;font-family:${fontFamily};font-size:16px;line-height:26px;color:${C.gray600};">
              <strong style="color:${C.gray900};font-weight:600;">${name}</strong> ${desc}
            </td>
          </tr>
        `;
      })
      .join("");

  // ---- HTML ----
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${subject}</title>
    <!--[if mso]>
    <style type="text/css">
      body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
    </style>
    <![endif]-->
    <style>
      /* Litmus-recommended @font-face method for non-Gmail clients */
      @media screen {
        @font-face {
          font-family: 'Plus Jakarta Sans';
          font-style: normal;
          font-weight: 400;
          src: url(https://fonts.gstatic.com/s/plusjakartasans/v8/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_qU79TR_V.woff2) format('woff2');
        }
        @font-face {
          font-family: 'Plus Jakarta Sans';
          font-style: normal;
          font-weight: 600;
          src: url(https://fonts.gstatic.com/s/plusjakartasans/v8/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_KUn9TR_V.woff2) format('woff2');
        }
        @font-face {
          font-family: 'Plus Jakarta Sans';
          font-style: normal;
          font-weight: 700;
          src: url(https://fonts.gstatic.com/s/plusjakartasans/v8/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_EEn9TR_V.woff2) format('woff2');
        }
        @font-face {
          font-family: 'Plus Jakarta Sans';
          font-style: normal;
          font-weight: 800;
          src: url(https://fonts.gstatic.com/s/plusjakartasans/v8/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_d0n9TR_V.woff2) format('woff2');
        }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:${C.bg};font-family:${fontFamily};-webkit-font-smoothing:antialiased;">
    <div style="display:none;font-size:1px;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
      ${previewText}
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${C.bg};">
      <!-- View in browser -->
      <tr>
        <td align="center" style="padding:40px 12px 18px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;">
            <tr>
              <td align="center" style="font-family:${fontFamily};font-size:12px;line-height:16px;color:${C.gray400};font-weight:500;">
                <a href="${viewInBrowserUrl}" target="_blank" style="color:${C.gray400};text-decoration:none;">
                  ${viewInBrowserText}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Card -->
      <tr>
        <td align="center" style="padding:0 12px 20px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
            style="width:600px;max-width:600px;background-color:${C.card};border-radius:16px;overflow:hidden;border:1px solid ${C.border};box-shadow:0 4px 12px rgba(0,0,0,0.05);">

            <!-- Logo Header -->
            <tr>
              <td align="center" style="padding:48px 24px 24px 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center">
                      <a href="${siteUrl}" target="_blank">
                        <img src="${logoUrl}" alt="${brand}" width="48" height="48" style="display:block;width:48px;height:48px;border-radius:12px;box-shadow:0 8px 20px rgba(0,136,204,0.2);" />
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-top:12px;">
                      <span style="font-family:${fontFamily};font-size:26px;line-height:28px;color:${C.gray900};font-weight:800;letter-spacing:-0.5px;">
                        ${brand}<span style="color:${C.primary};">.</span>
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding:0 32px 40px 32px;">

                <!-- Who we are -->
                <div style="font-family:${fontFamily};font-size:30px;line-height:36px;color:${C.gray900};font-weight:800;letter-spacing:-0.5px;margin:0 0 12px 0;">
                  ${whoTitle}
                </div>

                <div style="margin:0 0 16px 0;">
                  <a href="${siteUrl}" target="_blank"
                    style="color:${C.primary};text-decoration:underline;font-family:${fontFamily};font-size:14px;line-height:18px;font-weight:500;">
                    ${siteLinkText}
                  </a>
                </div>

                <div style="font-family:${fontFamily};font-size:16px;line-height:26px;color:${C.gray600};margin:0 0 12px 0;">
                  ${whoP1}
                </div>

                <div style="font-family:${fontFamily};font-size:16px;line-height:26px;color:${C.gray600};margin:0 0 24px 0;">
                  ${whoP2}
                </div>

                <!-- Our Inspiration -->
                <div style="font-family:${fontFamily};font-size:20px;line-height:26px;color:${C.gray900};font-weight:700;margin:24px 0 10px 0;">
                  ${inspTitle}
                </div>

                <div style="font-family:${fontFamily};font-size:16px;line-height:26px;color:${C.gray600};margin:0 0 12px 0;">
                  ${inspIntro}
                </div>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 8px 0;">
                  ${bulletRows(inspItems)}
                </table>

                <!-- Core Values -->
                <div style="font-family:${fontFamily};font-size:20px;line-height:26px;color:${C.gray900};font-weight:700;margin:24px 0 10px 0;">
                  ${valuesTitle}
                </div>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 8px 0;">
                  ${orderedRows(valuesItems)}
                </table>

                <!-- Our Approach -->
                <div style="font-family:${fontFamily};font-size:20px;line-height:26px;color:${C.gray900};font-weight:700;margin:24px 0 10px 0;">
                  ${approachTitle}
                </div>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 8px 0;">
                  ${bulletRows(approachItems)}
                </table>

                <!-- Why Hushh -->
                <div style="font-family:${fontFamily};font-size:20px;line-height:26px;color:${C.gray900};font-weight:700;margin:24px 0 10px 0;">
                  ${whyTitle}
                </div>

                <div style="font-family:${fontFamily};font-size:16px;line-height:26px;color:${C.gray600};margin:0 0 12px 0;">
                  ${whyIntro}
                </div>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 12px 0;">
                  ${bulletRows(whyItems)}
                </table>

                <!-- Quote -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid ${C.border};margin-top:16px;">
                  <tr>
                    <td style="padding:20px 0;">
                      <div style="font-family:${fontFamily};font-size:18px;line-height:28px;color:${C.gray800};font-weight:600;font-style:italic;text-align:center;">
                        ${quoteText}
                      </div>
                    </td>
                  </tr>
                </table>

                <!-- CTA Button - Bulletproof table-based centering -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:20px;">
                  <tr>
                    <td align="center">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td align="center" bgcolor="${C.primary}" style="background-color:${C.primary};border-radius:12px;box-shadow:0 10px 24px rgba(0,136,204,0.25);">
                            <a href="${calendlyUrl}" target="_blank"
                              style="display:inline-block;padding:16px 48px;font-family:${fontFamily};font-size:18px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">
                              ${ctaText}
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>
          </table>

          <!-- Footer (centered) -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="400"
            style="width:400px;max-width:400px;margin-top:24px;">
            
            <!-- Centered Connect Button in Footer - Bulletproof table-based centering -->
            <tr>
              <td align="center" style="padding:0 0 20px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" bgcolor="${C.primary}" style="background-color:${C.primary};border-radius:10px;box-shadow:0 8px 20px rgba(0,136,204,0.2);">
                      <a href="${calendlyUrl}" target="_blank"
                        style="display:inline-block;padding:14px 32px;font-family:${fontFamily};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                        ${journeyText}
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            
            <tr>
              <td align="center" style="font-family:${fontFamily};font-size:10px;line-height:14px;color:${C.gray400};font-weight:700;text-transform:uppercase;letter-spacing:3px;padding:0 0 12px 0;">
                ${copyrightText}
              </td>
            </tr>
            <tr>
              <td align="center" style="font-family:${fontFamily};font-size:12px;line-height:20px;color:${C.gray400};padding:0 0 12px 0;">
                ${footerAddress}<br/>
                ${footerReason}
              </td>
            </tr>
            <tr>
              <td align="center" style="font-family:${fontFamily};font-size:12px;line-height:16px;color:${C.gray400};font-weight:600;">
                <a href="${unsubscribeUrl}" target="_blank" style="color:${C.gray400};text-decoration:underline;">${unsubscribeText}</a>
                <span style="color:${C.gray300};padding:0 8px;">•</span>
                <a href="${privacyUrl}" target="_blank" style="color:${C.gray400};text-decoration:underline;">${privacyText}</a>
              </td>
            </tr>
          </table>

        </td>
      </tr>

      <tr><td style="height:20px;line-height:20px;font-size:0;">&nbsp;</td></tr>
    </table>
  </body>
</html>`;

  const text = [
    `${stripHtml(brand)}.`,
    "",
    stripHtml(whoTitle),
    stripHtml(siteUrl),
    "",
    stripHtml(whoP1),
    "",
    stripHtml(whoP2),
    "",
    stripHtml(inspTitle),
    stripHtml(inspIntro),
    ...inspItems.map((x) => `- ${stripHtml(x.name)} ${stripHtml(x.desc)}`),
    "",
    stripHtml(valuesTitle),
    ...valuesItems.map((x, i) => `${i + 1}. ${stripHtml(x.name)} ${stripHtml(x.desc)}`),
    "",
    stripHtml(approachTitle),
    ...approachItems.map((x) => `- ${stripHtml(x.name)} ${stripHtml(x.desc)}`),
    "",
    stripHtml(whyTitle),
    stripHtml(whyIntro),
    ...whyItems.map((x) => `- ${stripHtml(x.name)} ${stripHtml(x.desc)}`),
    "",
    stripHtml(quoteText),
    "",
    `${stripHtml(ctaText)}: ${calendlyUrl}`,
    `${stripHtml(journeyText)}: ${calendlyUrl}`,
    "",
    stripHtml(copyrightText),
    stripHtml(footerAddress),
    stripHtml(footerReason),
    `${stripHtml(unsubscribeText)}: ${stripHtml(unsubscribeUrl)} | ${stripHtml(privacyText)}: ${privacyUrl}`,
  ].join("\n");

  return { subject, html, text };
}
