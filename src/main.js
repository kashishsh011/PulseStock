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

const world = Globe()
  (globeContainer)
  .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-dark.jpg')
  .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
  .backgroundColor('rgba(0,0,0,0)');

const geoEvents = [
  { name: 'Strait of Hormuz', lat: 26, lng: 56, region: 'me', severity: 'critical', color: '#ef4444', impact: 'Crude +4.2% → Commodity Shock regime → banking margins under pressure' },
  { name: 'ECB Emergency', lat: 50, lng: 10, region: 'eu', severity: 'high', color: '#f59e0b', impact: 'EUR/USD volatile → DXY strengthens → FII outflow risk for Indian equities' },
  { name: 'South China Sea', lat: 15, lng: 114, region: 'ap', severity: 'medium', color: '#3b82f6', impact: 'Shipping route risk → supply chain pressure → mild inflation signal' },
  { name: 'Fed Decision', lat: 38, lng: -77, region: 'us', severity: 'high', color: '#f59e0b', impact: 'US10Y +12bps → rate differential shift → capital flow repricing for Indian banks' },
  { name: 'Ukraine Conflict', lat: 49, lng: 32, region: 'eu', severity: 'critical', color: '#ef4444', impact: 'Energy prices elevated → VIX spike risk → FII panic outflows' },
  { name: 'Taiwan Strait', lat: 24, lng: 121, region: 'ap', severity: 'high', color: '#f59e0b', impact: 'Semiconductor supply risk → IT sector impact → broad market volatility' },
  { name: 'Venezuela Crude', lat: 8, lng: -66, region: 'us', severity: 'medium', color: '#3b82f6', impact: 'Oil supply uncertainty → crude price support → RBI forced action risk' },
  { name: 'Red Sea Shipping', lat: 15, lng: 42, region: 'me', severity: 'critical', color: '#ef4444', impact: 'Trade route disruption → import cost spike → inflation pressure on Indian banks' },
];

world
  .pointsData(geoEvents)
  .pointLat(d => d.lat)
  .pointLng(d => d.lng)
  .pointColor(d => d.color)
  .pointAltitude(0.02)
  .pointRadius(d => d.severity === 'critical' ? 0.5 : d.severity === 'high' ? 0.35 : 0.25)
  .pointLabel(d => `
    <div style="background:rgba(10,14,20,0.95);border:0.5px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 12px;max-width:220px;font-family:Inter,sans-serif">
      <div style="color:#f8fafc;font-size:12px;font-weight:500;margin-bottom:4px">${d.name}</div>
      <div style="font-size:10px;padding:2px 6px;border-radius:4px;display:inline-block;margin-bottom:6px;background:${d.severity==='critical'?'rgba(239,68,68,0.15)':d.severity==='high'?'rgba(245,158,11,0.15)':'rgba(59,130,246,0.15)'};color:${d.color}">${d.severity.toUpperCase()}</div>
      <div style="color:rgba(255,255,255,0.5);font-size:11px;line-height:1.5">${d.impact}</div>
    </div>
  `);

const countryColors = {
  'Oman': '#ef4444', 'Iran': '#ef4444', 'United Arab Emirates': '#ef4444',
  'Germany': '#f59e0b', 'France': '#f59e0b',
  'China': '#3b82f6', 'Philippines': '#3b82f6', 'Vietnam': '#3b82f6',
  'United States of America': '#f59e0b',
  'Ukraine': '#ef4444',
  'Taiwan': '#f59e0b',
  'Venezuela': '#3b82f6',
  'Yemen': '#ef4444', 'Saudi Arabia': '#ef4444'
};
let hoverD;
let globeFeatures = [];
let pathNodes = [];
let capturedCenterLng = 0;

