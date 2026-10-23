const REFRESH_INTERVAL = 5 * 60 * 1000;
const MAX_TIME_SLOTS = 8;

const API_URL =
  "https://obsadenost-msh-api.programykcnitra.workers.dev/";

const courts = [
  {
    key: "left",
    name: "Ľavý kurt"
  },
  {
    key: "right",
    name: "Pravý kurt"
  }
];

const statusLabels = {
  available: "VOĽNÝ",
  sold: "VYPREDANÉ",
  unknown: "NEOVERENÉ"
};

/* =========================================
   DÁTUM A ČAS
   ========================================= */

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

/* =========================================
   SPRACOVANIE ÚDAJOV Z REZERVAČNÉHO SYSTÉMU
   ========================================= */

function getCourtFromName(name) {
  if (typeof name !== "string") {
    return null;
  }

  if (name.includes("(Ľavý)")) {
    return "left";
  }

  if (name.includes("(Pravý)")) {
    return "right";
  }

  return null;
}

function getTimeFromItem(item) {
  if (
    typeof item.time === "string" &&
    /^\d{2}:\d{2}$/.test(item.time)
  ) {
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

  if (
    typeof item.url === "string" &&
    item.url.trim() !== ""
  ) {
    return "available";
  }

  return "unknown";
}

/* =========================================
   INFORMAČNÁ SPRÁVA
   ========================================= */

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

/* =========================================
   NAČÍTAVACÍ STAV
   ========================================= */

function showLoadingMessage(message) {
  const body = document.getElementById("calendar-body");

  if (!body) {
    return;
  }

  body.innerHTML = `
    <tr>
      <td colspan="9" class="loading-message">
        ${message}
      </td>
    </tr>
  `;
}

/* =========================================
   HLAVIČKA TABUĽKY
   Kurty budú v riadkoch,
   hodinové termíny v stĺpcoch.
   ========================================= */

function renderTableHeader(slots) {
  const head = document.getElementById("calendar-head");

  if (!head) {
    return;
  }

  head.innerHTML = `
    <tr>
      <th scope="col" class="court-heading">
        KURT
      </th>

      ${slots.map(slot => {
        const bothSoldOut =
          slot.left?.status === "sold" &&
          slot.right?.status === "sold";

        return `
          <th
            scope="col"
            class="time-heading ${bothSoldOut ? "sold-out-column" : ""}"
          >
            <span class="${bothSoldOut ? "sold-out-time" : ""}">
              ${slot.time}
            </span>
          </th>
        `;
      }).join("")}
    </tr>
  `;
}

/* =========================================
   STAVOVÝ ŠTÍTOK
   ========================================= */

function createStatusCell(status, courtName, time) {
  const label =
    statusLabels[status] || statusLabels.unknown;

  return `
    <td class="court-cell status-cell-${status}">
      <span
        class="status status-${status}"
        title="${courtName}, ${time}: ${label}"
      >
        ${label}
      </span>
    </td>
  `;
}

/* =========================================
   VÝBER NAJBLIŽŠÍCH TERMÍNOV
   ========================================= */

function prepareTimeSlots(items, now) {
  const currentHour = now.getHours();
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
    const minute = Number(time.slice(3, 5));

    // Nezobrazujeme už začaté ani minulé termíny.
    const slotStart = new Date(now);
    slotStart.setHours(hour, minute, 0, 0);

    if (slotStart <= now) {
      continue;
    }

    if (!slots.has(time)) {
      slots.set(time, {
        time,
        left: null,
        right: null
      });
    }

    slots.get(time)[courtKey] = {
      status: getItemStatus(item),
      item
    };
  }

  return Array.from(slots.values())
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, MAX_TIME_SLOTS);
}

/* =========================================
   VYKRESLENIE TABUĽKY
   ========================================= */

function renderAvailability(items, now) {
  const body = document.getElementById("calendar-body");

  if (!body) {
    return;
  }

  const visibleSlots = prepareTimeSlots(items, now);

  if (visibleSlots.length === 0) {
    renderTableHeader([]);

    body.innerHTML = `
      <tr>
        <td colspan="9" class="loading-message">
          Na dnešok sa nenašli žiadne ďalšie hodinové termíny.
        </td>
      </tr>
    `;

    setNotice(
      "Spojenie s rezervačným systémom funguje, " +
      "ale na dnešok už nie sú dostupné ďalšie hodinové termíny."
    );

    return;
  }

  renderTableHeader(visibleSlots);

  body.innerHTML = courts.map(court => {
    return `
      <tr class="court-row court-row-${court.key}">
        <th scope="row" class="court-name-cell">
          ${court.name}
        </th>

        ${visibleSlots.map(slot => {
          const courtData = slot[court.key];

          const status = courtData
            ? courtData.status
            : "unknown";

          return createStatusCell(
            status,
            court.name,
            slot.time
          );
        }).join("")}
      </tr>
    `;
  }).join("");

  // Označenie termínov, v ktorých sú oba kurty vypredané.
  visibleSlots.forEach(slot => {
    const bothSoldOut =
      slot.left?.status === "sold" &&
      slot.right?.status === "sold";

    if (!bothSoldOut) {
      return;
    }

    const columnIndex = visibleSlots.indexOf(slot) + 2;

    const headerCell = document.querySelector(
      `#calendar-head th:nth-child(${columnIndex})`
    );

    if (headerCell) {
      headerCell.classList.add("sold-out-column");

      const timeElement = headerCell.querySelector("span");

      if (timeElement) {
        timeElement.classList.add("sold-out-time");
      }
    }

    const bodyCells = document.querySelectorAll(
      `#calendar-body tr td:nth-child(${columnIndex})`
    );

    bodyCells.forEach(cell => {
      cell.classList.add("sold-out-cell");
    });
  });

  const fullySoldOutCount = visibleSlots.filter(slot =>
    slot.left?.status === "sold" &&
    slot.right?.status === "sold"
  ).length;

  const unknownCount = visibleSlots.reduce((count, slot) => {
    let unknown = 0;

    if (!slot.left || slot.left.status === "unknown") {
      unknown++;
    }

    if (!slot.right || slot.right.status === "unknown") {
      unknown++;
    }

    return count + unknown;
  }, 0);

  setNotice(
    `Živé údaje z rezervačného systému Nitra.sk. ` +
    `Zobrazených termínov: ${visibleSlots.length}. ` +
    `Úplne vypredané termíny: ${fullySoldOutCount}. ` +
    `Neoverené stavy kurtov: ${unknownCount}. ` +
    `Automatická aktualizácia každých 5 minút.`
  );
}

/* =========================================
   NAČÍTANIE DÁT Z CLOUDFLARE WORKERA
   ========================================= */

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
      renderTableHeader([]);

      const body = document.getElementById("calendar-body");

      if (body) {
        body.innerHTML = `
          <tr>
            <td colspan="9" class="loading-message">
              Rezervačný systém nevrátil termíny pre dnešný dátum.
            </td>
          </tr>
        `;
      }

      lastUpdate.textContent = formatTime(new Date());

      setNotice(
        `Dáta boli načítané, ale pre dnešný dátum (${todayKey}) ` +
        "sa nenašli žiadne termíny.",
        "error"
      );

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

/* =========================================
   SPUSTENIE A AUTOMATICKÁ AKTUALIZÁCIA
   ========================================= */

loadAvailability();

setInterval(() => {
  loadAvailability();
}, REFRESH_INTERVAL);