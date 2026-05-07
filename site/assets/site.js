// =====================================================================
// Mobile nav toggle + dropdown tap-open + active-link highlighting
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
    });
  }
  document.querySelectorAll('.nav-dropdown > button').forEach(btn => {
    btn.addEventListener('click', e => {
      if (window.innerWidth <= 960) {
        e.preventDefault();
        btn.parentElement.classList.toggle('open');
      }
    });
  });

  // Highlight active nav link by pathname
  const path = location.pathname.replace(/index\.html$/, '').replace(/\/$/, '');
  document.querySelectorAll('.main-nav a').forEach(a => {
    const href = a.getAttribute('href').replace(/index\.html$/, '').replace(/\/$/, '');
    if (href && (href === path || (href !== '' && path.endsWith(href)))) a.classList.add('active');
  });
});

// =====================================================================
// Site-wide CRM webhook config (used by popup + form pages)
// =====================================================================
window.RFS_WEBHOOKS = window.RFS_WEBHOOKS || {
  contact: 'https://api.rainierfacilitysolutions.com/webhooks/contact',
  quote:   'https://api.rainierfacilitysolutions.com/webhooks/quote',
  careers: 'https://api.rainierfacilitysolutions.com/webhooks/careers',
  popup:   'https://api.rainierfacilitysolutions.com/webhooks/popup',
};