// Morph Projection (Sphere -> Flat)
function projectMorph(lng, lat, progress, centerLng) {
  // FLAT target (Mercator, adjusted for SVG viewport)
  const xf = (lng + 180) * (1000 / 360) * 0.95 + 10;
  const latRad = lat * Math.PI / 180;
  const mercN = Math.log(Math.tan((Math.PI / 4) + (latRad / 2)));
  const yf = Math.max(-1000, Math.min(1500, (650 / 2) - (1000 * mercN / (2 * Math.PI)))) * 1.1 - 40;

  // SPHERE target (Orthographic)
  const R = 300; 
  let dLng = lng - centerLng;
  while (dLng > 180) dLng -= 360;
  while (dLng < -180) dLng += 360;
  let rLng = dLng * Math.PI / 180;

  // Fold back-face to avoid messy crisscrosses at start
  if (progress < 0.05 && Math.cos(rLng) < 0) {
      rLng = Math.sign(rLng) * Math.PI/2; 
  } else if (progress < 1) {
      if (Math.cos(rLng) < 0) {
         const edgeLng = Math.sign(rLng) * Math.PI/2;
         rLng = edgeLng + (rLng - edgeLng) * Math.pow(progress, 0.4); 
      }
  }
  
  const xs = 500 + R * Math.cos(latRad) * Math.sin(rLng);
  // Subtract Y due to SVG coordinates being flipped vs Cartesian
  const ys = 325 - R * Math.sin(latRad);

  // Easing curve (smooth step) - quicker mid-section for punchier feel
  const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

  const x = xs + (xf - xs) * ease;
  const y = ys + (yf - ys) * ease;
  return [x.toFixed(1), y.toFixed(1)];
}

function updateMapMorph(progress) {
  for(let i=0; i<pathNodes.length; i++) {
     let f = pathNodes[i].feature;
     let d = '';
     if (!f.geometry || !f.geometry.coordinates) continue;
     
     if (f.geometry.type === 'Polygon') {
        d += 'M ';
        f.geometry.coordinates[0].forEach((pt, idx) => {
           const [x,y] = projectMorph(pt[0], pt[1], progress, capturedCenterLng);
           d += `${x},${y} ${idx === f.geometry.coordinates[0].length-1 ? 'Z' : 'L '}`;
        });
     } else if (f.geometry.type === 'MultiPolygon') {
        f.geometry.coordinates.forEach(poly => {
           d += ' M ';
           poly[0].forEach((pt, idx) => {
              const [x,y] = projectMorph(pt[0], pt[1], progress, capturedCenterLng);
              d += `${x},${y} ${idx === poly[0].length-1 ? 'Z' : 'L '}`;
           });
        });
     }
     pathNodes[i].node.setAttribute('d', d);
  }
}

function renderFlatMap(features) {
  const mapContainer = document.getElementById('svg-map-container');
  if(!mapContainer) return;
  
  // Add a defs section for the 3D bevel/gradient effect on the paths
  const svgHeader = `<svg class="flat-map-svg" viewBox="0 0 1000 650" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <defs>
      <filter id="bevel3d" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="3" dy="5" stdDeviation="4" flood-color="#000000" flood-opacity="0.8"/>
        <feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer>
      </filter>
      <radialGradient id="oceanGlow" cx="50%" cy="50%" r="50%">
        <stop offset="60%" stop-color="rgba(10,14,20,0)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0.02)"/>
      </radialGradient>
    </defs>
    <!-- Background circle that mimics the globe's ocean when progress=0 -->
    <circle id="ocean-bg" cx="500" cy="325" r="300" fill="url(#oceanGlow)" opacity="1"/>
  `;
  let svgPaths = '';
  
  features.forEach((f, idx) => {
    if (!f.geometry || !f.geometry.coordinates) return;
    const baseColor = countryColors[f.properties.NAME] || countryColors[f.properties.ADMIN];
    const fill = baseColor ? baseColor : 'rgba(200, 200, 200, 0.08)';
    // Removed the slow SVG filter="url(#bevel3d)" entirely from paths. 
    svgPaths += `<path id="path-geo-${idx}" class="map-country" fill="${fill}" data-country="${f.properties.NAME}"></path>`;
  });
  
  mapContainer.innerHTML = svgHeader + svgPaths + '</svg>';
  
  // Cache for performance
  pathNodes = [];
  features.forEach((f, idx) => {
    if (!f.geometry || !f.geometry.coordinates) return;
    const node = document.getElementById(`path-geo-${idx}`);
    if (node) pathNodes.push({ node, feature: f });
  });
  
  // Interactivity
  document.querySelectorAll('.map-country').forEach(p => {
    p.addEventListener('click', () => {
       generateChartData();
    });
    p.style.pointerEvents = 'auto'; 
  });
  
  // Initially map is transparent
  mapContainer.style.opacity = '0';
  updateMapMorph(0);
}

