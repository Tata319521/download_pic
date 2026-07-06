"use strict";

const CATEGORY_LABELS = {
  player: "玩家",
  boss: "BOSS",
  npc: "NPC"
};

const DB_NAME = "oc-card-archive-db";
const DB_VERSION = 1;
const STORE_NAME = "local-cards";
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

const gallery = document.getElementById("gallery");
const searchInput = document.getElementById("search-input");
const categoryFilter = document.getElementById("category-filter");
const resultCount = document.getElementById("result-count");
const activeFilter = document.getElementById("active-filter");
const emptyState = document.getElementById("empty-state");
const addCardButton = document.getElementById("add-card-button");
const downloadVisibleButton = document.getElementById("download-visible-button");
const clearFilterButton = document.getElementById("clear-filter-button");
const cardDialog = document.getElementById("card-dialog");
const cardForm = document.getElementById("card-form");
const cardImage = document.getElementById("card-image");
const previewDialog = document.getElementById("preview-dialog");
const previewImage = document.getElementById("preview-image");
const previewName = document.getElementById("preview-name");
const previewMeta = document.getElementById("preview-meta");
const toast = document.getElementById("toast");

let allCards = [];
let visibleCards = [];
let activeObjectUrls = [];
let toastTimer = null;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getLocalCards() {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();

    request.onsuccess = () => {
      database.close();
      resolve(request.result.sort((a, b) => b.createdAt - a.createdAt));
    };
    request.onerror = () => {
      database.close();
      reject(request.error);
    };
  });
}

async function saveLocalCard(card) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(card);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

async function removeLocalCard(id) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

function revokeObjectUrls() {
  activeObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  activeObjectUrls = [];
}

function getCardImageUrl(card) {
  if (card.imageBlob instanceof Blob) {
    const url = URL.createObjectURL(card.imageBlob);
    activeObjectUrls.push(url);
    return url;
  }
  return card.image;
}

function normalizeText(value) {
  return String(value || "").trim().toLocaleLowerCase("zh-CN");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function filterCards() {
  const keyword = normalizeText(searchInput.value);
  const category = categoryFilter.value;

  visibleCards = allCards.filter((card) => {
    const matchesCategory = category === "all" || card.category === category;
    const haystack = normalizeText(`${card.name} ${card.owner} ${card.description}`);
    const matchesKeyword = !keyword || haystack.includes(keyword);
    return matchesCategory && matchesKeyword;
  });

  renderCards();
}

function renderCards() {
  revokeObjectUrls();
  gallery.innerHTML = "";

  visibleCards.forEach((card, index) => {
    const article = document.createElement("article");
    article.className = "image-card";
    article.dataset.cardId = card.id;

    const imageUrl = getCardImageUrl(card);
    const ownerText = card.owner ? `玩家 / 创作者：${escapeHtml(card.owner)}` : "未填写玩家 / 创作者";
    const description = card.description || "暂无角色简介。";
    const deleteButton = card.isLocal
      ? `<button class="card-action danger-action" type="button" data-action="delete">删除</button>`
      : "";

    article.innerHTML = `
      <button class="image-frame" type="button" data-action="preview" aria-label="查看 ${escapeHtml(card.name)} 的大图">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(card.name)} 的设卡" loading="lazy" />
        <span class="image-number">NO.${String(index + 1).padStart(2, "0")}</span>
        <span class="category-tag category-${escapeHtml(card.category)}">${CATEGORY_LABELS[card.category] || "其他"}</span>
        <span class="view-hint">点击查看大图</span>
      </button>
      <div class="image-info">
        <div class="card-heading">
          <div>
            <h2>${escapeHtml(card.name)}</h2>
            <p class="owner-line">${ownerText}</p>
          </div>
        </div>
        <p class="description">${escapeHtml(description)}</p>
        <div class="card-actions">
          <button class="card-action" type="button" data-action="preview">查看</button>
          <button class="card-action primary-action" type="button" data-action="download">下载</button>
          ${deleteButton}
        </div>
      </div>
    `;

    gallery.appendChild(article);
  });

  const categoryName = categoryFilter.value === "all"
    ? "全部分类"
    : CATEGORY_LABELS[categoryFilter.value];
  const keyword = searchInput.value.trim();

  resultCount.textContent = `共找到 ${visibleCards.length} 张设卡`;
  activeFilter.textContent = keyword
    ? `${categoryName} · 搜索“${keyword}”`
    : `显示 ${categoryName}`;

  const hasResults = visibleCards.length > 0;
  gallery.hidden = !hasResults;
  emptyState.hidden = hasResults;
  downloadVisibleButton.disabled = !hasResults;
}

function findCardFromButton(button) {
  const cardElement = button.closest(".image-card");
  return allCards.find((card) => card.id === cardElement?.dataset.cardId);
}

function openPreview(card) {
  if (!card) return;

  let imageUrl;
  if (card.imageBlob instanceof Blob) {
    imageUrl = URL.createObjectURL(card.imageBlob);
    previewDialog.dataset.objectUrl = imageUrl;
  } else {
    imageUrl = card.image;
  }

  previewImage.src = imageUrl;
  previewImage.alt = `${card.name} 的设卡大图`;
  previewName.textContent = card.name;
  previewMeta.textContent = `${CATEGORY_LABELS[card.category] || "其他"}${card.owner ? ` · ${card.owner}` : ""}`;
  previewDialog.showModal();
}

function closePreview() {
  previewDialog.close();
  previewImage.src = "";

  if (previewDialog.dataset.objectUrl) {
    URL.revokeObjectURL(previewDialog.dataset.objectUrl);
    delete previewDialog.dataset.objectUrl;
  }
}

function sanitizeFilename(value) {
  return String(value || "character-card")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-") || "character-card";
}

function extensionFromMime(mimeType) {
  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg"
  };
  return extensions[mimeType] || "png";
}