// =====================================================================
// Static lead-capture popup — appears on every page once per session
// =====================================================================
(function(){
  const STORAGE_KEY = 'rfs_lead_modal_dismissed_v1';
  const SHOW_DELAY_MS = 3000;

  // Skip if user already dismissed this session
  try { if (sessionStorage.getItem(STORAGE_KEY) === '1') return; } catch(e) {}

  // Build the markup once. Note: the consent block keeps us A2P compliant.
  const HTML = `
<div class="lead-modal-backdrop" id="rfsLeadModal" role="dialog" aria-modal="true" aria-labelledby="rfsLeadTitle">
  <div class="lead-modal">
    <div class="lead-modal-header">
      <button class="lead-modal-close" type="button" aria-label="Close popup">&times;</button>
      <h3 id="rfsLeadTitle">Free Deep Clean For New Customers!</h3>
      <p>New to Rainier? Tell us about your facility and we'll include a free deep clean with your first service agreement.</p>
    </div>
    <div class="lead-modal-body" id="rfsLeadBody">
      <form id="rfsLeadForm" novalidate>
        <div class="form-grid">
          <div class="form-row">
            <label for="rfsLmName">Name <span class="req">*</span></label>
            <input class="input" id="rfsLmName" name="name" type="text" required autocomplete="name">
          </div>
          <div class="form-row">
            <label for="rfsLmBusiness">Business</label>
            <input class="input" id="rfsLmBusiness" name="business" type="text" autocomplete="organization">
          </div>
        </div>
        <div class="form-grid">
          <div class="form-row">
            <label for="rfsLmPhone">Phone <span class="req">*</span></label>
            <input class="input" id="rfsLmPhone" name="phone" type="tel" required autocomplete="tel">
          </div>
          <div class="form-row">
            <label for="rfsLmEmail">Email <span class="req">*</span></label>
            <input class="input" id="rfsLmEmail" name="email" type="email" required autocomplete="email">
          </div>
        </div>
        <div class="form-row">
          <label for="rfsLmService">Service</label>
          <select class="select" id="rfsLmService" name="service">
            <option>Recurring janitorial</option>
            <option>Floor &amp; carpet care</option>
            <option>Exterior cleaning (windows / façade / awning)</option>
            <option>Post-construction</option>
            <option>One-time / deep clean</option>
            <option>Emergency response</option>
            <option>Multi-site portfolio</option>
            <option>Not sure — help me decide</option>
          </select>
        </div>
        <div class="form-row">
          <label for="rfsLmNotes">Notes</label>
          <textarea class="input" id="rfsLmNotes" name="notes" rows="3" placeholder="Square footage, frequency, anything we should know…"></textarea>
        </div>
        <div class="consent-row">
          <label class="consent-label" for="rfsLmSms">
            <input type="checkbox" id="rfsLmSms" name="sms_consent" value="yes">
            <span class="consent-text">
              <strong>SMS notifications (optional).</strong> By checking this box you agree to receive service-related text messages from <strong>Rainier Facility Solutions</strong> at the phone number provided. <strong>Message frequency varies. Msg &amp; data rates may apply.</strong> Reply <strong>STOP</strong> to cancel, <strong>HELP</strong> for help. Consent is not a condition of any purchase. Mobile information will not be shared with third parties or affiliates for marketing or promotional purposes. See our <a href="terms.html#sms-program" target="_blank">SMS Terms</a> and <a href="privacy.html#sms-program" target="_blank">Privacy Policy</a>.
            </span>
          </label>
        </div>
        <button class="btn btn-green btn-lg" type="submit">Claim My Free Deep Clean &rarr;</button>
        <p class="lead-modal-fineprint">By submitting, you agree to our <a href="terms.html" target="_blank">Terms</a> and <a href="privacy.html" target="_blank">Privacy Policy</a>. Free deep clean offer applies to new commercial accounts that sign a recurring service agreement.</p>
      </form>
      <div class="lead-modal-success" id="rfsLeadSuccess" style="display:none">
        <h3>Thanks &mdash; we got it. ✓</h3>
        <p>We'll reply within one business day. For anything urgent, call <a href="tel:+12534475676"><strong>253-447-5676</strong></a>.</p>
      </div>
    </div>
  </div>
</div>`;

  // Path-aware link rewriter — service-page popups need ../terms.html etc.
  const inSubdir = location.pathname.includes('/services/');
  const fixedHTML = inSubdir
    ? HTML.replace(/href="(terms\.html|privacy\.html)/g, 'href="../$1')
        .replace(/href="(terms\.html|privacy\.html)#/g, 'href="../$1#')
    : HTML;

  function inject() {
    // Don't double-inject
    if (document.getElementById('rfsLeadModal')) return;

    const wrap = document.createElement('div');
    wrap.innerHTML = fixedHTML.trim();
    document.body.appendChild(wrap.firstElementChild);

    const modal = document.getElementById('rfsLeadModal');
    const closeBtn = modal.querySelector('.lead-modal-close');
    const form = document.getElementById('rfsLeadForm');
    const success = document.getElementById('rfsLeadSuccess');
    const submitBtn = form.querySelector('button[type=submit]');

    function dismiss() {
      try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch(e) {}
      modal.style.display = 'none';
      // remove from DOM after fade so it can't be tabbed into
      setTimeout(() => modal.remove(), 200);
      document.removeEventListener('keydown', escHandler);
    }

    function escHandler(e) { if (e.key === 'Escape') dismiss(); }

    closeBtn.addEventListener('click', dismiss);
    modal.addEventListener('click', e => { if (e.target === modal) dismiss(); });
    document.addEventListener('keydown', escHandler);

    form.addEventListener('submit', async e => {
      e.preventDefault();
      // Required-field gate
      for (const id of ['rfsLmName', 'rfsLmPhone', 'rfsLmEmail']) {
        const el = document.getElementById(id);
        if (!el.value.trim()) { el.focus(); return; }
      }

      const originalLabel = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';

      const data = {
        form_type: 'popup_lead_form',
        offer: 'Free Deep Clean For New Customers',
        submitted_at: new Date().toISOString(),
        page_url: location.href,
        user_agent: navigator.userAgent,
      };
      for (const el of form.elements) {
        if (!el.name) continue;
        if (el.type === 'checkbox' || el.type === 'radio') {
          if (el.checked) data[el.name] = el.value;
        } else {
          data[el.name] = el.value;
        }
      }

      try {
        const res = await fetch(window.RFS_WEBHOOKS.popup, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
      } catch (err) {
        // Webhook unavailable → soft-success so the demo flow still completes
        console.warn('[RFS] popup webhook unavailable, soft-success:', err.message);
      }

      form.style.display = 'none';
      success.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
      // Mark dismissed so we don't reshow on next page
      try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch(e) {}
    });
  }

  function start() {
    // Slight delay so the page paints first
    setTimeout(inject, SHOW_DELAY_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
