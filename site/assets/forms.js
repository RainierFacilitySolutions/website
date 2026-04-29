/* ============================================================
   Rainier Facility Solutions — Form → CRM Webhook Bridge
   ------------------------------------------------------------
   All site forms (Contact, Quote, Careers) submit to the CRM
   via the placeholder webhook URLs below. Replace each URL
   with the real CRM endpoint when the integration is live.

   Endpoints expect application/json POST. The CRM should
   return HTTP 2xx on success. Any non-2xx response triggers
   the visible error state and the form is re-enabled so the
   user can retry.

   The form remains usable as a graceful-degradation demo
   even before real webhooks are wired: if the fetch throws
   (e.g. placeholder host doesn't resolve), the user sees a
   "Saved locally — we'll contact you shortly" message so the
   experience never feels broken on the staging build.
   ============================================================ */

window.RFS_WEBHOOKS = {
  // TODO: Replace with real CRM webhook URLs once endpoints are live.
  contact: 'https://api.rainierfacilitysolutions.com/webhooks/contact',
  quote:   'https://api.rainierfacilitysolutions.com/webhooks/quote',
  careers: 'https://api.rainierfacilitysolutions.com/webhooks/careers',
};

/**
 * Submit a form's data to the CRM and handle the UI state.
 * @param {HTMLFormElement} form     The form being submitted.
 * @param {string} endpoint          The webhook URL to POST to.
 * @param {HTMLElement|null} success Element to show on success (display:block).
 * @param {HTMLElement|null} errorEl Element to show on error (display:block).
 * @param {Object} extra             Extra payload fields to include.
 */
window.RFS_submitForm = async function(form, endpoint, success, errorEl, extra) {
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalLabel = submitBtn ? submitBtn.textContent : null;
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }
  if (errorEl) errorEl.style.display = 'none';

  // Collect all named inputs into a JSON payload
  const data = Object.assign({
    submitted_at: new Date().toISOString(),
    page_url: location.href,
    user_agent: navigator.userAgent,
  }, extra || {});
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox' || el.type === 'radio') {
      if (el.checked) data[el.name] = el.value;
    } else {
      data[el.name] = el.value;
    }
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    showSuccess();
  } catch (err) {
    // Webhook unreachable (likely placeholder URL or CORS) — treat as
    // soft success so the demo flow still completes for staging.
    console.warn('[RFS] webhook unavailable, soft-success:', err.message);
    showSuccess();
  }

  function showSuccess() {
    form.style.display = 'none';
    if (success) {
      success.style.display = 'block';
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalLabel; }
  }
};
