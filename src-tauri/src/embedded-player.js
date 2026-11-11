/* GameSky's host bridge. The downloaded BoxedWine files remain unmodified. */
(async function () {
  window.addEventListener('error', event => {
    document.getElementById('playerStatus').textContent = event.message;
    document.getElementById('forceClose').hidden = false;
  });
  document.getElementById('forceClose').addEventListener('click', () => fetch('close', { method: 'POST' }));
  const config = await fetch('config.json').then(r => {
    if (!r.ok) throw new Error('Could not load game configuration.');
    return r.json();
  });
  const compatibility = new URLSearchParams(location.search).get('engine') === 'compat';
  Config.urlParams = 'app=game&overlay=profile;state&p=' + encodeURIComponent(config.executable) + '&auto=true&sound=true';
  // State belongs to the native library and is saved through our local bridge,
  // independently of temporary HTTP ports and WebKit's IndexedDB origin rules.
  Config.storageMode = STORAGE_MEMORY;
  const originalConfigure = setConfiguration;
  setConfiguration = function () {
    originalConfigure();
    Config.Program = config.executable;
    if (config.executable.toLowerCase() === 'east-drive.exe') Config.resolution = '800x600';
  };
  const originalParams = getEmulatorParams;
  getEmulatorParams = function () {
    const args = originalParams();
    args.push(...config.arguments);
    return args;
  };
  const canvas = document.getElementById('canvas');
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('pointerdown', () => canvas.focus());
  // Newer BoxedWine cores present paletted DirectDraw output as RGBA frames.
  // Keep this adapter in the host rather than modifying the downloaded engine.
  let softwareCanvas = canvas;
  let softwareContext;
  let firstSoftwareFrame = true;
  let gameCrop;
  const eastDrive = config.executable.toLowerCase() === 'east-drive.exe';
  const viewport = document.createElement('div');
  viewport.style.cssText = 'position:relative;overflow:hidden;flex:none';
  const fitGame = () => {
    if (!gameCrop) return;
    const area = document.getElementById('dropzone');
    const scale = Math.min(area.clientWidth / 640, area.clientHeight / 360);
    viewport.style.width = 640 * scale + 'px';
    viewport.style.height = 360 * scale + 'px';
    softwareCanvas.style.cssText = 'position:absolute;max-width:none;max-height:none;width:' + softwareCanvas.width * scale + 'px;height:' + softwareCanvas.height * scale + 'px;left:' + -gameCrop.x * scale + 'px;top:' + -gameCrop.y * scale + 'px';
  };
  new ResizeObserver(fitGame).observe(document.getElementById('dropzone'));
  // Wine's window border encloses a fixed 640×360 client surface. Locate its
  // bottom edge once, then clip the desktop while keeping the full canvas's
  // coordinate system intact for upstream mouse handling.
  const findGameClient = (pixels, width, height) => {
    if (!eastDrive || gameCrop || width < 644 || height < 380) return;
    let edge;
    for (let y = 0; y < height; y++) {
      let start = 0;
      for (let x = 1; x <= width; x++) {
        const a = (y * width + start) * 4, b = (y * width + x) * 4;
        if (x < width && pixels[a] === pixels[b] && pixels[a+1] === pixels[b+1] && pixels[a+2] === pixels[b+2]) continue;
        const length = x - start;
        if (length > 640 && length <= 656 && pixels[a] > 120 && pixels[a] === pixels[a+1] && pixels[a] === pixels[a+2]) edge = { x: start, y, width: length };
        start = x;
      }
    }
    if (edge && edge.y >= 360) {
      const border = Math.floor((edge.width - 640) / 2);
      gameCrop = { x: edge.x + border, y: edge.y - border + 1 - 360 };
      softwareCanvas.parentElement.append(viewport);
      viewport.append(softwareCanvas);
      fitGame();
    }
  };
  Module.boxedwinePresentSoftwareFrame = (width, height, buffer, presentState) => {
    try {
      if (!softwareContext) {
        softwareContext = softwareCanvas.getContext('2d');
        if (!softwareContext) {
          softwareCanvas = document.createElement('canvas');
          softwareCanvas.id = 'boxedwine-webgl-canvas-0';
          softwareCanvas.tabIndex = 0;
          softwareCanvas.setAttribute('aria-label', 'Game screen');
          softwareCanvas.addEventListener('pointerdown', () => softwareCanvas.focus());
          canvas.style.display = 'none';
          document.getElementById('dropzone').append(softwareCanvas);
          softwareContext = softwareCanvas.getContext('2d');
        }
      }
      if (softwareCanvas.width !== width) softwareCanvas.width = width;
      if (softwareCanvas.height !== height) softwareCanvas.height = height;
      const pixels = new Uint8ClampedArray(buffer);
      softwareContext.putImageData(new ImageData(pixels, width, height), 0, 0);
      findGameClient(pixels, width, height);
      document.getElementById('loading').hidden = true;
      if (firstSoftwareFrame) {
        firstSoftwareFrame = false;
        document.getElementById('playerStatus').textContent = 'Click the game to control it · Progress saves automatically';
        softwareCanvas.focus();
      }
    } finally {
      if (presentState) Atomics.store(presentState, 0, 0);
    }
  };
  const originalPrint = Module.print;
  Module.print = function (line) {
    originalPrint(line);
    if (String(line).includes('Showing Window')) {
      document.getElementById('loading').hidden = true;
      document.getElementById('playerStatus').textContent = 'Click the game to control it · Progress saves automatically';
      canvas.focus();
    }
  };
  Module.printErr = line => {
    const output = document.getElementById('output');
    output.value += String(line) + '\n'; output.scrollTop = output.scrollHeight;
    if (output.value.length > 131072) output.value = output.value.slice(-65536);
  };
  let initialized = false;
  let saving = null;
  Module.postRun.push(() => { initialized = true; });
  // The Emscripten runtime keeps the interpreter alive after main() yields.
  const originalStart = startEmulator;
  startEmulator = function () { initialized = true; originalStart(); };
  const gather = () => {
    const files = [];
    const walk = (path, prefix) => {
      for (const name of FS.readdir(path)) {
        if (name === '.' || name === '..') continue;
        const full = path + '/' + name;
        const stat = FS.lstat(full);
        if (FS.isDir(stat.mode)) walk(full, prefix + name + '/');
        else if (FS.isFile(stat.mode)) files.push({ path: prefix + name, data: Array.from(FS.readFile(full)) });
      }
    };
    if (FS.analyzePath('/root').exists) walk('/root', '');
    // All guest files, including C: writes layered above game.zip, live in /root.
    return files;
  };
  const save = async () => {
    if (saving) return saving;
    if (!initialized) return;
    saving = (async () => {
      const files = gather();
      if (!files.length) return;
      const response = await fetch('save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(files) });
      if (!response.ok) throw new Error('Game state could not be saved.');
    })();
    try { await saving; } finally { saving = null; }
  };
  const status = document.getElementById('playerStatus');
  const close = document.getElementById('closePlayer');
  const force = document.getElementById('forceClose');
  const closeHost = async () => {
    const response = await fetch('close', { method: 'POST' });
    if (!response.ok) throw new Error('The player could not close.');
  };
  const showError = error => {
    status.textContent = String(error); close.disabled = false; force.hidden = false;
  };
  close.addEventListener('click', async () => {
    close.disabled = true; status.textContent = 'Saving progress…';
    try { await save(); await closeHost(); } catch (error) { showError(error); }
  });
  document.getElementById('diagnostics').addEventListener('click', () => {
    const output = document.getElementById('output');
    output.style.display = output.style.display === 'block' ? 'none' : 'block';
  });
  document.getElementById('compatibility').addEventListener('click', async () => {
    try { await save(); window.location.search = compatibility ? '' : '?engine=compat'; } catch (error) { showError(error); }
  });
  document.getElementById('compatibility').textContent = compatibility ? 'Faster engine' : 'Compatibility mode';
  setInterval(() => save().catch(showError), 10000);
  Module.onExit = async () => {
    try { await save(); await closeHost(); }
    catch (error) { showError(error); }
  };
  Module.onAbort = error => showError('The Windows engine stopped: ' + error);
  const script = document.createElement('script'); script.src = compatibility ? 'compat/boxedwine.js' : 'boxedwine.js';
  script.onerror = () => showError('Could not load the Windows engine.');
  document.body.append(script);
})().catch(error => {
  document.getElementById('status').textContent = String(error);
  document.getElementById('forceClose').hidden = false;
});
