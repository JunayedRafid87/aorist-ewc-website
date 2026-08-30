// 3D Point Cloud Viewer - Approach 1 LiDAR Only
let scene, camera, renderer, currentCloud, autoRotate = false;
let mouseDown = false, mouseX = 0, mouseY = 0;
let rotX = 0.6, rotY = 0, distance = 8, targetX = 0, targetY = 0, targetZ = 0;
let currRotX = 0.6, currRotY = 0, currDistance = 8, currTargetX = 0, currTargetY = 0, currTargetZ = 0;
let currentRenderMode = '3d';
const YT_LINK = "https://www.youtube.com/embed/VERsw_9Qb1c?rel=0&autoplay=1&mute=1";

const MAPS = {
    sim: {
        url: "https://raw.githubusercontent.com/JunayedRafid87/sar-rover/main/lidar_map.ply",
        title: "Approach 1 — LiDAR 3D Point Cloud",
        tag: "Approach 1 — LiDAR Only",
        sensor: "RPLiDAR C1",
        power: "42.5W",
        powerSub: "37 min runtime",
        rate: "6.9 MB/s",
        rateSub: "Lightweight telemetry",
        slam: "ICP (slam_toolbox)",
        slamSub: "Push-broom 3D stacking",
        desc: "Generated autonomously via push-broom mapping in Webots simulation."
    },
    home: {
        url: "assets/junayeds_home.ply",
        title: "Junayed's Home — 3D Point Cloud",
        tag: "Junayed's Home",
        sensor: "RPLiDAR C1",
        power: "38.2W",
        powerSub: "42 min runtime",
        rate: "5.4 MB/s",
        rateSub: "Actual experimental rate",
        slam: "ICP SLAM Toolbox",
        slamSub: "Physical UGV validation",
        desc: "3D map of Junayed's home environment, collected by the physical UGV."
    }
};
let currentMapKey = 'sim';

function initViewer() {
    const canvas = document.getElementById('viewer3d');
    if (!canvas) return;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x080d1a);
    window.threeRenderer = renderer;

    scene = new THREE.Scene();
    window.scene = scene;
    scene.fog = new THREE.Fog(0x080d1a, 15, 30);

    camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    updateCamera();

    const grid = new THREE.GridHelper(20, 40, 0x141c30, 0x0e1424);
    grid.position.y = -0.5;
    scene.add(grid);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    // Mouse controls
    canvas.addEventListener('mousedown', (e) => { mouseDown = true; mouseX = e.clientX; mouseY = e.clientY; });
    canvas.addEventListener('mouseup', () => mouseDown = false);
    canvas.addEventListener('mouseleave', () => mouseDown = false);
    canvas.addEventListener('mousemove', (e) => {
        if (!mouseDown) return;
        if (e.buttons === 1) {
            rotY -= (e.clientX - mouseX) * 0.005;
            rotX -= (e.clientY - mouseY) * 0.005;
            rotX = Math.max(0.1, Math.min(Math.PI - 0.1, rotX));
        } else if (e.buttons === 2) {
            targetX += (e.clientX - mouseX) * 0.005;
            targetZ += (e.clientY - mouseY) * 0.005;
        }
        mouseX = e.clientX; mouseY = e.clientY;
        updateCamera();
    });
    canvas.addEventListener('wheel', (e) => {
        distance += e.deltaY * 0.005;
        distance = Math.max(1, Math.min(20, distance));
        updateCamera();
        e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch controls
    let touchStartDist = 0, touchStartX = 0, touchStartY = 0, touchMode = '';
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
            touchMode = 'rotate'; touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            touchMode = 'pinch';
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            touchStartDist = Math.sqrt(dx * dx + dy * dy);
            touchStartX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            touchStartY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (touchMode === 'rotate' && e.touches.length === 1) {
            rotY -= (e.touches[0].clientX - touchStartX) * 0.005;
            rotX -= (e.touches[0].clientY - touchStartY) * 0.005;
            rotX = Math.max(0.1, Math.min(Math.PI - 0.1, rotX));
            touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
            updateCamera();
        } else if (touchMode === 'pinch' && e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            distance += (touchStartDist - dist) * 0.02;
            distance = Math.max(1, Math.min(20, distance));
            touchStartDist = dist;
            const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            targetX += (mx - touchStartX) * 0.005;
            targetZ += (my - touchStartY) * 0.005;
            touchStartX = mx; touchStartY = my;
            updateCamera();
        }
    }, { passive: false });
    canvas.addEventListener('touchend', () => { touchMode = ''; });

    window.addEventListener('resize', () => {
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
    });

    loadPLY('sim');
    animate();
}

