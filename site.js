const button=document.querySelector('.menu-button');const menu=document.querySelector('.mobile-nav');if(button&&menu){button.addEventListener('click',()=>{const open=menu.classList.toggle('open');button.setAttribute('aria-expanded',String(open));});}

(() => {
  const endpoint = ''; // Public HTTPS URL of the site analytics Worker.
  if (!endpoint || location.hostname !== 'sichaoj.github.io') return;

  let currentVisitor;
  function visitorForCurrentWeek() {
    // Rotate the browser identifier every Monday in Asia/Shanghai.
    const localDay = new Date(Date.now() + 8 * 3600000);
    localDay.setUTCDate(localDay.getUTCDate() - (localDay.getUTCDay() + 6) % 7);
    const week = localDay.toISOString().slice(0, 10);
    if (currentVisitor?.week === week) return currentVisitor.visitor;

    currentVisitor = { week, visitor: crypto.randomUUID() };
    try {
      const saved = JSON.parse(localStorage.getItem('site-analytics-visitor'));
      if (saved?.week === week && typeof saved.visitor === 'string') {
        currentVisitor = saved;
      } else {
        localStorage.setItem('site-analytics-visitor', JSON.stringify(currentVisitor));
      }
    } catch {
      // Use an ephemeral identifier if storage is unavailable.
    }
    return currentVisitor.visitor;
  }

  function track(kind, detail = '') {
    const body = JSON.stringify({
      id: crypto.randomUUID(), visitor: visitorForCurrentWeek(), kind, path: location.pathname, detail
    });
    fetch(endpoint, { method: 'POST', body, keepalive: true, credentials: 'omit' })
      .catch(() => {});
  }

  track('view');

  document.addEventListener('click', trackKeyLink);
  document.addEventListener('auxclick', trackKeyLink);

  function trackKeyLink(event) {
    if (event.type === 'auxclick' && event.button !== 1) return;
    const link = event.target.closest('main a[href]');
    if (!link) return;

    const url = new URL(link.href);
    if (url.protocol === 'mailto:') {
      track('click', 'email');
      return;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
    const isExternal = url.origin !== location.origin;
    if (!isExternal && !/\.pdf$/i.test(url.pathname)) return;

    track('click', url.hostname + url.pathname);
  }

  const article = document.querySelector('main article');
  if (!location.pathname.startsWith('/writeups/') || !article) return;

  const milestones = [25, 50, 75, 100];
  let pending = false;

  function checkReadingDepth() {
    pending = false;
    if (document.hidden) return;
    const bounds = article.getBoundingClientRect();
    if (bounds.height <= 0 || bounds.top >= window.innerHeight) return;

    const visibleDepth = (window.innerHeight - bounds.top) / bounds.height * 100;
    while (milestones.length && visibleDepth >= milestones[0]) {
      track('depth', String(milestones.shift()));
    }
    if (!milestones.length) {
      window.removeEventListener('scroll', scheduleDepthCheck);
      window.removeEventListener('resize', scheduleDepthCheck);
      window.removeEventListener('load', scheduleDepthCheck);
      document.removeEventListener('visibilitychange', scheduleDepthCheck);
    }
  }

  function scheduleDepthCheck() {
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(checkReadingDepth);
  }

  window.addEventListener('scroll', scheduleDepthCheck, { passive: true });
  window.addEventListener('resize', scheduleDepthCheck);
  window.addEventListener('load', scheduleDepthCheck);
  document.addEventListener('visibilitychange', scheduleDepthCheck);
  scheduleDepthCheck();
})();
