(function () {
  const timeline = document.querySelector('.about-timeline');
  if (!timeline) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = Array.from(timeline.querySelectorAll('.timeline-item'));
  const mobileQuery = window.matchMedia('(max-width: 768px)');

  function storyForItem(item) {
    const artifact = item.dataset.artifact;
    if (!artifact) {
      const unit = item.closest('.timeline-unit');
      return unit ? unit.querySelector('.timeline-story:not([data-for])') : null;
    }
    const panel = item.closest('.timeline-unit--pair');
    return panel ? panel.querySelector(`.timeline-story[data-for="${artifact}"]`) : null;
  }

  function getOpenItem() {
    return timeline.querySelector('.timeline-item.is-open');
  }

  function setActiveStory(activeItem) {
    timeline.querySelectorAll('.timeline-story.is-active').forEach((story) => {
      story.classList.remove('is-active');
    });

    if (!activeItem) return;

    const story = storyForItem(activeItem);
    if (story) story.classList.add('is-active');
  }

  function restoreOpenStory() {
    setActiveStory(getOpenItem());
  }

  function closeAllExcept(activeItem) {
    items.forEach((item) => {
      if (item === activeItem) return;
      item.classList.remove('is-open');
      const trigger = item.querySelector('.timeline-trigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
    setActiveStory(activeItem);
  }

  items.forEach((item) => {
    const trigger = item.querySelector('.timeline-trigger');
    if (!trigger) return;

    trigger.addEventListener('click', () => {
      const wasOpen = item.classList.contains('is-open');
      closeAllExcept(null);
      if (!wasOpen) {
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        setActiveStory(item);
      }
    });

    if (!mobileQuery.matches) {
      item.addEventListener('mouseenter', () => setActiveStory(item));
      item.addEventListener('mouseleave', () => {
        if (!item.classList.contains('is-open')) restoreOpenStory();
      });
      item.addEventListener('focusin', () => setActiveStory(item));
      item.addEventListener('focusout', (event) => {
        if (!item.contains(event.relatedTarget) && !item.classList.contains('is-open')) {
          restoreOpenStory();
        }
      });
    }
  });

  const gallery = document.querySelector('.about-gallery');
  if (gallery && !prefersReducedMotion && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    observer.observe(gallery);
  } else if (gallery) {
    gallery.classList.add('is-visible');
  }
})();