function animate() {
    requestAnimationFrame(animate);
    var canvas = document.getElementById('viewer3d');
    if (canvas) {
        var rect = canvas.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    }
    if (autoRotate) { rotY += 0.005; }
    updateCamera();
    renderer.render(scene, camera);
}

function updateCamera() {
    currRotX += (rotX - currRotX) * 0.1;
    currRotY += (rotY - currRotY) * 0.1;
    currDistance += (distance - currDistance) * 0.1;
    currTargetX += (targetX - currTargetX) * 0.1;
    currTargetY += (targetY - currTargetY) * 0.1;
    currTargetZ += (targetZ - currTargetZ) * 0.1;
    if (camera) {
        camera.position.x = currTargetX + currDistance * Math.sin(currRotX) * Math.sin(currRotY);
        camera.position.y = currTargetY + currDistance * Math.cos(currRotX);
        camera.position.z = currTargetZ + currDistance * Math.sin(currRotX) * Math.cos(currRotY);
        camera.lookAt(currTargetX, currTargetY, currTargetZ);
    }
}

function parsePLYText(text) {
    const allLines = text.split('\n');
    let headerEnd = 0, vertexCount = 0;
    for (let i = 0; i < allLines.length; i++) {
        if (allLines[i].startsWith('element vertex')) vertexCount = parseInt(allLines[i].split(' ')[2]);
        if (allLines[i].trim() === 'end_header') { headerEnd = i + 1; break; }
    }
    // Filter out blank lines from the data section
    const dataLines = [];
    for (let i = headerEnd; i < allLines.length; i++) {
        const trimmed = allLines[i].trim();
        if (trimmed.length > 0) dataLines.push(trimmed);
    }
    const actualCount = Math.min(vertexCount, dataLines.length);

    // Dynamic UI Updates
    const countTag = document.getElementById('point-count-tag');
    const infoPoints = document.getElementById('info-points');
    if (countTag) countTag.textContent = `${actualCount.toLocaleString()} points`;
    if (infoPoints) infoPoints.textContent = actualCount.toLocaleString();

    const positions = new Float32Array(actualCount * 3);
    const colors = new Float32Array(actualCount * 3);
    let cx = 0, cy = 0, cz = 0, count = 0;
    const rawX = new Float32Array(actualCount), rawY = new Float32Array(actualCount), rawZ = new Float32Array(actualCount);
    const rawR = new Uint8Array(actualCount), rawG = new Uint8Array(actualCount), rawB = new Uint8Array(actualCount);
    let hasColor = false;

    for (let i = 0; i < actualCount; i++) {
        const parts = dataLines[i].split(/\s+/);
        if (parts.length < 3) continue;
        rawX[i] = parseFloat(parts[0]); rawY[i] = parseFloat(parts[1]); rawZ[i] = parseFloat(parts[2]);
        cx += rawX[i]; cy += rawY[i]; cz += rawZ[i]; count++;
        if (parts.length >= 6) {
            rawR[i] = parseInt(parts[3]); rawG[i] = parseInt(parts[4]); rawB[i] = parseInt(parts[5]);
            if (rawR[i] || rawG[i] || rawB[i]) hasColor = true;
        }
    }
    if (count === 0) count = 1; // Prevent division by zero
    cx /= count; cy /= count; cz /= count;
    const fallback = new THREE.Color('#4af0b4');
    for (let i = 0; i < actualCount; i++) {
        positions[i * 3] = rawX[i] - cx;
        positions[i * 3 + 1] = rawZ[i] - cz;
        positions[i * 3 + 2] = -(rawY[i] - cy);
        if (rawR[i] || rawG[i] || rawB[i]) {
            colors[i * 3] = rawR[i] / 255; colors[i * 3 + 1] = rawG[i] / 255; colors[i * 3 + 2] = rawB[i] / 255;
        } else {
            colors[i * 3] = fallback.r; colors[i * 3 + 1] = fallback.g; colors[i * 3 + 2] = fallback.b;
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.03, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.9 }));
}