fetch('https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
  .then(res => res.json())
  .then(countries => {
    globeFeatures = countries.features;
    world.polygonsData(countries.features)
      .polygonCapColor(d => {
        const baseColor = countryColors[d.properties.NAME] || countryColors[d.properties.ADMIN];
        if (d === hoverD) return baseColor ? baseColor + 'aa' : 'rgba(34, 197, 94, 0.4)';
        return baseColor ? baseColor + '44' : 'rgba(200, 200, 200, 0.05)';
      })
      .polygonSideColor(() => 'rgba(0, 0, 0, 0.15)')
      .polygonStrokeColor(() => '#111')
      .polygonAltitude(d => d === hoverD ? 0.06 : 0.01)
      .onPolygonHover(d => {
        hoverD = d;
        world.polygonCapColor(world.polygonCapColor());
        world.polygonAltitude(world.polygonAltitude());
      });
      
    // Render the SPA flat map version
    renderFlatMap(globeFeatures);
  });

// Auto-rotate globe
world.controls().autoRotate = true;
world.controls().autoRotateSpeed = 0.5;

// Prevent zooming for SPA layout consistency
world.controls().enableZoom = false;

// Custom SPA scroll transitions: Unrolling the Earth
let activeView = 'earth';
let targetProgress = 0;
let currentProgress = 0;
let lastComputedAnim = -1; // Cache tracker to prevent infinite CPU rendering

lenis.on('scroll', (e) => {
  const h = window.innerHeight;
  let progress = e.scroll / h; 
  if (progress > 1) progress = 1;
  if (progress < 0) progress = 0;
  targetProgress = progress;
  
  // Top nav active state sync immediately
  if(progress > 0.5 && activeView !== 'geo'){
    activeView = 'geo';
    document.querySelectorAll('.top-nav .tab').forEach(t=>t.classList.remove('active'));
    const b = document.querySelector('.top-nav .tab[data-target="geo"]');
    if(b) b.classList.add('active');
  } else if (progress <= 0.5 && activeView !== 'earth') {
    activeView = 'earth';
    document.querySelectorAll('.top-nav .tab').forEach(t=>t.classList.remove('active'));
    const b = document.querySelector('.top-nav .tab[data-target="earth"]');
    if(b) b.classList.add('active');
  }
});

// Decoupled Animation Loop for silky smooth unfolding
function animateUnroll() {
  if (Math.abs(targetProgress - currentProgress) > 0.001) {
      // Much faster catch-up so it feels tightly bound to the mouse wheel
      currentProgress += (targetProgress - currentProgress) * 0.35;
  } else {
      currentProgress = targetProgress;
  }
  
  // Accelerate the visual unroll so it finishes by ~75% of the scroll down
  let computedAnim = currentProgress * 1.35;
  if (computedAnim > 1) computedAnim = 1;

  const svgMap = document.getElementById('svg-map-container');
  const globeCanvas = document.getElementById('globeViz');
  
  if (computedAnim > 0 && capturedCenterLng === 0) {
      capturedCenterLng = world.pointOfView().lng || 0;
      world.controls().autoRotate = false;
  }
  if (computedAnim <= 0) {
      world.controls().autoRotate = true;
      capturedCenterLng = 0; 
  }
  
  // Removed altitude zooming so the globe remains perfectly static during the crossfade
  // Optical illusion crossfade
  const crossfadeRange = 0.25; // Blend over slightly more scroll for butter smoothness
  let gOp = 1 - (computedAnim / crossfadeRange);
  let sOp = computedAnim / (crossfadeRange * 0.5); 
  
  if (gOp < 0) gOp = 0;
  if (sOp > 1) sOp = 1;
  
  if(globeCanvas && globeCanvas.style.opacity !== gOp.toFixed(3)) globeCanvas.style.opacity = gOp.toFixed(3);
  if(svgMap && svgMap.style.opacity !== sOp.toFixed(3)) svgMap.style.opacity = sOp.toFixed(3);
  
  // Perform the intense recalculation ONLY if state changed!
  if (computedAnim !== lastComputedAnim) {
      if (computedAnim > 0 && pathNodes.length > 0) {
         updateMapMorph(computedAnim);
         
         const oceanBg = document.getElementById('ocean-bg');
         if (oceanBg) {
            oceanBg.setAttribute('opacity', (1 - (computedAnim * 2)).toFixed(2));
         }
      }
      
      // Dynamic CSS hardware-accelerated DropShadow toggled only when completely flat
      if (svgMap) {
         if (computedAnim >= 1) {
            svgMap.style.filter = 'drop-shadow(2px 5px 6px rgba(0,0,0,0.4))';
         } else {
            svgMap.style.filter = 'none';
         }
      }
      lastComputedAnim = computedAnim;
  }

  // Auto-minimize the left filter panel based on scrolling down
  const leftPanel = document.getElementById('left-filter-panel');
  if (leftPanel) {
    const minBtnNode = leftPanel.querySelector('.minimize-btn svg');
    if (computedAnim > 0.1 && !leftPanel.classList.contains('minimized')) {
       leftPanel.classList.add('minimized');
       if(minBtnNode) minBtnNode.style.transform = 'rotate(180deg)';
    } else if (computedAnim <= 0.02 && leftPanel.classList.contains('minimized')) {
       leftPanel.classList.remove('minimized');
       if(minBtnNode) minBtnNode.style.transform = 'rotate(0deg)';
    }
  }

  // Smoothly remove bottom news line
  const bottomPanel = document.getElementById('earth-footer');
  if (bottomPanel) {
     bottomPanel.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
     if (computedAnim > 0.05) {
         bottomPanel.style.transform = 'translateY(100px)';
         bottomPanel.style.opacity = '0';
         bottomPanel.style.pointerEvents = 'none';
     } else {
         bottomPanel.style.transform = 'translateY(0px)';
         bottomPanel.style.opacity = '1';
         bottomPanel.style.pointerEvents = 'auto'; // allow clicking if there were links
     }
  }

  requestAnimationFrame(animateUnroll);
}
requestAnimationFrame(animateUnroll);

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
  .from('.bottom-panel', { y: 50, opacity: 0, duration: 0.6, ease: "power2.out"}, "-=0.4")
  .from('.gti-box', { opacity: 0, y: -10, duration: 0.4 }, '-=0.2')
  .from('#gti-sparkline', { opacity: 0, duration: 0.5 }, '-=0.2')
  .from('.region-grid', { opacity: 0, y: 10, duration: 0.4 }, '-=0.3')
  .from('.scenario-block', { opacity: 0, y: 10, duration: 0.3, stagger: 0.1 }, '-=0.2')
  .from('.signal-bars', { opacity: 0, duration: 0.4 }, '-=0.2');


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
    
    // Animate a brief flash or feedback
    gsap.fromTo(tab, 
      { backgroundColor: 'rgba(255,255,255,0.2)' },
      { backgroundColor: 'rgba(34, 197, 94, 0.1)', duration: 0.4 }
    );
    
    // SPA scrolling logic
    const target = tab.getAttribute('data-target');
    if (target === 'earth') lenis.scrollTo('#earth-view', { duration: 1.5 });
    if (target === 'geo') lenis.scrollTo('#geo-view', { duration: 1.5 });
  });
});

