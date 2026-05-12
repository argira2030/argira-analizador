(function() {
  'use strict';

  // ======================== ESTADO GLOBAL ========================
  let currentImageData = null;
  let currentMetrics = null;
  let audioContext = null;
  let currentSource = null;
  let currentGain = null;
  let shelvingFilter = null;
  let isPlaying = false;
  let hasImage = false;
  let currentSpeakText = '';

  // ======================== DOM ELEMENTS ========================
  const canvas = document.getElementById('imageCanvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const placeholder = document.getElementById('canvasPlaceholder');
  const loadingBar = document.getElementById('loadingBar');
  const emptyState = document.getElementById('emptyState');
  const metricsContent = document.getElementById('metricsContent');
  const radarCanvas = document.getElementById('radarCanvas');
  const radarCtx = radarCanvas.getContext('2d');

  // Sliders (shelving y velocidad)
  const shelvingGainSlider = document.getElementById('shelvingGain');
  const shelvingFreqSlider = document.getElementById('shelvingFreq');
  const shelvingGainVal    = document.getElementById('shelvingGainVal');
  const shelvingFreqVal    = document.getElementById('shelvingFreqVal');
  const shelvingFill       = document.getElementById('shelvingActiveFill');
  const speedSlider        = document.getElementById('speedControl');
  const speedVal           = document.getElementById('speedVal');

  const liveRegion = document.getElementById('live-region');
  function announce(msg) {
    liveRegion.textContent = '';
    setTimeout(() => { liveRegion.textContent = msg; }, 80);
  }

  // ======================== TABS ========================
  document.querySelectorAll('.source-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.source-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.source-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    });
  });

  // ======================== CARGA DE IMAGEN (archivo, url, ejemplos) ========================
  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');

  uploadZone.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadFromFile(file);
  });
  fileInput.addEventListener('change', e => {
    if (e.target.files[0]) loadFromFile(e.target.files[0]);
  });

  document.getElementById('urlBtn').addEventListener('click', () => {
    const url = document.getElementById('urlInput').value.trim();
    if (url) loadFromURL(url);
  });
  document.getElementById('urlInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('urlBtn').click();
  });

  // Ejemplos sintéticos
  document.getElementById('btnMalevich').addEventListener('click', () => { stopSound(); generateMalevich(); });
  document.getElementById('btnMonet').addEventListener('click',    () => { stopSound(); generateMonet(); });
  document.getElementById('btnSeurat').addEventListener('click',   () => { stopSound(); generateSeurat(); });
  document.getElementById('btnKandinsky').addEventListener('click',() => { stopSound(); generateKandinsky(); });
  document.getElementById('btnRothko').addEventListener('click',   () => { stopSound(); generateRothko(); });
  document.getElementById('btnVanGogh').addEventListener('click',  () => { stopSound(); generateVanGogh(); });

  // Botones de sonido
  document.getElementById('btnPlay').addEventListener('click', startSound);
  document.getElementById('btnStop').addEventListener('click', stopSound);

  // Speak button
  document.getElementById('speakBtn').addEventListener('click', () => {
    if (!currentSpeakText) return;
    const btn = document.getElementById('speakBtn');
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(currentSpeakText);
      utt.lang = 'es-ES';
      utt.onstart = () => btn.classList.add('speaking');
      utt.onend = () => btn.classList.remove('speaking');
      utt.onerror = () => btn.classList.remove('speaking');
      window.speechSynthesis.speak(utt);
    }
  });

  // ======================== GENERADORES DE IMAGEN SINTÉTICA ========================
  function setCanvasSize(w, h) {
    canvas.width = w;
    canvas.height = h;
  }

  function generateMalevich() {
    setCanvasSize(400, 400);
    ctx.fillStyle = '#F5F5F0';
    ctx.fillRect(0, 0, 400, 400);
    ctx.fillStyle = '#EDEDE5';
    ctx.fillRect(130, 130, 140, 140);
    finishLoad();
  }

  function generateMonet() {
    setCanvasSize(400, 400);
    for (let y = 0; y < 400; y++) {
      for (let x = 0; x < 400; x++) {
        const n = noise2D(x * 0.03, y * 0.03);
        const skyFactor = y / 400;
        let r, g, b;
        if (skyFactor < 0.35) {
          r = 160 + n * 30; g = 190 + n * 20; b = 220 + n * 20;
        } else {
          const isPoppy = (Math.sin(x * 0.25) * Math.cos(y * 0.18) + n * 0.5) > 0.7;
          if (isPoppy && skyFactor > 0.45) {
            r = 200 + n * 55; g = 30 + n * 40; b = 20 + n * 30;
          } else {
            r = 60 + n * 50 + skyFactor * 40;
            g = 100 + n * 60 + skyFactor * 20;
            b = 40 + n * 40;
          }
        }
        ctx.fillStyle = `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    finishLoad();
  }

  function generateSeurat() {
    setCanvasSize(400, 400);
    ctx.fillStyle = '#D4C9A0';
    ctx.fillRect(0, 0, 400, 400);
    const STEP = 7, RADIUS = 2.5, JITTER = 1.2;
    const colors = [[255,80,60],[60,120,200],[255,200,50],[80,180,80],[200,80,160],[255,140,30],[40,160,180]];
    for (let y = STEP/2; y < 400; y += STEP) {
      for (let x = STEP/2; x < 400; x += STEP) {
        const jx = x + (Math.random() - 0.5) * JITTER * 2;
        const jy = y + (Math.random() - 0.5) * JITTER * 2;
        const c = colors[Math.floor(Math.random() * colors.length)];
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.beginPath();
        ctx.arc(jx, jy, RADIUS, 0, Math.PI*2);
        ctx.fill();
      }
    }
    finishLoad();
  }

  function generateKandinsky() {
    setCanvasSize(400, 400);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 400, 400);
    const shapes = [
      { type: 'circle', x:200, y:180, r:80, color:'#FFD700' },
      { type: 'circle', x:100, y:120, r:45, color:'#FF4444' },
      { type: 'circle', x:300, y:250, r:55, color:'#4488FF' },
      { type: 'rect', x:60, y:260, w:120, h:80, color:'#44CC44' },
      { type: 'rect', x:270, y:80, w:90, h:60, color:'#FF8844' },
      { type: 'circle', x:320, y:150, r:30, color:'#CC44CC' }
    ];
    shapes.forEach(s => {
      ctx.fillStyle = s.color;
      ctx.beginPath();
      if (s.type === 'circle') ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      else ctx.rect(s.x, s.y, s.w, s.h);
      ctx.fill();
    });
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    [[50,50,350,350],[50,350,350,50],[200,0,200,400],[0,200,400,200]].forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });
    finishLoad();
  }

  function generateRothko() {
    setCanvasSize(400, 400);
    const grad1 = ctx.createLinearGradient(0,0,0,180);
    grad1.addColorStop(0,'#8B1A1A'); grad1.addColorStop(1,'#C0392B');
    ctx.fillStyle = grad1; ctx.fillRect(0,0,400,185);
    const grad2 = ctx.createLinearGradient(0,180,0,280);
    grad2.addColorStop(0,'#2C1810'); grad2.addColorStop(1,'#1A0A05');
    ctx.fillStyle = grad2; ctx.fillRect(0,180,400,100);
    const grad3 = ctx.createLinearGradient(0,270,0,400);
    grad3.addColorStop(0,'#8B4513'); grad3.addColorStop(1,'#D2691E');
    ctx.fillStyle = grad3; ctx.fillRect(0,270,400,130);
    finishLoad();
  }

  function generateVanGogh() {
    setCanvasSize(400, 400);
    const skyGrad = ctx.createLinearGradient(0,0,0,300);
    skyGrad.addColorStop(0,'#06082a'); skyGrad.addColorStop(1,'#0d2050');
    ctx.fillStyle = skyGrad; ctx.fillRect(0,0,400,400);
    ctx.lineCap = 'round';
    for (let i=0; i<40; i++) {
      const cx = Math.random()*400, cy = Math.random()*270;
      const r = Math.random()*60+30, hue = 200+Math.random()*40, lum = 35+Math.random()*25;
      ctx.strokeStyle = `hsla(${hue},75%,${lum}%,0.55)`;
      ctx.lineWidth = Math.random()*10+6;
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.random()*Math.PI*2, Math.random()*Math.PI*2 + Math.PI);
      ctx.stroke();
    }
    for (let i=0; i<25; i++) {
      const sx = Math.random()*400, sy = Math.random()*240, sr = Math.random()*8+4;
      const grd = ctx.createRadialGradient(sx,sy,0,sx,sy,sr);
      grd.addColorStop(0,'rgba(255,255,200,0.7)'); grd.addColorStop(1,'rgba(255,255,200,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(sx,sy,sr,0,Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = '#0d1a0d'; ctx.fillRect(0,300,400,100);
    for (let i=0; i<10; i++) {
      const bx = i*42-5, bh = 30+Math.random()*50;
      ctx.fillRect(bx, 340-bh, 25, bh+60);
    }
    finishLoad();
  }

  function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }
  function noise2D(x,y) {
    const n = Math.sin(x*127.1 + y*311.7) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  }

  // ======================== CARGA DESDE ARCHIVO / URL ========================
  function loadFromFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => { drawImageToCanvas(img); finishLoad(); };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function loadFromURL(url) {
    setLoading(true);
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => { drawImageToCanvas(img); finishLoad(); setLoading(false); };
    img.onerror = () => { setLoading(false); alert('No se pudo cargar la imagen. Posible problema CORS.'); };
    img.src = url;
  }

  function drawImageToCanvas(img) {
    const maxW = 500, maxH = 400;
    let w = img.width, h = img.height;
    if (w > maxW) { h = h * maxW / w; w = maxW; }
    if (h > maxH) { w = w * maxH / h; h = maxH; }
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  function setLoading(on) { loadingBar.classList.toggle('active', on); }
  function finishLoad() {
    currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    placeholder.style.display = 'none';
    hasImage = true;
    analyzeAndDisplay();
  }

  // ======================== ANÁLISIS DE MÉTRICAS ========================
  function computeMetrics(imgData) {
    const data = imgData.data, W = imgData.width, H = imgData.height, N = W*H;
    const lum = new Float32Array(N);
    let rSum=0,gSum=0,bSum=0;
    for (let i=0; i<N; i++) {
      const r=data[i*4], g=data[i*4+1], b=data[i*4+2];
      lum[i]=0.2126*r+0.7152*g+0.0722*b;
      rSum+=r; gSum+=g; bSum+=b;
    }
    const rMean=rSum/N, gMean=gSum/N, bMean=bSum/N;
    let totalDiff=0, numPairs=0;
    for (let y=0; y<H; y++) {
      for (let x=0; x<W; x++) {
        const idx=y*W+x;
        if (x<W-1) { totalDiff+=Math.abs(lum[idx]-lum[idx+1]); numPairs++; }
        if (y<H-1) { totalDiff+=Math.abs(lum[idx]-lum[idx+W]); numPairs++; }
      }
    }
    const irregularity = (totalDiff/numPairs)/255;
    const hist = new Float64Array(256);
    for (let i=0; i<N; i++) hist[Math.round(lum[i])]++;
    let entropy=0;
    for (let g=0; g<256; g++) {
      const p = hist[g]/N;
      if (p>0) entropy -= p*Math.log2(p);
    }
    const normEntropy = entropy/8;
    let rVar=0,gVar=0,bVar=0;
    for (let i=0; i<N; i++) {
      rVar += Math.pow(data[i*4]-rMean,2);
      gVar += Math.pow(data[i*4+1]-gMean,2);
      bVar += Math.pow(data[i*4+2]-bMean,2);
    }
    const colorStd = Math.sqrt((rVar+gVar+bVar)/(3*N))/255;
    const bSize=8;
    let blockVarSum=0, blockCount=0;
    for (let by=0; by+bSize<=H; by+=bSize) {
      for (let bx=0; bx+bSize<=W; bx+=bSize) {
        let sum=0, sum2=0, cnt=0;
        for (let y=by; y<by+bSize; y++) {
          for (let x=bx; x<bx+bSize; x++) {
            const v = lum[y*W+x];
            sum+=v; sum2+=v*v; cnt++;
          }
        }
        const mean = sum/cnt;
        const variance = sum2/cnt - mean*mean;
        blockVarSum += Math.sqrt(Math.max(0,variance));
        blockCount++;
      }
    }
    const localContrast = blockCount>0 ? (blockVarSum/blockCount)/255 : 0;
    let sobelSum=0;
    const sobelN = (W-2)*(H-2);
    for (let y=1; y<H-1; y++) {
      for (let x=1; x<W-1; x++) {
        const tl=lum[(y-1)*W+(x-1)], tc=lum[(y-1)*W+x], tr=lum[(y-1)*W+(x+1)];
        const ml=lum[y*W+(x-1)], mr=lum[y*W+(x+1)];
        const bl=lum[(y+1)*W+(x-1)], bc=lum[(y+1)*W+x], br=lum[(y+1)*W+(x+1)];
        const gx = -tl+tr -2*ml+2*mr -bl+br;
        const gy = -tl-2*tc-tr + bl+2*bc+br;
        sobelSum += Math.sqrt(gx*gx+gy*gy);
      }
    }
    const edgeDensity = sobelN>0 ? sobelSum/sobelN/1442 : 0;
    const effort = 0.5*irregularity + 0.3*normEntropy + 0.2*colorStd;
    const freq = 200 + irregularity*800;
    return { irregularity, entropy:normEntropy, colorStd, localContrast, edgeDensity, effort: Math.min(1,effort), freq };
  }

  function analyzeAndDisplay() {
    if (!currentImageData) return;
    const m = computeMetrics(currentImageData);
    currentMetrics = m;
    emptyState.style.display = 'none';
    metricsContent.style.display = 'block';
    setMetric('mIrregularity','barIrregularity', m.irregularity);
    setMetric('mEntropy','barEntropy', m.entropy);
    setMetric('mColorStd','barColorStd', m.colorStd);
    setMetric('mLocalContrast','barLocalContrast', m.localContrast);
    setMetric('mEffort','barEffort', m.effort);
    setMetric('mEdgeDensity','barEdgeDensity', m.edgeDensity);
    document.getElementById('freqVal').textContent = Math.round(m.freq)+' Hz';
    const FREQ_MIN=209, FREQ_MAX=277;
    const freqPct = Math.min(100, Math.max(0, (m.freq-FREQ_MIN)/(FREQ_MAX-FREQ_MIN)*100));
    document.getElementById('freqBarFill').style.width = freqPct+'%';
    document.getElementById('tokenDesc').textContent = `f = ${Math.round(m.freq)} Hz · Irr = ${pct(m.irregularity)} · Ent = ${pct(m.entropy)} · σRGB = ${pct(m.colorStd)} · Esfuerzo = ${pct(m.effort)} · Sobel = ${pct(m.edgeDensity)}`;
    document.getElementById('at-irregularity').textContent = pct(m.irregularity);
    document.getElementById('at-entropy').textContent = pct(m.entropy);
    document.getElementById('at-colorstd').textContent = pct(m.colorStd);
    document.getElementById('at-contrast').textContent = pct(m.localContrast);
    document.getElementById('at-effort').textContent = pct(m.effort);
    document.getElementById('at-edge').textContent = pct(m.edgeDensity);
    updateInterpretation(m);
    drawRadar(m);
  }

  function setMetric(valId, barId, v) {
    document.getElementById(valId).textContent = pct(v);
    setTimeout(() => { document.getElementById(barId).style.width = (v*100).toFixed(1)+'%'; }, 50);
  }
  function pct(v) { return Math.round(v*100)+'%'; }

  function updateInterpretation(m) {
    const irr = m.irregularity;
    let text, style;
    if (irr < 0.02 && m.entropy<0.75) {
      text = 'Irregularidad muy baja (zona 1–2% del dataset real). Pincelada contenida, zonas de color amplias o iluminación uniforme. El sonido es grave y estable. Perfil típico de Rembrandt, Vermeer o Hopper.';
      style = 'Figurativo clásico / Realismo';
    } else if (irr < 0.02) {
      text = 'Irregularidad muy baja con entropía alta: imagen cromáticamente rica pero estructuralmente lisa. Gradientes suaves o composición geométrica limpia. Perfil Mondrian o Malevich negro.';
      style = 'Geométrico / Suprematismo';
    } else if (irr < 0.035) {
      text = 'Irregularidad baja-media (zona 2–3%). Pincelada visible pero controlada. Transiciones de color moderadas. El sonido es grave con leves modulaciones. Perfil Monet, Turner o Velázquez.';
      style = 'Impresionismo temprano / Barroco';
    } else if (irr < 0.06) {
      text = 'Irregularidad media (zona 3–6%). Pincelada activa y textura perceptible. El sonido tiene tono medio y riqueza tímbrica. En puntillismo real, Sobel confirma la densidad de bordes entre puntos. Perfil Cézanne, Goya, Degas o Seurat.';
      style = 'Post-impresionismo / Puntillismo';
    } else if (irr < 0.08) {
      text = 'Irregularidad media-alta (zona 6–8%). Pincelada suelta y gestual. Alta energía de alta frecuencia. El sonido es notablemente más agudo. Perfil Renoir, Botticelli o Monet tardío.';
      style = 'Impresionismo maduro / Renacentista';
    } else {
      text = 'Irregularidad alta (zona 8–10%, máximo del dataset real). Pincelada muy densa, expresionista o decorativa de gran detalle. El sonido es agudo y nervioso. Perfil Van Gogh, Klimt o Degas bailarinas.';
      style = 'Expresionismo / Art Nouveau';
    }
    document.getElementById('interpText').textContent = text;
    document.getElementById('interpStyle').textContent = style;
    currentSpeakText = `Perfil sonoro: ${style}. Frecuencia ${Math.round(currentMetrics?.freq||0)} hercios. Irregularidad ${pct(m.irregularity)}, entropía ${pct(m.entropy)}, varianza cromática ${pct(m.colorStd)}, contraste local ${pct(m.localContrast)}, esfuerzo de procesamiento ${pct(m.effort)}. ${text}`;
    announce(`Análisis completado. Estilo detectado: ${style}. Irregularidad ${pct(m.irregularity)}, entropía ${pct(m.entropy)}, esfuerzo ${pct(m.effort)}. Frecuencia sonora: ${Math.round(currentMetrics?.freq||0)} hercios.`);
  }

  // ======================== RADAR ========================
  function drawRadar(m) {
    const W = radarCanvas.width, H = radarCanvas.height, cx = W/2, cy = H/2+10;
    const r = Math.min(W,H)*0.36;
    radarCtx.clearRect(0,0,W,H);
    const labels = ['Irregularidad','Entropía','Varianza RGB','Contraste local','Esfuerzo','Sobel'];
    const values = [m.irregularity, m.entropy, m.colorStd, m.localContrast, m.effort, m.edgeDensity];
    const n = labels.length, angleStep = (Math.PI*2)/n, startAngle = -Math.PI/2;
    for (let level=1; level<=5; level++) {
      const rr = r*level/5;
      radarCtx.beginPath();
      for (let i=0; i<n; i++) {
        const angle = startAngle + i*angleStep;
        const x = cx + rr*Math.cos(angle), y = cy + rr*Math.sin(angle);
        i===0 ? radarCtx.moveTo(x,y) : radarCtx.lineTo(x,y);
      }
      radarCtx.closePath();
      radarCtx.strokeStyle = 'rgba(232,201,106,0.12)';
      radarCtx.stroke();
    }
    for (let i=0; i<n; i++) {
      const angle = startAngle + i*angleStep;
      radarCtx.beginPath();
      radarCtx.moveTo(cx,cy);
      radarCtx.lineTo(cx+r*Math.cos(angle), cy+r*Math.sin(angle));
      radarCtx.strokeStyle = 'rgba(232,201,106,0.18)';
      radarCtx.stroke();
    }
    radarCtx.beginPath();
    for (let i=0; i<n; i++) {
      const angle = startAngle + i*angleStep;
      const rr = r * Math.min(1, values[i]);
      const x = cx + rr*Math.cos(angle), y = cy + rr*Math.sin(angle);
      i===0 ? radarCtx.moveTo(x,y) : radarCtx.lineTo(x,y);
    }
    radarCtx.closePath();
    radarCtx.fillStyle = 'rgba(232,201,106,0.15)';
    radarCtx.fill();
    radarCtx.strokeStyle = '#e8c96a';
    radarCtx.stroke();
    for (let i=0; i<n; i++) {
      const angle = startAngle + i*angleStep;
      const rr = r * Math.min(1, values[i]);
      const x = cx + rr*Math.cos(angle), y = cy + rr*Math.sin(angle);
      radarCtx.beginPath();
      radarCtx.arc(x,y,4,0,Math.PI*2);
      radarCtx.fillStyle = '#e8c96a';
      radarCtx.fill();
    }
    radarCtx.font = '500 10px IBM Plex Sans, sans-serif';
    radarCtx.fillStyle = '#a89e88';
    radarCtx.textAlign = 'center';
    for (let i=0; i<n; i++) {
      const angle = startAngle + i*angleStep;
      const rr = r + 26;
      const x = cx + rr*Math.cos(angle), y = cy + rr*Math.sin(angle)+4;
      radarCtx.fillStyle = '#e8c96a';
      radarCtx.font = 'bold 9px IBM Plex Sans, sans-serif';
      radarCtx.fillText(labels[i], x, y);
    }
  }

  // ======================== AUDIO CON BUFFER Y PLAYBACK RATE ========================
  function updateShelvingUI() {
    if (!shelvingGainSlider || !shelvingFreqSlider) return;
    const gainDb = parseFloat(shelvingGainSlider.value);
    const freq   = parseFloat(shelvingFreqSlider.value);
    if (shelvingGainVal) shelvingGainVal.textContent = gainDb;
    if (shelvingFreqVal) shelvingFreqVal.textContent = freq;
    const pct = ((gainDb * -1) / 12) * 100;
    if (shelvingFill) shelvingFill.style.width = pct + '%';
    if (shelvingFilter) {
      shelvingFilter.gain.setTargetAtTime(gainDb, audioContext.currentTime, 0.05);
      shelvingFilter.frequency.setTargetAtTime(freq, audioContext.currentTime, 0.05);
    }
  }

  function updatePlaybackRate() {
    if (!speedSlider) return;
    const rate = parseFloat(speedSlider.value);
    if (speedVal) speedVal.textContent = rate.toFixed(2);
    if (currentSource && currentSource.playbackRate) {
      currentSource.playbackRate.setTargetAtTime(rate, audioContext.currentTime, 0.05);
    }
  }

  function startSound() {
    if (!hasImage || !currentMetrics) {
      announce('Carga una imagen primero.');
      return;
    }
    if (isPlaying) stopSound();

    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') audioContext.resume();

    const freq = currentMetrics.freq;
    const duration = 8;           // segundos
    const sampleRate = audioContext.sampleRate;
    const samples = duration * sampleRate;
    const buffer = audioContext.createBuffer(1, samples, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      channel[i] = Math.sin(2 * Math.PI * freq * t);
    }

    currentSource = audioContext.createBufferSource();
    currentSource.buffer = buffer;
    const playbackRate = speedSlider ? parseFloat(speedSlider.value) : 1.0;
    currentSource.playbackRate.value = playbackRate;

    currentGain = audioContext.createGain();
    currentGain.gain.value = 0.25;

    shelvingFilter = audioContext.createBiquadFilter();
    shelvingFilter.type = 'highshelf';
    shelvingFilter.frequency.value = shelvingFreqSlider ? parseFloat(shelvingFreqSlider.value) : 5000;
    shelvingFilter.gain.value = shelvingGainSlider ? parseFloat(shelvingGainSlider.value) : 0;

    currentSource.connect(currentGain);
    currentGain.connect(shelvingFilter);
    shelvingFilter.connect(audioContext.destination);

    currentSource.start();
    isPlaying = true;
    document.getElementById('btnPlay').classList.add('playing');
    announce(`Reproduciendo sonido a ${playbackRate*100}% de velocidad. Frecuencia ${Math.round(freq)} Hz.`);
  }

  function stopSound() {
    if (!isPlaying) return;
    if (currentSource) {
      try { currentSource.stop(); } catch(e) {}
      currentSource = null;
    }
    if (currentGain) {
      try { currentGain.disconnect(); } catch(e) {}
      currentGain = null;
    }
    if (shelvingFilter) {
      try { shelvingFilter.disconnect(); } catch(e) {}
      shelvingFilter = null;
    }
    if (audioContext) {
      audioContext.close().catch(e => console.warn);
      audioContext = null;
    }
    isPlaying = false;
    document.getElementById('btnPlay').classList.remove('playing');
    announce('Sonido detenido.');
  }

  // ======================== EVENTOS DE SLIDERS ========================
  if (shelvingGainSlider) shelvingGainSlider.addEventListener('input', updateShelvingUI);
  if (shelvingFreqSlider) shelvingFreqSlider.addEventListener('input', updateShelvingUI);
  if (speedSlider) speedSlider.addEventListener('input', updatePlaybackRate);

  // ======================== INICIALIZACIÓN ========================
  generateMalevich();   // imagen de ejemplo por defecto
})();