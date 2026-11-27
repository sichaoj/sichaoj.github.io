const button=document.querySelector('.menu-button');const menu=document.querySelector('.mobile-nav');if(button&&menu){button.addEventListener('click',()=>{const open=menu.classList.toggle('open');button.setAttribute('aria-expanded',String(open));});}

(() => {
  // Paste the public script URL from Plausible's Site installation screen here.
  const analyticsScriptUrl = '';
  if (!analyticsScriptUrl || location.hostname !== 'sichaoj.github.io') return;

  const track = window.plausible = function () {
    (track.q ||= []).push(arguments);
  };
  track.init = (options) => { track.o = options; };
  track.init({
    outboundLinks: false,
    fileDownloads: false,
    formSubmissions: false,
    transformRequest(payload) {
      const page = new URL(payload.u);
      // Preserve campaign attribution without collecting arbitrary query parameters.
      for (const key of [...page.searchParams.keys()]) {
        if (!['utm_source', 'utm_medium', 'utm_campaign'].includes(key)) {
          page.searchParams.delete(key);
        }
      }
      page.hash = '';
      payload.u = page.href;
      return payload;
    }
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = analyticsScriptUrl;
  document.head.append(script);

  document.addEventListener('click', trackKeyLink);
  document.addEventListener('auxclick', trackKeyLink);

  function trackKeyLink(event) {
    if (event.type === 'auxclick' && event.button !== 1) return;
    const link = event.target.closest('main a[href]');
    if (!link) return;

    const url = new URL(link.href);
    if (url.protocol === 'mailto:') {
      track('Key Link Click', { props: { destination: 'email' } });
      return;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
    const isExternal = url.origin !== location.origin;
    if (!isExternal && !/\.pdf$/i.test(url.pathname)) return;

    track('Key Link Click', {
      props: { destination: url.hostname + url.pathname }
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
      track('Article Reading Depth', { props: { percent: String(milestones.shift()) } });
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
