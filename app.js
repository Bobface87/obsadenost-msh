const REFRESH_INTERVAL = 5 * 60 * 1000;

const courts = [
  "Kurt 1",
  "Kurt 2",
  "Kurt 3",
  "Kurt 4"
];

const timeSlots = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00"
];

// TESTOVACIE ÚDAJE – neskôr ich nahradíme skutočnými dátami.
const testAvailability = [
  ["available", "sold", "available", "unknown"],
  ["sold", "available", "available", "sold"],
  ["available", "available", "sold", "available"],
  ["sold", "sold", "available", "available"],
  ["available", "unknown", "sold", "available"],
  ["available", "sold", "available", "sold"],
  ["unknown", "available", "available", "sold"],
  ["sold", "available", "sold", "available"]
];

const statusLabels = {
  available: "Voľné",
  sold: "Vypredané",
  unknown: "Neznáme"
};

function formatDate(date) {
  return date.toLocaleDateString("sk-SK", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  });
}

function renderDashboard() {
  const today = new Date();
  const head = document.getElementById("calendar-head");
  const body = document.getElementById("calendar-body");
  const currentDate = document.getElementById("current-date");
  const lastUpdate = document.getElementById("last-update");

  if (!head || !body || !currentDate || !lastUpdate) {
    console.error("Nepodarilo sa nájsť potrebné prvky v index.html.");
    return;
  }

  currentDate.textContent = today.toLocaleDateString("sk-SK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  head.innerHTML = `
    <tr>
      <th>Čas</th>
      ${courts.map(court => `<th>${court}</th>`).join("")}
    </tr>
  `;

  body.innerHTML = timeSlots.map((time, rowIndex) => {
    const cells = courts.map((court, courtIndex) => {
      const status = testAvailability[rowIndex][courtIndex];

      return `
        <td>
          <span class="status status-${status}"
                title="${court}, ${time}: ${statusLabels[status]}">
            ${statusLabels[status]}
          </span>
        </td>
      `;
    }).join("");

    return `
      <tr>
        <th scope="row">${time}</th>
        ${cells}
      </tr>
    `;
  }).join("");

  lastUpdate.textContent = today.toLocaleTimeString("sk-SK", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  console.log("Testovací dashboard bol aktualizovaný.");
}

function showTestNotice() {
  const notice = document.getElementById("data-notice");

  if (notice) {
    notice.textContent =
      "TESTOVACÍ REŽIM: Zobrazené stavy sú vymyslené. " +
      "Dashboard zatiaľ nie je pripojený k rezervačnému systému.";
  }
}

renderDashboard();
showTestNotice();

setInterval(() => {
  renderDashboard();
}, REFRESH_INTERVAL);