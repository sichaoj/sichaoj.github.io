const button=document.querySelector('.menu-button');const menu=document.querySelector('.mobile-nav');if(button&&menu){button.addEventListener('click',()=>{const open=menu.classList.toggle('open');button.setAttribute('aria-expanded',String(open));});}

(() => {
  if (location.hostname !== 'sichaoj.github.io') return;

  const tracker = document.createElement('script');
  tracker.async = true;
  tracker.src = 'https://sichaoj-site-analytics.fionajiang0314.workers.dev/tracker.js';
  tracker.dataset.endpoint = 'https://sichaoj-site-analytics.fionajiang0314.workers.dev/collect';
  document.head.append(tracker);
})();
