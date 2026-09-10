(function(){
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if(!reduceMotion){
    var blobs = document.createElement('div');
    blobs.className = 'bg-blobs';
    blobs.setAttribute('aria-hidden', 'true');
    blobs.innerHTML = '<span class="bg-blob b1"></span><span class="bg-blob b2"></span><span class="bg-blob b3"></span><span class="bg-blob b4"></span>';
    document.body.insertBefore(blobs, document.body.firstChild);
  }

  if(reduceMotion || !('IntersectionObserver' in window)){ return; }

  var candidates = document.querySelectorAll(
    '[class*="card"],[class*="tile"],[class*="-item"],[class*="chip"],[class*="wrap"],[class*="-panel"],[class*="-row"],[class*="-bar"]'
  );
  var targets = Array.prototype.filter.call(candidates, function(el){
    return !el.closest('.hero, .page-hero, header.nav, footer, .pay-panel');
  });

  targets.forEach(function(el, i){
    el.classList.add('reveal');
    el.style.transitionDelay = (i % 6) * 60 + 'ms';
  });

  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, {threshold:.12, rootMargin:'0px 0px -40px 0px'});

  targets.forEach(function(el){ io.observe(el); });
})();