async function downloadCard(card, delay = 0) {
  if (!card) return;

  await new Promise((resolve) => setTimeout(resolve, delay));

  let blob;
  if (card.imageBlob instanceof Blob) {
    blob = card.imageBlob;
  } else {
    const response = await fetch(card.image);
    if (!response.ok) throw new Error(`无法读取图片：${card.image}`);
    blob = await response.blob();
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFilename(card.name)}.${extensionFromMime(blob.type)}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showToast(message, type = "success") {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

async function refreshCards() {
  try {
    const publicCards = Array.isArray(window.PUBLIC_CARD_DATA)
      ? window.PUBLIC_CARD_DATA.map((card) => ({ ...card, isLocal: false }))
      : [];
    const localCards = (await getLocalCards()).map((card) => ({ ...card, isLocal: true }));
    allCards = [...localCards, ...publicCards];
    filterCards();
  } catch (error) {
    console.error(error);
    allCards = Array.isArray(window.PUBLIC_CARD_DATA)
      ? window.PUBLIC_CARD_DATA.map((card) => ({ ...card, isLocal: false }))
      : [];
    filterCards();
    showToast("本地设卡读取失败，已显示公开设卡。", "error");
  }
}

searchInput.addEventListener("input", filterCards);
categoryFilter.addEventListener("change", filterCards);

clearFilterButton.addEventListener("click", () => {
  searchInput.value = "";
  categoryFilter.value = "all";
  filterCards();
  searchInput.focus();
});

addCardButton.addEventListener("click", () => {
  cardForm.reset();
  cardDialog.showModal();
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => cardDialog.close());
});

document.querySelectorAll("[data-close-preview]").forEach((button) => {
  button.addEventListener("click", closePreview);
});

cardDialog.addEventListener("click", (event) => {
  if (event.target === cardDialog) cardDialog.close();
});

previewDialog.addEventListener("click", (event) => {
  if (event.target === previewDialog) closePreview();
});

previewDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closePreview();
});

cardForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = cardImage.files?.[0];
  if (!file) {
    showToast("请先选择一张设卡图片。", "error");
    return;
  }

  if (file.size > MAX_IMAGE_SIZE) {
    showToast("图片超过 8 MB，请压缩后再录入。", "error");
    return;
  }

  const card = {
    id: `local-${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(16).slice(2)}`,
    name: document.getElementById("card-name").value.trim(),
    category: document.getElementById("card-category").value,
    owner: document.getElementById("card-owner").value.trim(),
    description: document.getElementById("card-description").value.trim(),
    imageBlob: file,
    originalFilename: file.name,
    createdAt: Date.now()
  };

  try {
    await saveLocalCard(card);
    cardDialog.close();
    await refreshCards();
    showToast(`已保存“${card.name}”的设卡。`);
  } catch (error) {
    console.error(error);
    showToast("保存失败，浏览器存储空间可能不足。", "error");
  }
});

gallery.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const card = findCardFromButton(button);
  const action = button.dataset.action;

  if (action === "preview") {
    openPreview(card);
    return;
  }

  if (action === "download") {
    try {
      await downloadCard(card);
      showToast(`已开始下载“${card.name}”。`);
    } catch (error) {
      console.error(error);
      showToast("图片下载失败，请检查图片路径。", "error");
    }
    return;
  }

  if (action === "delete" && card?.isLocal) {
    const confirmed = window.confirm(`确定删除“${card.name}”的本地设卡吗？`);
    if (!confirmed) return;

    try {
      await removeLocalCard(card.id);
      await refreshCards();
      showToast(`已删除“${card.name}”。`);
    } catch (error) {
      console.error(error);
      showToast("删除失败，请稍后重试。", "error");
    }
  }
});

downloadVisibleButton.addEventListener("click", async () => {
  if (!visibleCards.length) return;

  showToast(`正在依次下载 ${visibleCards.length} 张设卡……`);

  for (let index = 0; index < visibleCards.length; index += 1) {
    try {
      await downloadCard(visibleCards[index], index === 0 ? 0 : 350);
    } catch (error) {
      console.error(error);
    }
  }
});

const canvas = document.getElementById("particle-canvas");
const context = canvas.getContext("2d");
let particles = [];

function resizeCanvas() {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * pixelRatio;
  canvas.height = window.innerHeight * pixelRatio;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function createParticles() {
  particles = [];
  const count = Math.min(80, Math.floor(window.innerWidth / 18));

  for (let index = 0; index < count; index += 1) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      radius: Math.random() * 1.5 + 0.4,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      alpha: Math.random() * 0.35 + 0.08
    });
  }
}

function drawParticles() {
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);

  particles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;

    if (particle.x < 0 || particle.x > window.innerWidth) particle.vx *= -1;
    if (particle.y < 0 || particle.y > window.innerHeight) particle.vy *= -1;

    context.beginPath();
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fillStyle = `rgba(255, 255, 255, ${particle.alpha})`;
    context.fill();
  });

  requestAnimationFrame(drawParticles);
}

window.addEventListener("resize", () => {
  resizeCanvas();
  createParticles();
});

window.addEventListener("beforeunload", revokeObjectUrls);

resizeCanvas();
createParticles();
drawParticles();
refreshCards();
