    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('show');
      });
    }, { threshold: 0.14 });

    document.querySelectorAll('.reveal:not(.show)').forEach(el => observer.observe(el));

    document.getElementById('year').textContent = new Date().getFullYear();

    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', e => {
        const target = document.querySelector(link.getAttribute('href'));
        if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      });
    });

    const authOverlay = document.getElementById('authOverlay');
    const authFrame = document.getElementById('authFrame');
    let lastFocusedElement;

    function openAuthDialog(event) {
      event.preventDefault();
      lastFocusedElement = event.currentTarget;
      authFrame.src = '/login';
      authOverlay.hidden = false;
      document.body.classList.add('auth-open');
    }

    function closeAuthDialog() {
      authOverlay.hidden = true;
      authFrame.src = 'about:blank';
      document.body.classList.remove('auth-open');
      lastFocusedElement?.focus();
    }

    document.querySelectorAll('a[href="/login"]').forEach(link => {
      link.addEventListener('click', openAuthDialog);
    });
    authOverlay.addEventListener('click', event => {
      if (event.target === authOverlay) closeAuthDialog();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !authOverlay.hidden) closeAuthDialog();
    });
    window.addEventListener('message', event => {
      if (event.source === authFrame.contentWindow && event.data === 'closeMarkVizAuth') closeAuthDialog();
      if (event.source === authFrame.contentWindow && event.data === 'markvizAuthSuccess') window.location.href = '/dashboard';
    });
