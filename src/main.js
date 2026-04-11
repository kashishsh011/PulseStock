import './style.css'
import Globe from 'globe.gl'
import gsap from 'gsap'
import * as animePkg from 'animejs';
const anime = animePkg.default || animePkg;
import Lenis from '@studio-freight/lenis'

// 1. Initialize Lenis for smooth scroll (even though UI is mostly fixed, good for any internal overflow)
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  direction: 'vertical',
  gestureDirection: 'vertical',
  smooth: true,
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// 2. Clock logic
function updateClock() {
  const now = new Date();
  document.getElementById('clock').innerText = now.toLocaleTimeString('en-US', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// 3. Initialize 3D Globe
const globeContainer = document.getElementById('globeViz');

// Generate some random points to represent global macro/market tensions
const N = 20;
const gData = [...Array(N).keys()].map(() => ({
  lat: (Math.random() - 0.5) * 180,
  lng: (Math.random() - 0.5) * 360,
  maxR: Math.random() * 20 + 3,
  propagationSpeed: (Math.random() - 0.5) * 20 + 1,
  repeatPeriod: Math.random() * 2000 + 200,
  color: Math.random() > 0.5 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(245, 158, 11, 0.8)' // Red or Amber for tension
}));

const world = Globe()
  (globeContainer)
  .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-dark.jpg')
  .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
  .backgroundColor('rgba(0,0,0,0)')
  .ringsData(gData)
  .ringColor('color')
  .ringMaxRadius('maxR')
  .ringPropagationSpeed('propagationSpeed')
  .ringRepeatPeriod('repeatPeriod');

// Auto-rotate globe
world.controls().autoRotate = true;
world.controls().autoRotateSpeed = 0.5;

// Handle window resize for globe
window.addEventListener('resize', () => {
  world.width(window.innerWidth);
  world.height(window.innerHeight);
});


// 4. Initial GSAP Animations
const tl = gsap.timeline();

// Fade in header
tl.from('.top-nav', { y: -50, opacity: 0, duration: 0.8, ease: "power3.out" })
  // Slide in left panel
  .from('.slide-in-left', { x: -50, opacity: 0, duration: 0.6, ease: "power2.out"}, "-=0.4")
  // Slide in right panel
  .from('.slide-in-right', { x: 50, opacity: 0, duration: 0.6, ease: "power2.out"}, "-=0.4")
  // Slide up bottom panel
  .from('.bottom-panel', { y: 50, opacity: 0, duration: 0.6, ease: "power2.out"}, "-=0.4");


// 5. Setup UI interactions
// Tabs logic for Signal Card
const subTabs = document.querySelectorAll('.sub-tab');
subTabs.forEach(tab => {
  tab.addEventListener('click', (e) => {
    // remove active from all subtabs
    subTabs.forEach(t => t.classList.remove('active'));
    // hide all sub panels
    document.querySelectorAll('.sub-panel').forEach(p => {
       p.classList.remove('active');
       p.classList.add('hidden');
    });

    // add active to clicked tab
    const target = e.target;
    target.classList.add('active');

    // show target panel
    const panelId = target.getAttribute('data-panel');
    const panel = document.getElementById('panel-' + panelId);
    panel.classList.remove('hidden');
    panel.classList.add('active');
  });
});

// Use Anime.js for hover effects on stock list
const stockItems = document.querySelectorAll('.stock-item');
stockItems.forEach(item => {
  item.addEventListener('mouseenter', () => {
    if(!item.classList.contains('active')) {
      anime({
        targets: item,
        translateX: 5,
        backgroundColor: 'rgba(255,255,255,0.1)',
        duration: 300,
        easing: 'easeOutSine'
      });
    }
  });
  item.addEventListener('mouseleave', () => {
    if(!item.classList.contains('active')) {
      anime({
        targets: item,
        translateX: 0,
        backgroundColor: 'rgba(0,0,0,0.2)',
        duration: 300,
        easing: 'easeOutSine'
      });
    }
  });

  // Click to change dummy text
  item.addEventListener('click', () => {
    stockItems.forEach(si => {
      si.classList.remove('active');
      anime({ targets: si, translateX: 0, backgroundColor: 'rgba(0,0,0,0.2)', duration: 200 });
    });
    item.classList.add('active');
    
    // Change main card title & signal dummy data based on selection
    const symbol = item.getAttribute('data-stock');
    document.getElementById('current-stock').innerText = symbol;
    
    // Simple UI change animation on selection
    gsap.from('.main-signal-card', { opacity: 0.5, scale: 0.98, duration: 0.3, ease: "power1.out"});
  });
});

// Ticker continuous scroll animation with GSAP
gsap.to('.ticker-content', {
  xPercent: -50,
  ease: "none",
  duration: 20,
  repeat: -1
});

// Top Nav Tabs interaction
const mainTabs = document.querySelectorAll('.top-nav .tab');
mainTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    mainTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Animate a brief flash or feedback when clicking since there's no actual page to load yet
    gsap.fromTo(tab, 
      { backgroundColor: 'rgba(255,255,255,0.2)' },
      { backgroundColor: 'rgba(34, 197, 94, 0.1)', duration: 0.4 }
    );
  });
});
