/**
 * HydiEms Content Script DLP Guard (DLP-003 Web Upload & DLP-005 Clipboard Guard)
 * Inspects restricted Shadow IT / unapproved AI domains and guards sensitive file uploads or large pastes.
 * Batches DOM updates via requestAnimationFrame to avoid blocking main thread.
 */

(async function initHydiEmsContentDlpGuard() {
  try {
    const policyResp = await chrome.runtime.sendMessage({
      type: 'CHECK_DLP_DOMAIN_POLICY',
      url: window.location.href
    });

    if (!policyResp || !policyResp.ok || policyResp.isPersonalMode || !policyResp.isRestrictedDlpDomain) {
      return;
    }

    const domain = policyResp.domain || window.location.hostname;

    function showDlpBanner(messageText) {
      requestAnimationFrame(() => {
        let banner = document.getElementById('hydiems-dlp-guard-banner');
        if (!banner) {
          banner = document.createElement('div');
          banner.id = 'hydiems-dlp-guard-banner';
          banner.style.cssText = [
            'position:fixed',
            'bottom:16px',
            'right:16px',
            'z-index:2147483647',
            'background:#1e293b',
            'color:#f8fafc',
            'border-left:4px solid #ef4444',
            'padding:10px 14px',
            'border-radius:8px',
            'font-family:system-ui,-apple-system,sans-serif',
            'font-size:12px',
            'box-shadow:0 10px 25px rgba(0,0,0,0.35)'
          ].join(';');
          document.body.appendChild(banner);
        }
        banner.textContent = messageText;
      });
    }

    // DLP-003: Monitor file input uploads on restricted cloud/AI domains
    document.addEventListener(
      'change',
      async (event) => {
        const target = event.target;
        if (target && target.tagName === 'INPUT' && target.type === 'file' && target.files?.length > 0) {
          showDlpBanner(
            `HydiEms DLP-003 Alert: File upload (${target.files[0].name}) on restricted domain "${domain}" has been logged.`
          );
          try {
            await chrome.runtime.sendMessage({
              type: 'REPORT_DLP_INCIDENT',
              incidentCode: 'DLP-003_WEB_FILE_UPLOAD',
              domain,
              url: window.location.href
            });
          } catch (err) {
            console.error('HydiEms DLP-003 report error:', err);
          }
        }
      },
      true
    );

    // DLP-005: Monitor large source-code / credential clipboard pastes on restricted AI domains
    document.addEventListener(
      'paste',
      async (event) => {
        const pastedText = event.clipboardData?.getData('text/plain') || '';
        if (pastedText.length >= 250) {
          showDlpBanner(
            `HydiEms DLP-005 Alert: Large clipboard paste (${pastedText.length} chars) on "${domain}" audited by enterprise policy.`
          );
          try {
            await chrome.runtime.sendMessage({
              type: 'REPORT_DLP_INCIDENT',
              incidentCode: 'DLP-005_CLIPBOARD_PASTE',
              domain,
              url: window.location.href
            });
          } catch (err) {
            console.error('HydiEms DLP-005 report error:', err);
          }
        }
      },
      true
    );
  } catch {
    // Extension context invalidated or restricted internal browser page
  }
})();