// Geo Map specific scripts
function generateChartData() {
  const canvas = document.getElementById('commodity-chart');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  
  const isUp = Math.random() > 0.5;
  const color = isUp ? '#22c55e' : '#ef4444';
  
  // Generate random walk
  let val = h / 2;
  const points = [];
  for(let x=0; x<=w; x+=10) {
    val += (Math.random() - 0.5) * 30;
    if(val < 20) val = 20;
    if(val > h-20) val = h-20;
    points.push([x, val]);
  }
  
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for(let i=1; i<points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Fill gradient
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0, color + '66'); // alpha
  grad.addColorStop(1, color + '00');
  ctx.fillStyle = grad;
  ctx.fill();
  
  // update header
  const pct = (Math.random()*4).toFixed(2);
  const ind = document.getElementById('active-asset-indicator');
  if (ind) {
     ind.innerText = (isUp?'▲ ':'▼ ') + pct + '%';
     ind.className = 'c-indicator ' + (isUp?'green':'red');
  }
}

// Initial draw
setTimeout(generateChartData, 1000);

// Asset tabs logic
document.querySelectorAll('.asset-card').forEach(card => {
  card.addEventListener('click', () => {
     document.querySelectorAll('.asset-card').forEach(c => c.classList.remove('active'));
     card.classList.add('active');
     
     const title = document.getElementById('active-asset-title');
     if (title) {
        title.innerHTML = card.dataset.asset + ` <span style="opacity:0.4; font-size:10px;">/ USD</span>`;
     }
     generateChartData();
  });
});

