const REFRESH_INTERVAL = 5 * 60 * 1000;
const MAX_TIME_SLOTS = 8;

const API_URL =
  "https://obsadenost-msh-api.programykcnitra.workers.dev/";

const courts = [
  {
    key: "left",
    name: "Ľavý kurt",
    apiName: "Ľavý"
  },
  {
    key: "right",
    name: "Pravý kurt",
    apiName: "Pravý"
  }
];

const statusLabels = {
  available: "VOĽNÝ",
  sold: "VYPREDANÉ",
  unknown: "NEOVERENÉ"
};

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getLocalMonthKey(date = new Date()) {
  return getLocalDateKey(date).slice(0, 7);
}

function formatDate(date) {
  return date.toLocaleDateString("sk-SK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatTime(date) {
  return date.toLocaleTimeString("sk-SK", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function getCourtFromName(name) {
  if (name.includes("(Ľavý)")) {
    return "left";
  }

  if (name.includes("(Pravý)")) {
    return "right";
  }

  return null;
}

function getTimeFromItem(item) {
  if (typeof item.time === "string" && /^\d{2}:\d{2}$/.test(item.time)) {
    return item.time;
  }

  if (Number.isInteger(item.hour)) {
    return `${String(item.hour).padStart(2, "0")}:00`;
  }

  return null;
}

function getItemStatus(item) {
  if (item.url === null) {
    return "sold";
  }

  if (typeof item.url === "string" && item.url.trim() !== "") {
    return "available";
  }

  return "unknown";
}

function setNotice(message, type = "info") {
  const notice = document.getElementById("data-notice");

  if (!notice) {
    return;
  }

  notice.textContent = message;

  notice.style.backgroundColor =
    type === "error" ? "#fee2e2" : "#ecfdf5";

  notice.style.color =
    type === "error" ? "#991b1b" : "#065f46";

  notice.style.borderColor =
    type === "error" ? "#fca5a5" : "#a7f3d0";
}

function showLoadingMessage(message) {
  const body = document.getElementById("calendar-body");

  if (body) {
    body.innerHTML = `
      <tr>
        <td colspan="3" class="loading-message">
          ${message}
        </td>
      </tr>
    `;
  }
}

function renderTableHeader() {
  const head = document.getElementById("calendar-head");

  if (!head) {
    return;
  }

  head.innerHTML = `
    <tr>
      <th scope="col">ČAS</th>
      <th scope="col">ĽAVÝ KURT</th>
      <th scope="col">PRAVÝ KURT</th>
    </tr>
  `;
}

function createStatusCell(status, courtName, time) {
  const label = statusLabels[status] || statusLabels.unknown;

  return `
    <td class="court-cell">
      <span
        class="status status-${status}"
        title="${courtName}, ${time}: ${label}"
      >
        ${label}
      </span>
    </td>
  `;
}

function renderAvailability(items, now) {
  const body = document.getElementById("calendar-body");

  if (!body) {
    return;
  }

  const currentDateKey = getLocalDateKey(now);
  const currentHour = now.getHours();

  // Vytvoríme mapu termínov podľa času a kurtu.
  const slots = new Map();

  for (const item of items) {
    const time = getTimeFromItem(item);

    if (!time) {
      continue;
    }

    const courtKey = getCourtFromName(item.name || "");

    if (!courtKey) {
      continue;
    }

    const hour = Number(time.slice(0, 2));

    // Nezobrazujeme termíny, ktoré sa už začali
    // v predchádzajúcich hodinách.
    if (hour < currentHour) {
      continue;
    }

    if (!slots.has(time)) {
      slots.set(time, {
        time,
        left: null,
        right: null
      });
    }

    const slot = slots.get(time);

    slot[courtKey] = {
      status: getItemStatus(item),
      item
    };
  }

  // Zobrazíme najviac 8 najbližších časov,
  // ktoré sú uvedené v odpovedi rezervačného systému.
  const visibleSlots = Array.from(slots.values())
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, MAX_TIME_SLOTS);

  if (visibleSlots.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="3" class="loading-message">
          Na dnešok sa nenašli žiadne ďalšie hodinové termíny.
        </td>
      </tr>
    `;

    setNotice(
      "Spojenie s rezervačným systémom funguje, " +
      "ale v odpovedi nie sú ďalšie dnešné termíny."
    );

    return;
  }

  body.innerHTML = visibleSlots.map(slot => {
    const leftStatus = slot.left
      ? slot.left.status
      : "unknown";

    const rightStatus = slot.right
      ? slot.right.status
      : "unknown";

    const bothSoldOut =
      leftStatus === "sold" &&
      rightStatus === "sold";

    const rowClass = bothSoldOut
      ? "sold-out-row"
      : "";

    const timeMarkup = bothSoldOut
      ? `<span class="sold-out-time">${slot.time}</span>`
      : slot.time;

    return `
      <tr class="${rowClass}">
        <th scope="row" class="time-cell">
          ${timeMarkup}
        </th>

        ${createStatusCell(
          leftStatus,
          courts[0].name,
          slot.time
        )}

        ${createStatusCell(
          rightStatus,
          courts[1].name,
          slot.time
        )}
      </tr>
    `;
  }).join("");

  const fullySoldOutCount = visibleSlots.filter(slot =>
    slot.left?.status === "sold" &&
    slot.right?.status === "sold"
  ).length;

  setNotice(
    `Živé údaje z rezervačného systému Nitra.sk. ` +
    `Zobrazených termínov: ${visibleSlots.length}. ` +
    `Vypredané termíny: ${fullySoldOutCount}. ` +
    `Automatická aktualizácia každých 5 minút.`
  );
}

async function loadAvailability() {
  const now = new Date();

  const currentDate = document.getElementById("current-date");
  const lastUpdate = document.getElementById("last-update");

  if (!currentDate || !lastUpdate) {
    console.error(
      "Nepodarilo sa nájsť prvky dátumu alebo poslednej aktualizácie."
    );

    return;
  }

  currentDate.textContent = formatDate(now);

  renderTableHeader();

  showLoadingMessage("Načítavam skutočnú dostupnosť kurtov...");

  try {
    const month = getLocalMonthKey(now);

    const response = await fetch(
      `${API_URL}?month=${encodeURIComponent(month)}`,
      {
        method: "GET",
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `Cloudflare Worker vrátil HTTP ${response.status}.`
      );
    }

    const result = await response.json();

    if (
      result?.success !== true ||
      !result?.data?.days
    ) {
      throw new Error(
        result?.error ||
        "Odpoveď neobsahuje očakávané údaje o termínoch."
      );
    }

    const todayKey = getLocalDateKey(now);
    const todayItems = result.data.days[todayKey];

    if (!Array.isArray(todayItems)) {
      renderAvailability([], now);
      lastUpdate.textContent = formatTime(new Date());

      console.log(
        "Rezervačný systém nevrátil termíny pre dnešný dátum:",
        todayKey
      );

      return;
    }

    renderAvailability(todayItems, now);

    lastUpdate.textContent = formatTime(new Date());

    console.log(
      "Dostupnosť úspešne načítaná.",
      {
        date: todayKey,
        numberOfRecords: todayItems.length
      }
    );

  } catch (error) {
    console.error(
      "Nepodarilo sa načítať dostupnosť kurtov:",
      error
    );

    showLoadingMessage(
      "Údaje sa nepodarilo načítať. Skontroluj spojenie."
    );

    setNotice(
      `Chyba pri načítaní údajov: ${error.message}. ` +
      "Dashboard sa pokúsi obnoviť údaje o 5 minút.",
      "error"
    );
  }
}

// Prvé načítanie po otvorení stránky.
loadAvailability();

// Automatická aktualizácia každých 5 minút.
setInterval(() => {
  loadAvailability();
}, REFRESH_INTERVAL);