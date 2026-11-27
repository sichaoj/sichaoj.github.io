const button=document.querySelector('.menu-button');const menu=document.querySelector('.mobile-nav');if(button&&menu){button.addEventListener('click',()=>{const open=menu.classList.toggle('open');button.setAttribute('aria-expanded',String(open));});}

(() => {
  // Set this to the public measurement ID of the site's GA4 web stream.
  const measurementId = '';
  if (!/^G-[A-Z0-9]+$/.test(measurementId) || location.hostname !== 'sichaoj.github.io') return;

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }

  function sanitizedPageUrl(value) {
    if (!value) return '';
    const url = new URL(value);
    return url.origin + url.pathname;
  }

  gtag('js', new Date());
  gtag('config', measurementId, {
    page_location: sanitizedPageUrl(location.href),
    page_referrer: sanitizedPageUrl(document.referrer),
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
  document.head.append(script);

  document.addEventListener('click', trackKeyLink);
  document.addEventListener('auxclick', trackKeyLink);

  function trackKeyLink(event) {
    if (event.type === 'auxclick' && event.button !== 1) return;
    const link = event.target.closest('main a[href]');
    if (!link) return;

    const url = new URL(link.href);
    if (url.protocol === 'mailto:') {
      gtag('event', 'key_link_click', { link_destination: 'email' });
      return;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
    const isExternal = url.origin !== location.origin;
    if (!isExternal && !/\.pdf$/i.test(url.pathname)) return;

    gtag('event', 'key_link_click', {
      link_destination: url.hostname + url.pathname
    });
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
      gtag('event', 'article_reading_depth', { depth_milestone: milestones.shift() + '%' });
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