// GTI Sparkline
const sparkCanvas = document.getElementById('gti-sparkline');
if (sparkCanvas) {
  const sCtx = sparkCanvas.getContext('2d');
  const points = [58, 61, 59, 64, 63, 67, 65, 70, 68, 72, 69, 68];
  const w = sparkCanvas.width, h = sparkCanvas.height;
  const min = 50, max = 80;
  const toY = v => h - ((v - min) / (max - min)) * h;
  const toX = i => (i / (points.length - 1)) * w;

  sCtx.beginPath();
  points.forEach((p, i) => i === 0 ? sCtx.moveTo(toX(i), toY(p)) : sCtx.lineTo(toX(i), toY(p)));
  sCtx.strokeStyle = '#f59e0b';
  sCtx.lineWidth = 1.5;
  sCtx.stroke();

  // Fill under line
  sCtx.lineTo(w, h); sCtx.lineTo(0, h); sCtx.closePath();
  sCtx.fillStyle = 'rgba(245,158,11,0.12)';
  sCtx.fill();
}

// Scenario sliders
const oilSlider = document.getElementById('oil-slider');
const geoSlider = document.getElementById('geo-slider');
const rateSlider = document.getElementById('rate-slider');

function updateScenario(type, val) {
  const v = parseInt(val);
  if (type === 'oil') {
    document.getElementById('oil-val').textContent = v + '%';
    document.getElementById('oil-bar').style.width = v + '%';
  }
  if (type === 'geo') {
    document.getElementById('geo-val').textContent = v + '%';
    document.getElementById('geo-bar').style.width = v + '%';
    // Update GTI
    const gti = (60 + v * 0.4).toFixed(1);
    document.getElementById('gti-value').textContent = gti;
    document.getElementById('gti-delta').textContent = '+' + (v * 0.08).toFixed(1) + ' today';
    // Update severity label
    const sevEl = document.getElementById('gti-severity');
    if (v > 85) { sevEl.textContent = 'CRITICAL'; sevEl.style.color = '#ef4444'; sevEl.style.borderColor = 'rgba(239,68,68,0.3)'; sevEl.style.background = 'rgba(239,68,68,0.1)'; }
    else if (v > 50) { sevEl.textContent = 'ELEVATED'; sevEl.style.color = '#f59e0b'; sevEl.style.borderColor = 'rgba(245,158,11,0.25)'; sevEl.style.background = 'rgba(245,158,11,0.12)'; }
    else { sevEl.textContent = 'MODERATE'; sevEl.style.color = '#3b82f6'; sevEl.style.borderColor = 'rgba(59,130,246,0.25)'; sevEl.style.background = 'rgba(59,130,246,0.1)'; }
    // Update regime in nav
    if (v > 85) updateRegime('CRISIS MODE', 'red');
  }
  if (type === 'rate') {
    document.getElementById('rate-val').textContent = v + '%';
    document.getElementById('rate-bar').style.width = v + '%';
    if (v > 50) updateRegime('FED POLICY DAY', 'amber');
  }
}

function updateRegime(label, color) {
  const regimeEl = document.querySelector('.stat .value.amber, .stat .value.red, .stat .value.green');
  if (regimeEl) {
    regimeEl.textContent = label;
    // Keep standard classes + dynamic color class
    regimeEl.className = 'value ' + color;
  }
}

if (oilSlider) oilSlider.addEventListener('input', e => updateScenario('oil', e.target.value));
if (geoSlider) geoSlider.addEventListener('input', e => updateScenario('geo', e.target.value));
if (rateSlider) rateSlider.addEventListener('input', e => updateScenario('rate', e.target.value));

let activeRegion = 'all';

document.querySelectorAll('.region-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.region-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeRegion = btn.dataset.region;

    const filtered = activeRegion === 'all'
      ? geoEvents
      : geoEvents.filter(e => e.region === activeRegion);

    world.pointsData(filtered);
  });
});

// Panel minimize logic
const minBtn = document.getElementById('minimize-left-btn');
if (minBtn) {
  minBtn.addEventListener('click', () => {
    const leftPanel = document.getElementById('left-filter-panel');
    leftPanel.classList.toggle('minimized');
    
    // Rotate the arrow icon softly based on toggle state
    const icon = minBtn.querySelector('svg');
    if (leftPanel.classList.contains('minimized')) {
      icon.style.transform = 'rotate(180deg)';
    } else {
      icon.style.transform = 'rotate(0deg)';
    }
  });
}

