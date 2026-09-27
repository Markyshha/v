import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";

const viewer = document.querySelector("#viewer");
const drop = document.querySelector("#drop");
const input = document.querySelector("#files");
const counter = document.querySelector("#counter");
const nameEl = document.querySelector("#name");
const message = document.querySelector("#message");
const vrBtn = document.querySelector("#vrBtn");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.01, 1000);
camera.position.set(0, 0, 0.01);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType("local");
viewer.appendChild(renderer.domElement);

const vrButton = VRButton.createButton(renderer);
vrButton.style.display = "none";
document.body.appendChild(vrButton);

vrBtn.addEventListener("click", () => {
  if (!renderer.xr.isPresenting) vrButton.click();
});

const geometry = new THREE.SphereGeometry(100, 64, 40);
geometry.scale(-1, 1, 1);
const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
const sphere = new THREE.Mesh(geometry, material);
scene.add(sphere);

const loader = new THREE.TextureLoader();
const items = [];
let current = -1;
let transitioning = false;

function setMessage(text) {
  message.textContent = text;
  message.style.display = "block";
  clearTimeout(setMessage.timer);
  setMessage.timer = setTimeout(() => message.style.display = "none", 2500);
}

function updateUI() {
  counter.textContent = `${items.length ? current + 1 : 0} / ${items.length}`;
  nameEl.textContent = items.length && current >= 0 ? items[current].name : "";
}

function show(index) {
  if (!items.length) return;
  index = (index + items.length) % items.length;
  if (index === current && sphere.material.map) return;

  current = index;
  const item = items[current];

  loader.load(item.url, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    sphere.material.map = texture;
    sphere.material.needsUpdate = true;
    updateUI();
  }, undefined, () => setMessage("Не удалось открыть изображение."));
}

function next() { if (items.length) show(current + 1); }
function previous() { if (items.length) show(current - 1); }

function addFiles(fileList) {
  const files = [...fileList].filter(f => /^image\/(jpeg|png)$/.test(f.type));
  if (!files.length) {
    setMessage("Нужны JPG, JPEG или PNG.");
    return;
  }

  for (const file of files) {
    items.push({
      name: file.name.replace(/\.[^.]+$/, ""),
      url: URL.createObjectURL(file)
    });
  }

  drop.style.display = "none";
  if (current < 0) show(0);
  else updateUI();
  setMessage(`Добавлено панорам: ${files.length}`);
}

input.addEventListener("change", e => addFiles(e.target.files));

["dragenter","dragover"].forEach(type => {
  window.addEventListener(type, e => {
    e.preventDefault();
    drop.classList.add("drag");
  });
});
["dragleave","drop"].forEach(type => {
  window.addEventListener(type, e => {
    e.preventDefault();
    drop.classList.remove("drag");
  });
});
window.addEventListener("drop", e => addFiles(e.dataTransfer.files));

window.addEventListener("keydown", e => {
  if (e.key === "ArrowRight") next();
  if (e.key === "ArrowLeft") previous();
  if (e.key.toLowerCase() === "a") next();
  if (e.key.toLowerCase() === "b") previous();
});

// Quest / WebXR controller mapping.
// On standard Oculus/Meta Touch controllers:
// A is the primary bottom/right-hand face button, B is the secondary top/right-hand face button.
const controllers = [];
const previousButtons = [];

function setupController(handedness) {
  const controller = renderer.xr.getController(controllers.length);
  controller.userData.handedness = handedness;
  controller.addEventListener("connected", e => {
    controller.userData.inputSource = e.data;
  });
  scene.add(controller);
  controllers.push(controller);
  previousButtons.push([]);
}

setupController("left");
setupController("right");

function pollControllers() {
  for (let i = 0; i < controllers.length; i++) {
    const inputSource = controllers[i].userData.inputSource;
    if (!inputSource?.gamepad) continue;

    const buttons = inputSource.gamepad.buttons;
    const prev = previousButtons[i];

    // Meta Touch: buttons 4/5 are commonly X/Y on left and A/B on right.
    // We only react to A/B on the right controller.
    if (inputSource.handedness === "right") {
      const a = buttons[4]?.pressed ?? false;
      const b = buttons[5]?.pressed ?? false;
      if (a && !prev.a) next();
      if (b && !prev.b) previous();
      prev.a = a;
      prev.b = b;
    }
  }
}

function animate() {
  pollControllers();
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

updateUI();