function loadPLY(mapKey) {
    const map = MAPS[mapKey || 'sim'];
    const loader = document.getElementById('viewer-loader');
    if (loader) {
        loader.style.display = 'flex';
        const lt = loader.querySelector('.loader-text');
        if (lt) lt.textContent = 'Loading Point Cloud...';
    }

    // Update metadata immediately
    const titleEl = document.getElementById('viewer-title');
    const descEl = document.getElementById('viewer-desc');
    const tagEl = document.getElementById('point-cloud-tag');
    const sensorEl = document.getElementById('info-sensor');
    const powerEl = document.getElementById('info-power');
    const rateEl = document.getElementById('info-rate');
    const slamEl = document.getElementById('info-slam');

    if (titleEl) titleEl.textContent = map.title;
    if (descEl) descEl.textContent = map.desc;
    if (tagEl) tagEl.innerHTML = `<span class="dot"></span> ${map.tag}`;
    if (sensorEl) sensorEl.textContent = map.sensor;
    if (powerEl) powerEl.textContent = map.power;
    if (rateEl) rateEl.textContent = map.rate;
    if (slamEl) slamEl.textContent = map.slam;

    fetch(map.url).then(r => {
        if (!r.ok) throw new Error('Failed to fetch PLY: ' + r.status);
        return r.text();
    }).then(text => {
        if (currentCloud) scene.remove(currentCloud);
        currentCloud = parsePLYText(text);
        scene.add(currentCloud);
        if (loader) loader.style.display = 'none';
    }).catch(err => {
        console.error('PLY load error:', err);
        const lt = document.querySelector('.loader-text');
        if (lt) lt.textContent = 'Failed to load point cloud';
    });
}

function changeMap(mapKey) {
    if (!MAPS[mapKey]) return;
    currentMapKey = mapKey;
    loadPLY(mapKey);
}
window.changeMap = changeMap;

function resetCamera() {
    rotX = 0.6; rotY = 0; distance = 8; targetX = 0; targetY = 0; targetZ = 0;
}

function toggleAutoRotate() { autoRotate = !autoRotate; }

function toggleFullscreen() {
    const section = document.querySelector('.viewer-section');
    if (section) section.classList.toggle('fullscreen');
}

function switchRenderMode(mode) {
    currentRenderMode = mode;
    const btn3d = document.getElementById('btn-3d');
    const btnVideo = document.getElementById('btn-video');
    const canvas = document.getElementById('viewer3d');
    const overlay = document.querySelector('.viewer-overlay');
    const controls = document.querySelector('.viewer-controls');
    const hint = document.querySelector('.viewer-hint');
    const videoFrame = document.getElementById('viewer-video');
    const selectContainer = document.getElementById('viewer-select-container');

    [btn3d, btnVideo].forEach(b => { b.style.background = 'transparent'; b.style.color = 'var(--text-2)'; });

    if (mode === '3d') {
        btn3d.style.background = 'rgba(74, 240, 180, 0.2)'; btn3d.style.color = 'var(--text)';
        canvas.style.opacity = '1';
        if (overlay) overlay.style.display = 'flex';
        if (controls) controls.style.display = 'flex';
        if (hint) hint.style.display = 'block';
        if (selectContainer) selectContainer.style.display = 'block';
        videoFrame.style.display = 'none'; videoFrame.src = '';
    } else {
        btnVideo.style.background = 'rgba(74, 240, 180, 0.2)'; btnVideo.style.color = 'var(--text)';
        canvas.style.opacity = '0';
        if (overlay) overlay.style.display = 'none';
        if (controls) controls.style.display = 'none';
        if (hint) hint.style.display = 'none';
        if (selectContainer) selectContainer.style.display = 'none';
        videoFrame.style.display = 'block'; videoFrame.src = YT_LINK;
    }
}

document.addEventListener('DOMContentLoaded', initViewer);
