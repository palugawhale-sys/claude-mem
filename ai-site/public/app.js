(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);

  /** Create an element; all text goes through textContent (never innerHTML). */
  function el(tag, opts = {}, children = []) {
    const node = document.createElement(tag);
    if (opts.class) node.className = opts.class;
    if (opts.text != null) node.textContent = String(opts.text);
    if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
    for (const c of children) if (c) node.appendChild(c);
    return node;
  }

  const HEX = /^#[0-9a-fA-F]{3,8}$/;
  const safeAccent = (c) => (typeof c === 'string' && HEX.test(c) ? c : '#6d5efc');

  async function api(path, options) {
    let res;
    try {
      res = await fetch(path, options);
    } catch {
      throw new Error('Could not reach the server. Please check your connection and try again.');
    }
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON body */ }
    if (!res.ok) {
      const err = new Error((data && typeof data.error === 'string' && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    if (data === null) throw new Error('Unexpected response from the server.');
    return data;
  }

  function showError(stateEl, message, onRetry) {
    stateEl.className = 'state error';
    stateEl.replaceChildren(el('p', { text: message }));
    if (onRetry) {
      const b = el('button', { class: 'btn btn-ghost btn-sm', text: 'Try again', attrs: { type: 'button' } });
      b.addEventListener('click', onRetry);
      stateEl.appendChild(b);
    }
  }
  function showLoading(stateEl, text) {
    stateEl.className = 'state';
    stateEl.replaceChildren(el('p', { text }));
  }
  function clearState(stateEl) {
    stateEl.className = 'state';
    stateEl.replaceChildren();
  }

  /* ---------- Hero: prompt + preview ---------- */
  const form = $('#prompt-form');
  const input = $('#prompt-input');
  const btn = $('#prompt-btn');
  const msg = $('#prompt-msg');
  const preview = $('#preview');
  const pvLoading = $('#pv-loading');

  function renderPreview(site) {
    preview.style.setProperty('--accent', safeAccent(site.accent));
    $('#pv-title').textContent = site.title || 'Your Business';
    $('#pv-headline').textContent = site.headline || '';
    const slug = String(site.title || 'yoursite').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'yoursite';
    $('#preview-url').textContent = `${slug}.pagewright.app`;
    const list = $('#pv-sections');
    list.replaceChildren(...(Array.isArray(site.sections) ? site.sections : []).map((s) => el('li', { text: s })));
    preview.classList.remove('flash');
    void preview.offsetWidth;
    preview.classList.add('flash');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = input.value.trim();
    msg.textContent = '';
    if (!prompt) { msg.textContent = 'Please describe your website first.'; input.focus(); return; }
    if (prompt.length > 300) { msg.textContent = 'Please keep it under 300 characters.'; return; }
    btn.disabled = true;
    btn.textContent = 'Generating…';
    pvLoading.hidden = false;
    try {
      const site = await api('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      renderPreview(site);
    } catch (err) {
      msg.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate';
      pvLoading.hidden = true;
    }
  });

  document.querySelectorAll('.chip-sample').forEach((chip) => {
    chip.addEventListener('click', () => {
      input.value = chip.dataset.prompt || '';
      form.requestSubmit();
    });
  });

  /* ---------- Examples ---------- */
  const grid = $('#examples-grid');
  const filters = $('#filters');
  const exState = $('#examples-state');
  let examples = [];
  let activeCategory = 'All';

  function exampleCard(ex) {
    const accent = safeAccent(ex.accent);
    const thumb = el('div', { class: 'thumb' }, [
      el('div', { class: 'thumb-win' }, [
        el('div', { class: 'thumb-bar' }, [el('i'), el('i'), el('i')]),
        el('div', { class: 'thumb-hero' }, [el('i'), el('i')]),
        el('div', { class: 'thumb-blocks' }, [el('i'), el('i'), el('i')]),
      ]),
    ]);
    const body = el('div', { class: 'card-body' }, [
      el('div', { class: 'card-top' }, [
        el('h3', { text: ex.title }),
        el('span', { class: 'tag', text: ex.category }),
      ]),
      el('p', { class: 'desc', text: ex.description }),
      el('p', { class: 'secs', text: Array.isArray(ex.sections) ? ex.sections.join(' · ') : '' }),
      el('p', { class: 'prompt-quote', text: `“${ex.prompt}”` }),
    ]);
    const card = el('article', { class: 'card' }, [thumb, body]);
    card.style.setProperty('--accent', accent);
    thumb.style.setProperty('--accent', accent);
    return card;
  }

  function renderExamples() {
    const list = activeCategory === 'All' ? examples : examples.filter((x) => x.category === activeCategory);
    grid.replaceChildren(...list.map(exampleCard));
    if (!list.length) {
      exState.className = 'state';
      exState.replaceChildren(el('p', { text: 'No examples in this category yet.' }));
    } else clearState(exState);
  }

  function renderFilters() {
    const cats = ['All', ...new Set(examples.map((x) => x.category))];
    filters.replaceChildren(...cats.map((c) => {
      const b = el('button', { class: 'chip', text: c, attrs: { type: 'button', 'aria-pressed': String(c === activeCategory) } });
      b.addEventListener('click', () => {
        activeCategory = c;
        filters.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        renderExamples();
      });
      return b;
    }));
  }

  async function loadExamples() {
    grid.replaceChildren(...[1, 2, 3].map(() => el('div', { class: 'skeleton' })));
    showLoading(exState, 'Loading examples…');
    try {
      const data = await api('/api/examples');
      examples = Array.isArray(data.examples) ? data.examples : [];
      renderFilters();
      renderExamples();
    } catch (err) {
      grid.replaceChildren();
      filters.replaceChildren();
      showError(exState, `Couldn’t load examples. ${err.message}`, loadExamples);
    }
  }

  /* ---------- Pricing ---------- */
  const plansGrid = $('#plans-grid');
  const plansState = $('#plans-state');
  let plans = [];
  let billing = 'monthly';

  function planCard(p) {
    const yearly = billing === 'yearly';
    const price = yearly ? p.priceYearly : p.priceMonthly;
    const free = p.priceMonthly === 0 && p.priceYearly === 0;
    const cta = el('a', {
      class: `btn ${p.highlighted ? 'btn-primary' : 'btn-ghost'} btn-block`,
      text: p.cta,
      attrs: { href: '#waitlist', 'data-plan': p.id },
    });
    cta.addEventListener('click', () => {
      const sel = $('#wl-plan');
      if ([...sel.options].some((o) => o.value === p.id)) sel.value = p.id;
    });
    let billed = '';
    if (!free) billed = yearly ? `Billed yearly ($${price * 12}/yr)` : 'Billed monthly';
    else billed = 'Free forever';
    const card = el('article', { class: `plan${p.highlighted ? ' hl' : ''}` }, [
      p.highlighted ? el('span', { class: 'badge', text: 'Most popular' }) : null,
      el('h3', { text: p.name }),
      el('p', { class: 'tagline', text: p.tagline }),
      el('div', { class: 'price' }, [el('b', { text: `$${price}` }), el('span', { text: '/ month' })]),
      el('p', { class: 'billed', text: billed }),
      el('ul', {}, (p.features || []).map((f) => el('li', { text: f }))),
      cta,
    ]);
    return card;
  }

  function renderPlans() {
    plansGrid.replaceChildren(...plans.map(planCard));
    if (!plans.length) {
      plansState.className = 'state';
      plansState.replaceChildren(el('p', { text: 'Pricing is not available right now.' }));
    } else clearState(plansState);
  }

  document.querySelectorAll('.toggle-opt').forEach((b) => {
    b.addEventListener('click', () => {
      billing = b.dataset.billing;
      document.querySelectorAll('.toggle-opt').forEach((x) => {
        const on = x === b;
        x.classList.toggle('is-active', on);
        x.setAttribute('aria-pressed', String(on));
      });
      renderPlans();
    });
  });

  async function loadPlans() {
    plansGrid.replaceChildren(...[1, 2, 3].map(() => el('div', { class: 'skeleton' })));
    showLoading(plansState, 'Loading plans…');
    try {
      const data = await api('/api/plans');
      plans = Array.isArray(data.plans) ? data.plans : [];
      renderPlans();
    } catch (err) {
      plansGrid.replaceChildren();
      showError(plansState, `Couldn’t load pricing. ${err.message}`, loadPlans);
    }
  }

  /* ---------- Waitlist ---------- */
  const wlForm = $('#waitlist-form');
  const wlMsg = $('#wl-msg');
  const wlBtn = $('#wl-btn');

  function setWl(text, kind) {
    wlMsg.textContent = text;
    wlMsg.className = `form-msg${kind ? ' ' + kind : ''}`;
  }

  wlForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#wl-email').value.trim();
    const plan = $('#wl-plan').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setWl('Please enter a valid email address.', 'error');
      $('#wl-email').focus();
      return;
    }
    wlBtn.disabled = true;
    wlBtn.textContent = 'Joining…';
    setWl('');
    try {
      await api('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, plan }),
      });
      setWl('You’re on the list! We’ll be in touch soon.', 'success');
      wlForm.reset();
      $('#wl-plan').value = plan;
    } catch (err) {
      setWl(err.status === 409 ? 'That email is already on the waitlist.' : err.message, 'error');
    } finally {
      wlBtn.disabled = false;
      wlBtn.textContent = 'Join waitlist';
    }
  });

  loadExamples();
  loadPlans();
})();
