(function(){
  if(document.querySelector('.gc-gallery-scene')){
function isImageReady(img){
    return !!(img&&img.complete&&img.naturalWidth>0);
  }

  function initBlurUpGallery(){
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.querySelectorAll('.gc-panel').forEach(panel=>{
      const glass=panel.querySelector('.gc-panel-glass');
      const thumb=glass?.querySelector('.gc-panel-photo-thumb');
      const full=glass?.querySelector('.gc-panel-photo-full');
      if(!glass||!thumb||!full)return;

      const setAccessibleAlt=()=>{
        const label=panel.getAttribute('aria-label');
        if(label)full.alt=label;
      };

      const markPlaceholderReady=()=>{
        glass.classList.add('has-photo');
        panel.classList.add('has-photo');
      };

      const revealFull=(instant)=>{
        if(glass.classList.contains('is-full-loaded'))return;
        setAccessibleAlt();
        markPlaceholderReady();
        glass.classList.add('is-full-loaded');
        if(instant||reducedMotion)glass.classList.add('is-full-loaded-instant');
      };

      if(isImageReady(thumb))markPlaceholderReady();
      else thumb.addEventListener('load',markPlaceholderReady,{once:true});

      if(isImageReady(full)){
        revealFull(true);
        return;
      }

      full.addEventListener('load',()=>revealFull(false),{once:true});
      full.addEventListener('error',()=>{
        if(isImageReady(thumb))markPlaceholderReady();
      },{once:true});
    });
  }

  initBlurUpGallery();

  const modalOverlay=document.getElementById('modal-overlay');
  const modalImage=modalOverlay?.querySelector('.gc-modal-image');
  const MODAL_MS=500;
  let modalCloseTimer=null;

  function resolvePhotoSrc(img){
    if(!img)return '';
    return img.currentSrc||img.getAttribute('src')||img.src||'';
  }

  function openGalleryModal(panel,e){
    if(e){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
    if(!modalOverlay||!modalImage)return;
    const thumb=panel.querySelector('.gc-panel-photo-thumb');
    const full=panel.querySelector('.gc-panel-photo-full');
    const thumbSrc=resolvePhotoSrc(thumb);
    const fullSrc=resolvePhotoSrc(full);
    const fullReady=!!(full&&fullSrc&&isImageReady(full));
    const initialSrc=fullReady?fullSrc:(thumbSrc||fullSrc);

    stopInertia();
    Interaction.setPhase('idle');
    spinTarget=0;
    if(modalCloseTimer){
      clearTimeout(modalCloseTimer);
      modalCloseTimer=null;
    }
    modalImage.src=initialSrc;
    modalImage.alt=panel.getAttribute('aria-label')||'';
    modalOverlay.hidden=false;
    modalOverlay.setAttribute('aria-hidden','false');
    document.body.classList.add('gc-modal-open');
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>modalOverlay.classList.add('is-open'));
    });

    if(full&&fullSrc&&initialSrc!==fullSrc){
      const upgradeToFull=()=>{
        if(!modalOverlay.classList.contains('is-open'))return;
        modalImage.src=fullSrc;
      };
      if(isImageReady(full))upgradeToFull();
      else full.addEventListener('load',upgradeToFull,{once:true});
    }
  }

  function closeGalleryModal(){
    if(!modalOverlay||!modalImage)return;
    modalOverlay.classList.remove('is-open');
    modalOverlay.setAttribute('aria-hidden','true');
    document.body.classList.remove('gc-modal-open');
    if(modalCloseTimer)clearTimeout(modalCloseTimer);
    modalCloseTimer=setTimeout(()=>{
      if(!modalOverlay.classList.contains('is-open')){
        modalOverlay.hidden=true;
        modalImage.removeAttribute('src');
        modalImage.alt='';
      }
      modalCloseTimer=null;
    },MODAL_MS);
  }

  if(modalOverlay){
    modalOverlay.addEventListener('click',e=>{
      if(e.target===modalOverlay||e.target.closest('[data-modal-dismiss]')){
        closeGalleryModal();
      }
    });
  }

  const wrapIndex=(val,max)=>((val%max)+max)%max;

  const gallery=document.getElementById('gc-gallery');
  const scene=document.getElementById('gc-gallery-scene');
  const gestureCatcher=document.getElementById('gesture-catcher');
  if(!gallery)return;

  const panels=[...gallery.querySelectorAll('.gc-panel')];
  const totalPanels=panels.length;
  const angleStep=360/totalPanels;
  let focusFloat=6;
  let focusIndex=6;
  let dragging=false;
  let animating=false;
  let dragVelocity=0;
  let inertiaFrameId=null;
  let lastVelX=0;
  const FRICTION_GLIDE_HIGH=0.91;
  const GLIDE_VELOCITY_THRESHOLD=0.001;
  const MOTION_MS=1200;
  const MOTION_EASE='cubic-bezier(0.19, 1, 0.22, 1)';
  const BASE_SPIN=0.14;
  const DRAG_GAIN=2.65;
  const VELOCITY_GAIN=3.15;
  const VELOCITY_BLEND=0.72;
  const RING_Z=800;
  const TILT_MAX_DEG=5;
  let spinRate=1;
  let spinTarget=1;

  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const Interaction={
    phase:'idle',
    session:null,
    dragRaf:null,
    pendingX:null,
    setPhase(next){
      if(this.phase===next)return;
      const prev=this.phase;
      this.phase=next;
      console.log('[gc-interaction] '+prev+' → '+next);
    },
    reset(){
      if(this.dragRaf){
        cancelAnimationFrame(this.dragRaf);
        this.dragRaf=null;
      }
      this.pendingX=null;
      this.session=null;
      gestureCatcher.classList.remove('is-active');
      gallery.classList.remove('is-direct','is-snapping');
    },
    releaseCapture(e){
      if(!this.session||typeof gestureCatcher.releasePointerCapture!=='function')return;
      try{gestureCatcher.releasePointerCapture(e.pointerId);}catch(_){}
    }
  };

  function setDirectManipulation(on){
    gestureCatcher.classList.toggle('is-active',on);
    gallery.classList.toggle('is-direct',on);
    if(on)setGalleryMotion(false);
  }

  const INLINE_GALLERY_PROPS=[
    'display','flex','flex-direction','flex-wrap','overflow-x',
    'top','left','width','height','perspective','transform'
  ];

  function isDesktop3D(){
    return window.innerWidth>=768;
  }

  function isMobileLayout(){
    return window.innerWidth<768;
  }

  function clampTilt(v){
    return Math.max(-1,Math.min(1,v));
  }

  function resetSpatialTilt(){
    if(!scene)return;
    if(isMobileLayout()){
      scene.style.removeProperty('transform');
      return;
    }
    scene.style.transform='rotateY(0deg) rotateX(0deg)';
  }

  function updateSpatialTilt(clientX,clientY){
    if(!scene||isMobileLayout()||reduced||Interaction.session){
      if(Interaction.session)resetSpatialTilt();
      return;
    }
    const nx=clampTilt((clientX/window.innerWidth-0.5)*2);
    const ny=clampTilt((clientY/window.innerHeight-0.5)*2);
    scene.style.transform='rotateY('+(nx*TILT_MAX_DEG)+'deg) rotateX('+(-ny*TILT_MAX_DEG)+'deg)';
  }
  function circularDelta(idx,floatIdx){
    let d=idx-floatIdx;
    d-=Math.round(d/totalPanels)*totalPanels;
    return d;
  }

  function setGalleryMotion(on){
    if(on){
      Interaction.setPhase('snapping');
      gallery.classList.add('is-snapping');
      gallery.style.transition='transform '+MOTION_MS+'ms '+MOTION_EASE;
    }else{
      gallery.classList.remove('is-snapping');
      gallery.style.transition='none';
    }
  }

  function clearGalleryInlineStyles(){
    INLINE_GALLERY_PROPS.forEach(prop=>gallery.style.removeProperty(prop));
  }

  function applyDesktopRingAngles(){
    if(!isDesktop3D())return;
    panels.forEach((panel,idx)=>{
      panel.style.setProperty('--panel-angle',String(idx*angleStep));
    });
  }

  function applyMobileEngine(){
    clearGalleryInlineStyles();
    gallery.style.display='flex';
    gallery.style.removeProperty('transform');
    resetSpatialTilt();
    stopInertia();
    spinTarget=0;
    spinRate=0;
    panels.forEach(panel=>{
      panel.style.removeProperty('transform');
    });
    panels[6]?.scrollIntoView({inline:'center',block:'nearest'});
  }

  function applyDesktopEngine(){
    if(!isDesktop3D())return;
    clearGalleryInlineStyles();
    applyDesktopRingAngles();
    renderFocus(focusFloat);
    spinTarget=dragging||animating?0:1;
  }

  function setLayoutEngine(){
    if(isDesktop3D()){
      applyDesktopEngine();
      if(!desktopExtrasStarted&&!reduced){
        desktopExtrasStarted=true;
        startDesktopExtras();
      }
    }else{
      applyMobileEngine();
    }
  }

  function renderFocus(floatIdx,opts={}){
    const {animate=false}=opts;
    focusFloat=floatIdx;
    const nearestWrapped=wrapIndex(Math.round(floatIdx),totalPanels);
    focusIndex=nearestWrapped;
    gallery.style.setProperty('--gc-focus',floatIdx);

    if(isDesktop3D()){
      if(animate)setGalleryMotion(true);
      else if(!dragging&&!inertiaFrameId)setGalleryMotion(false);
      const targetRotation=floatIdx*-angleStep;
      gallery.style.transform='rotateY('+targetRotation+'deg)';
    }else{
      gallery.style.removeProperty('transform');
    }

    panels.forEach((panel,idx)=>{
      const delta=circularDelta(idx,floatIdx);
      const abs=Math.abs(delta);
      panel.style.setProperty('--gc-delta-abs',abs);

      if(isDesktop3D()){
        const angleOffset=delta*angleStep;
        const panelAngle=idx*angleStep;
        const scale=1-(Math.abs(angleOffset)/180)*0.2;
        panel.style.transform=
          'rotateY('+panelAngle+'deg) translateZ('+RING_Z+'px) scale('+scale+')';
      }else{
        panel.style.removeProperty('transform');
      }

      const isCurrent=idx===focusIndex;
      panel.classList.toggle('is-focused',isCurrent);
      if(isCurrent)panel.setAttribute('aria-current','true');
      else panel.removeAttribute('aria-current');
    });
  }

  function shortestFloatToIndex(targetIdx){
    let d=targetIdx-focusFloat;
    d-=Math.round(d/totalPanels)*totalPanels;
    return focusFloat+d;
  }

  function stopInertia(){
    if(inertiaFrameId!=null){
      cancelAnimationFrame(inertiaFrameId);
      inertiaFrameId=null;
    }
    Interaction.reset();
    dragVelocity=0;
    dragging=false;
    animating=false;
    gallery.style.transition='none';
    Interaction.setPhase('idle');
  }

  /* ── Unified Physics Engine ───────────────────────────────────────────── */

  function getDragHubRect(){
    const hub=document.querySelector('.gc-spatial-hub');
    return(hub||scene).getBoundingClientRect();
  }

  function getPanelsPerPx(){
    const r=getDragHubRect();
    return(totalPanels/Math.max(r.width,1))*DRAG_GAIN;
  }

  function focusFloatFromPointer(clientX,session){
    const s=session||Interaction.session;
    if(!s)return focusFloat;
    return s.float0-(clientX-s.x0)*getPanelsPerPx();
  }

  function samplePointerVelocity(clientX){
    const rawDx=clientX-lastVelX;
    lastVelX=clientX;
    const r=getDragHubRect();
    const frameVel=-(rawDx/Math.max(r.width,1))*totalPanels*VELOCITY_GAIN;
    dragVelocity=dragVelocity*(1-VELOCITY_BLEND)+frameVel*VELOCITY_BLEND;
  }

  function applyInertia(deltaPanels,opts={}){
    if(!isDesktop3D())return focusFloat;
    const {velocity,snap,snapTarget,setFloat}=opts;

    if(velocity!==undefined)dragVelocity=velocity;

    if(snap&&snapTarget!==undefined){
      setDirectManipulation(false);
      focusFloat=snapTarget;
      setGalleryMotion(true);
      renderFocus(focusFloat,{animate:true});
      return focusFloat;
    }

    if(setFloat!==undefined)focusFloat=setFloat;
    else focusFloat+=deltaPanels;

    setGalleryMotion(false);
    renderFocus(focusFloat);
    return focusFloat;
  }

  function snapToPanel(targetIdx){
    const endFloat=shortestFloatToIndex(wrapIndex(targetIdx,totalPanels));
    if(reduced||isMobileLayout()){
      applyInertia(endFloat-focusFloat);
      return;
    }
    animating=true;
    spinTarget=0;
    applyInertia(0);
    requestAnimationFrame(()=>{
      applyInertia(0,{snap:true,snapTarget:endFloat});
      setTimeout(()=>{
        setGalleryMotion(false);
        animating=false;
        spinTarget=1;
        Interaction.setPhase('idle');
      },MOTION_MS);
    });
  }

  function animateTo(targetIdx){
    stopInertia();
    snapToPanel(targetIdx);
  }

  function navigateCarousel(dir){
    if(!isDesktop3D())return;
    stopInertia();
    spinTarget=0;
    snapToPanel(wrapIndex(focusIndex+dir,totalPanels));
  }

  function tickSpinRate(){
    if(spinRate<spinTarget)spinRate=Math.min(spinTarget,spinRate+0.045);
    else if(spinRate>spinTarget)spinRate=Math.max(spinTarget,spinRate-0.11);
  }

  function startGlide(){
    if(!isDesktop3D())return;
    Interaction.setPhase('gliding');
    setDirectManipulation(true);
    cancelAnimationFrame(inertiaFrameId);
    function glide(){
      if(Math.abs(dragVelocity)>GLIDE_VELOCITY_THRESHOLD){
        applyInertia(dragVelocity);
        dragVelocity*=FRICTION_GLIDE_HIGH;
        inertiaFrameId=requestAnimationFrame(glide);
        return;
      }
      inertiaFrameId=null;
      dragVelocity=0;
      setDirectManipulation(false);
      snapToPanel(wrapIndex(Math.round(focusFloat),totalPanels));
    }
    inertiaFrameId=requestAnimationFrame(glide);
  }

  let desktopExtrasStarted=false;

  function initGallery(){
    setLayoutEngine();
  }

  function syncLayoutOnResize(){
    setLayoutEngine();
    syncMobileNav();
  }

  function buildMobileNav(){
    if(!scene)return null;
    if(scene.querySelector('.gc-mobile-nav'))return scene.querySelector('.gc-mobile-nav');
    const nav=document.createElement('div');
    nav.className='gc-mobile-nav';
    nav.setAttribute('aria-hidden','true');

    const prev=document.createElement('button');
    prev.type='button';
    prev.className='gc-mobile-nav__btn gc-mobile-nav__btn--prev';
    prev.setAttribute('aria-label','Scroll left');
    prev.textContent='<';

    const next=document.createElement('button');
    next.type='button';
    next.className='gc-mobile-nav__btn gc-mobile-nav__btn--next';
    next.setAttribute('aria-label','Scroll right');
    next.textContent='>';

    let snapLockedForProgrammaticScroll=false;
    const disableSnapForProgrammaticScroll=()=>{
      gallery.style.setProperty('scroll-snap-type','none','important');
      panels.forEach((panel)=>{
        panel.style.setProperty('scroll-snap-align','none','important');
      });
      snapLockedForProgrammaticScroll=true;
    };
    const restoreSnapIfNeeded=()=>{
      if(!snapLockedForProgrammaticScroll)return;
      gallery.style.removeProperty('scroll-snap-type');
      panels.forEach((panel)=>panel.style.removeProperty('scroll-snap-align'));
      snapLockedForProgrammaticScroll=false;
    };
    const scrollByViewport=(dir)=>{
      disableSnapForProgrammaticScroll();
      const maxLeft=gallery.scrollWidth-gallery.clientWidth;
      const target=gallery.scrollLeft+window.innerWidth*dir;
      gallery.scrollLeft=Math.max(0,Math.min(maxLeft,target));
    };
    gallery.addEventListener('touchstart',restoreSnapIfNeeded,{passive:true});
    prev.addEventListener('click',()=>scrollByViewport(-1));
    next.addEventListener('click',()=>scrollByViewport(1));

    nav.appendChild(prev);
    nav.appendChild(next);
    scene.appendChild(nav);
    return nav;
  }

  function syncMobileNav(){
    if(!scene)return;
    const existing=scene.querySelector('.gc-mobile-nav');
    if(isMobileLayout()){
      buildMobileNav();
    }else if(existing){
      existing.remove();
    }
  }

  function flushDragFrame(){
    Interaction.dragRaf=null;
    const s=Interaction.session;
    if(!s||Interaction.pendingX===null)return;
    const clientX=Interaction.pendingX;
    Interaction.pendingX=null;
    samplePointerVelocity(clientX);
    applyInertia(0,{setFloat:focusFloatFromPointer(clientX,s)});
  }

  function queueDragFrame(clientX){
    Interaction.pendingX=clientX;
    if(Interaction.dragRaf)return;
    Interaction.dragRaf=requestAnimationFrame(flushDragFrame);
  }

  function onCatcherPointerDown(e){
    if(isMobileLayout()||e.button!==0)return;
    stopInertia();
    Interaction.session={
      id:e.pointerId,
      x0:e.clientX,
      float0:focusFloat
    };
    lastVelX=e.clientX;
    dragVelocity=0;
    dragging=true;
    spinTarget=0;
    Interaction.setPhase('dragging');
    setDirectManipulation(true);
    resetSpatialTilt();
    if(typeof gestureCatcher.setPointerCapture==='function'){
      gestureCatcher.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
  }

  function onCatcherPointerMove(e){
    const s=Interaction.session;
    if(isMobileLayout()||!s||s.id!==e.pointerId)return;
    e.preventDefault();
    queueDragFrame(e.clientX);
  }

  function onCatcherPointerUp(e){
    if(isMobileLayout())return;
    const s=Interaction.session;
    if(!s){
      console.warn('[gc-interaction] orphan pointerup: no pointerdown session',{pointerId:e.pointerId});
      return;
    }
    if(s.id!==e.pointerId)return;
    if(Interaction.dragRaf){
      cancelAnimationFrame(Interaction.dragRaf);
      Interaction.dragRaf=null;
      if(Interaction.pendingX!==null){
        samplePointerVelocity(Interaction.pendingX);
        applyInertia(0,{setFloat:focusFloatFromPointer(Interaction.pendingX,s)});
        Interaction.pendingX=null;
      }
    }
    Interaction.releaseCapture(e);
    Interaction.session=null;
    dragging=false;
    spinTarget=1;
    e.preventDefault();
    if(reduced){
      setDirectManipulation(false);
      snapToPanel(wrapIndex(Math.round(focusFloat),totalPanels));
    }else{
      startGlide();
    }
  }

  panels.forEach(panel=>{
    panel.addEventListener('click',e=>openGalleryModal(panel,e));
  });

  gallery.addEventListener('keydown',e=>{
    const panel=e.target.closest('.gc-panel');
    if(!panel)return;
    if(e.key==='Enter'||e.key===' '){
      e.preventDefault();
      openGalleryModal(panel,e);
    }
  });

  function startDesktopExtras(){
    if(!gestureCatcher)return;
    gestureCatcher.addEventListener('pointerdown',onCatcherPointerDown);
    window.addEventListener('pointermove',onCatcherPointerMove,{passive:false});
    window.addEventListener('pointerup',onCatcherPointerUp);
    window.addEventListener('pointercancel',onCatcherPointerUp);

    gallery.addEventListener('wheel',e=>{
      if(isMobileLayout())return;
      if(Math.abs(e.deltaY)<2)return;
      e.preventDefault();
      const dir=e.deltaY>0?1:-1;
      navigateCarousel(dir);
    },{passive:false});

    let lastIdle=performance.now();
    function idleDrift(now){
      if(isMobileLayout()){lastIdle=now;requestAnimationFrame(idleDrift);return;}
      tickSpinRate();
      const dt=Math.min((now-lastIdle)/1000,0.05);
      lastIdle=now;
      if(!dragging&&!animating&&inertiaFrameId==null&&spinRate>0.001){
        applyInertia(dt*BASE_SPIN*spinRate);
      }
      requestAnimationFrame(idleDrift);
    }
    requestAnimationFrame(idleDrift);
  }

  window.addEventListener('pointermove',e=>{
    if(!Interaction.session)updateSpatialTilt(e.clientX,e.clientY);
  },{passive:true});

  window.addEventListener('pointerleave',()=>{
    if(isDesktop3D()&&!reduced)resetSpatialTilt();
  });

  window.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&modalOverlay?.classList.contains('is-open')){
      e.preventDefault();
      closeGalleryModal();
      return;
    }
    if(!isDesktop3D())return;
    if(modalOverlay?.classList.contains('is-open'))return;
    if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;
    e.preventDefault();
    const dir=e.key==='ArrowRight'?1:-1;
    navigateCarousel(dir);
  });

  if(isDesktop3D()){
    applyDesktopRingAngles();
    renderFocus(6);
  }
  setLayoutEngine();
  syncMobileNav();
  window.addEventListener('load',initGallery);
  let resizeTimer;
  window.addEventListener('resize',()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(syncLayoutOnResize,120);
  },{passive:true});

  let scrollTimer;
  gallery.addEventListener('scroll',()=>{
    if(isDesktop3D())return;
    clearTimeout(scrollTimer);
    scrollTimer=setTimeout(()=>{
      const cx=gallery.scrollLeft+gallery.clientWidth/2;
      let best=0;
      let bestDist=Infinity;
      panels.forEach((panel,idx)=>{
        const px=panel.offsetLeft+panel.offsetWidth/2;
        const d=Math.abs(px-cx);
        if(d<bestDist){bestDist=d;best=idx;}
      });
      focusFloat=best;
      const nearestWrapped=wrapIndex(best,totalPanels);
      focusIndex=nearestWrapped;
      panels.forEach((panel,idx)=>{
        const isCurrent=idx===focusIndex;
        panel.classList.toggle('is-focused',isCurrent);
        if(isCurrent)panel.setAttribute('aria-current','true');
        else panel.removeAttribute('aria-current');
      });
    },60);
  },{passive:true});
  }
})();
