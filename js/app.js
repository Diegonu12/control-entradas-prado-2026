import {
  $,
  downloadText,
  errorMessage,
  escapeHtml,
  formatDate,
  hoyISO,
  normClient,
  normNumber
} from "./utils.js";

import {
  login,
  logout,
  observeAuth
} from "./auth.js";

import {
  createDelivery,
  migrateLegacy,
  removeDelivery,
  updateDelivery,
  watchDeliveries
} from "./entregas-service.js";


/* =========================================================
   PERSONAS QUE ENTREGAN ENTRADAS
========================================================= */

const PERSONAS_ENTREGA = [
  "Lea Olivera",
  "Milagros Herrera",
  "Sebastian Briz",
  "Marcos Planchon",
  "Diego Young",
  "Marcelo Piquet",
  "Maria Paula Rovira",
  "Paula De Oliveira",
  "Paula Deo"
];


/* =========================================================
   VARIABLES GENERALES
========================================================= */

const LEGACY_KEY = "agroventas_rural_prado_2026_entregas";

let deliveries = [];
let editingId = null;
let stopWatch = null;
let installPrompt = null;
let cameraStream = null;
let scanTimer = null;


/* =========================================================
   ELEMENTOS OPCIONALES
========================================================= */

const getOptionalElement = id => document.getElementById(id);


/* =========================================================
   MENSAJES
========================================================= */

const toast = (message, error = false) => {
  const element = $("toast");

  element.textContent = message;
  element.classList.toggle("error", error);
  element.classList.add("show");

  clearTimeout(window.__toast);

  window.__toast = setTimeout(() => {
    element.classList.remove("show");
  }, 3200);
};




/* =========================================================
   CARGAR PERSONAS SUGERIDAS
========================================================= */

function loadDeliveryPeople() {
  const dataList =
    getOptionalElement("lista-entregadores");

  if (!dataList) {
    return;
  }

  dataList.innerHTML = PERSONAS_ENTREGA.map(persona => {
    return `
      <option value="${escapeHtml(persona)}"></option>
    `;
  }).join("");
}




/* =========================================================
   OBTENER DATOS DE LOS FORMULARIOS
========================================================= */

const dataFrom = (prefix = "e-") => {
  const deliveryPersonElement =
    getOptionalElement(prefix + "vendedor");

  return {
    cliente: $(prefix + "cliente").value.trim(),
    numero: $(prefix + "numero").value.trim(),
    tipo: $(prefix + "tipo").value,
    dia: $(prefix + "dia").value,

    entregadoPor: deliveryPersonElement
      ? deliveryPersonElement.value.trim()
      : ""
  };
};

/* =========================================================
   VALIDACIÓN
========================================================= */

function validate(data, currentId = null) {
  if (!data.cliente) {
    toast("Ingresá el nombre del cliente.", true);
    return false;
  }

  if (!data.numero) {
    toast("Ingresá el número de entrada.", true);
    return false;
  }

  if (!data.entregadoPor) {
  toast("Ingresá quién realizó la entrega.", true);
  return false;
}

  if (data.tipo === "Dia" && !data.dia) {
    toast("Indicá el día de acceso.", true);
    return false;
  }

  const duplicate = deliveries.find(delivery => {
    return (
      delivery.id !== currentId &&
      normNumber(delivery.numero) === normNumber(data.numero)
    );
  });

  if (duplicate) {
    toast(
      `La entrada N.º ${data.numero} ya fue entregada a ${duplicate.cliente}.`,
      true
    );

    return false;
  }

  return true;
}


/* =========================================================
   CAMPO DÍA
========================================================= */

function toggleDay(prefix = "e-") {
  const box = prefix === "e-"
    ? $("campo-dia")
    : $("edit-campo-dia");

  box.hidden = $(prefix + "tipo").value !== "Dia";
}


/* =========================================================
   ORDENAR ENTREGAS
========================================================= */

function sortedRows(rows) {
  return [...rows].sort((a, b) => {
    const dateA = `${a.fechaEntrega || ""} ${a.horaEntrega || ""}`;
    const dateB = `${b.fechaEntrega || ""} ${b.horaEntrega || ""}`;

    return dateB.localeCompare(dateA);
  });
}


/* =========================================================
   ESTADÍSTICAS
========================================================= */

function renderStats() {
  const today = hoyISO();

  $("stat-total").textContent = deliveries.length;

  $("stat-hoy").textContent = deliveries.filter(delivery => {
    return delivery.fechaEntrega === today;
  }).length;

  $("stat-dia").textContent = deliveries.filter(delivery => {
    return delivery.tipoAcceso === "Dia";
  }).length;

  $("stat-libre").textContent = deliveries.filter(delivery => {
    return delivery.tipoAcceso === "Libre";
  }).length;
}


/* =========================================================
   GRÁFICO
========================================================= */

function renderChart() {
  const countByDate = {};

  deliveries.forEach(delivery => {
    const date = delivery.fechaEntrega || "Sin fecha";

    countByDate[date] = (countByDate[date] || 0) + 1;
  });

  const rows = Object.entries(countByDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8);

  if (!rows.length) {
    $("grafico").innerHTML = `
      <div class="empty">
        Todavía no hay datos.
      </div>
    `;

    return;
  }

  const maximum = Math.max(...rows.map(row => row[1]));

  $("grafico").innerHTML = rows.map(([date, quantity]) => {
    const width = Math.max(8, quantity / maximum * 100);

    return `
      <div class="bar-row">
        <span>${formatDate(date)}</span>

        <div class="bar-track">
          <div
            class="bar"
            style="width: ${width}%"
          ></div>
        </div>

        <strong>${quantity}</strong>
      </div>
    `;
  }).join("");
}


/* =========================================================
   FILTROS
========================================================= */

function filtered() {
  const query = $("buscar")
    .value
    .trim()
    .toLocaleLowerCase("es");

  const type = $("filtro-tipo").value;
  const date = $("filtro-fecha").value;

  const sellerFilter = getOptionalElement("filtro-vendedor");

  const selectedSeller = sellerFilter
    ? sellerFilter.value
    : "Todos";

  return deliveries.filter(delivery => {
   const deliveryPerson =
  delivery.entregadoPor ||
  delivery.vendedor ||
  "Sin especificar";

    const matchesSearch =
      !query ||
      String(delivery.cliente || "")
        .toLocaleLowerCase("es")
        .includes(query) ||
      String(delivery.numero || "")
        .toLocaleLowerCase("es")
        .includes(query) ||
      deliveryPerson
  .toLocaleLowerCase("es")
  .includes(query);

    const matchesType =
      type === "Todos" ||
      delivery.tipoAcceso === type;

    const matchesDate =
      !date ||
      delivery.fechaEntrega === date;

    const matchesSeller =
  selectedSeller === "Todos" ||
  deliveryPerson === selectedSeller;

    return (
      matchesSearch &&
      matchesType &&
      matchesDate &&
      matchesSeller
    );
  });
}


/* =========================================================
   TABLA DE ENTREGAS
========================================================= */

function renderTable() {
  const rows = filtered();

  $("contador-resultados").textContent =
    `${rows.length} resultado${rows.length === 1 ? "" : "s"}`;

  $("vacio-lista").hidden = rows.length > 0;

  $("tabla-entregas").innerHTML = rows.map(delivery => {
    const deliveryPerson =
  delivery.entregadoPor ||
  delivery.vendedor ||
  "Sin especificar";

    return `
      <tr>
        <td data-label="Cliente">
          ${escapeHtml(delivery.cliente)}
        </td>

        <td data-label="N.º">
          #${escapeHtml(delivery.numero)}
        </td>

        <td data-label="Entregado por">
           ${escapeHtml(deliveryPerson)}
          </td>

        <td data-label="Tipo">
          <span class="pill ${
            delivery.tipoAcceso === "Libre"
              ? "free"
              : "day"
          }">
            ${
              delivery.tipoAcceso === "Libre"
                ? "Pase libre"
                : "Un día"
            }
          </span>
        </td>

        <td data-label="Acceso">
          ${
            delivery.tipoAcceso === "Dia"
              ? formatDate(delivery.diaAcceso)
              : "Todos los días"
          }
        </td>

        <td data-label="Entrega">
          ${formatDate(delivery.fechaEntrega)}
          ·
          ${escapeHtml(delivery.horaEntrega || "")}
        </td>

        <td data-label="Acciones">
          <div class="row-actions">
            <button
              type="button"
              class="mini-btn"
              data-edit="${delivery.id}"
            >
              Editar
            </button>

            <button
              type="button"
              class="mini-btn danger"
              data-del="${delivery.id}"
            >
              Eliminar
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  document.querySelectorAll("[data-edit]").forEach(button => {
    button.onclick = () => {
      openEdit(button.dataset.edit);
    };
  });

  document.querySelectorAll("[data-del]").forEach(button => {
    button.onclick = () => {
      remove(button.dataset.del);
    };
  });
}


/* =========================================================
   RENDERIZADO GENERAL
========================================================= */

const renderAll = () => {
  renderStats();
  renderChart();
  renderTable();
};


/* =========================================================
   CREAR ENTREGA
========================================================= */

async function submitNew(event) {
  event.preventDefault();

  const data = dataFrom();

  if (!validate(data)) {
    return;
  }

  const sameClient = deliveries.find(delivery => {
    return (
      normClient(delivery.cliente) ===
      normClient(data.cliente)
    );
  });

  if (
    sameClient &&
    !confirm(
      `${sameClient.cliente} ya tiene la entrada N.º ${sameClient.numero}. ` +
      `¿Registrar otra igualmente?`
    )
  ) {
    return;
  }

  const button = $("btn-entregar");

  button.disabled = true;
  button.textContent = "Guardando…";

  try {
    await createDelivery(data);

    $("form-entrega").reset();
    $("e-dia").value = hoyISO();    
    
    toggleDay();

    navigator.vibrate?.([70, 40, 100]);

    toast(
      navigator.onLine
        ? "Entrega registrada y sincronizada."
        : "Entrega guardada. Se sincronizará al volver Internet."
    );

    $("e-cliente").focus();
  } catch (error) {
    if (error.code === "duplicate") {
      toast(
        `Ese número ya fue registrado${
          error.existing?.cliente
            ? ` a ${error.existing.cliente}`
            : ""
        }.`,
        true
      );
    } else {
      console.error(error);
      toast(errorMessage(error), true);
    }
  } finally {
    button.disabled = false;
    button.textContent = "Registrar entrega";
  }
}


/* =========================================================
   ABRIR EDICIÓN
========================================================= */

function openEdit(id) {
  const delivery = deliveries.find(item => item.id === id);

  if (!delivery) {
    toast("No se encontró la entrega.", true);
    return;
  }

  editingId = id;

  $("edit-cliente").value =
    delivery.cliente || "";

  $("edit-numero").value =
    delivery.numero || "";

  $("edit-tipo").value =
    delivery.tipoAcceso || "Dia";

  $("edit-dia").value =
    delivery.diaAcceso || hoyISO();

  const editDeliveryPerson =
    getOptionalElement("edit-vendedor");

  if (editDeliveryPerson) {
    editDeliveryPerson.value =
      delivery.entregadoPor ||
      delivery.vendedor ||
      "";
  }

  toggleDay("edit-");

  $("modal-editar").showModal();
}

/* =========================================================
   GUARDAR EDICIÓN
========================================================= */

async function submitEdit(event) {
  event.preventDefault();

  const data = dataFrom("edit-");

  if (!validate(data, editingId)) {
    return;
  }

  const previousDelivery = deliveries.find(delivery => {
    return delivery.id === editingId;
  });

  try {
    await updateDelivery(
      editingId,
      data,
      previousDelivery
    );

    $("modal-editar").close();

    toast("Entrega actualizada.");
  } catch (error) {
    if (error.code === "duplicate") {
      toast(
        "Ese número ya está registrado.",
        true
      );
    } else {
      console.error(error);
      toast(errorMessage(error), true);
    }
  }
}


/* =========================================================
   ELIMINAR ENTREGA
========================================================= */

async function remove(id) {
  const delivery = deliveries.find(item => item.id === id);

  if (!delivery) {
    return;
  }

  const confirmed = confirm(
    `¿Eliminar la entrada N.º ${delivery.numero} ` +
    `entregada a ${delivery.cliente}?`
  );

  if (!confirmed) {
    return;
  }

  try {
    await removeDelivery(id);

    toast("Entrega eliminada.");
  } catch (error) {
    console.error(error);
    toast(errorMessage(error), true);
  }
}


/* =========================================================
   EXPORTAR CSV
========================================================= */

function exportCsv() {
  const rows = filtered();

  if (!rows.length) {
    toast("No hay datos para exportar.", true);
    return;
  }

  const header = [
    "Cliente",
    "Numero",
    "Entregado por",
    "Tipo",
    "Dia de acceso",
    "Fecha de entrega",
    "Hora"
  ];

  const escapeCsv = value => {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  };

  const csvRows = rows.map(delivery => {
    return [
      delivery.cliente,
      delivery.numero,
      delivery.entregadoPor ||
      delivery.vendedor ||
       "Sin especificar",
      delivery.tipoAcceso === "Libre"
        ? "Pase libre"
        : "Entrada de un día",
      delivery.tipoAcceso === "Dia"
        ? formatDate(delivery.diaAcceso)
        : "Todos los días",
      formatDate(delivery.fechaEntrega),
      delivery.horaEntrega || ""
    ];
  });

  const csv = [
    header,
    ...csvRows
  ]
    .map(row => row.map(escapeCsv).join(";"))
    .join("\n");

  downloadText(
    `entregas-rural-prado-${hoyISO()}.csv`,
    `\uFEFF${csv}`,
    "text/csv;charset=utf-8"
  );
}


/* =========================================================
   EXPORTAR RESPALDO JSON
========================================================= */

function exportJson() {
  if (!deliveries.length) {
    toast("No hay datos para respaldar.", true);
    return;
  }

  const backup = {
    app: "Control Entradas Rural del Prado 2026",
    exportadoEn: new Date().toISOString(),
    entregas: deliveries
  };

  downloadText(
    `respaldo-entradas-${hoyISO()}.json`,
    JSON.stringify(backup, null, 2),
    "application/json"
  );
}


/* =========================================================
   DATOS ANTERIORES
========================================================= */

function detectLegacy() {
  try {
    const legacyData = JSON.parse(
      localStorage.getItem(LEGACY_KEY) || "[]"
    );

    $("btn-migrar").hidden =
      !Array.isArray(legacyData) ||
      !legacyData.length;
  } catch {
    $("btn-migrar").hidden = true;
  }
}


async function migrate() {
  let legacyData = [];

  try {
    legacyData = JSON.parse(
      localStorage.getItem(LEGACY_KEY) || "[]"
    );
  } catch {
    legacyData = [];
  }

  if (!legacyData.length) {
    return;
  }

  const confirmed = confirm(
    `Se encontraron ${legacyData.length} registros anteriores. ` +
    `¿Subirlos a Firebase?`
  );

  if (!confirmed) {
    return;
  }

  try {
    const result = await migrateLegacy(legacyData);

    localStorage.setItem(
      `${LEGACY_KEY}_migrado`,
      JSON.stringify(legacyData)
    );

    localStorage.removeItem(LEGACY_KEY);

    detectLegacy();

    toast(
      `Migración lista: ${result.added} cargados ` +
      `y ${result.skipped} omitidos.`
    );
  } catch (error) {
    console.error(error);
    toast(errorMessage(error), true);
  }
}


/* =========================================================
   ESTADO DE CONEXIÓN
========================================================= */

function updateConnection() {
  const online = navigator.onLine;
  const connectionElement = $("estado-conexion");

  connectionElement.classList.toggle(
    "offline",
    !online
  );

  connectionElement
    .querySelector(".estado-texto")
    .textContent = online
      ? "En línea"
      : "Sin conexión";
}


/* =========================================================
   ESCÁNER
========================================================= */

async function startScanner() {
  if (!("BarcodeDetector" in window)) {
    toast(
      "Este navegador no admite escaneo automático. " +
      "Ingresá el número manualmente.",
      true
    );

    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          ideal: "environment"
        }
      },
      audio: false
    });

    $("scanner-video").srcObject = cameraStream;

    await $("scanner-video").play();

    $("modal-scanner").showModal();

    const detector = new BarcodeDetector({
      formats: [
        "qr_code",
        "code_128",
        "ean_13",
        "ean_8",
        "upc_a",
        "upc_e"
      ]
    });

    scanTimer = setInterval(async () => {
      try {
        const codes = await detector.detect(
          $("scanner-video")
        );

        if (codes[0]?.rawValue) {
          $("e-numero").value = codes[0].rawValue;

          closeScanner();

          toast("Código detectado.");
        }
      } catch {
        // Evita interrumpir el escaneo por errores temporales.
      }
    }, 450);
  } catch (error) {
    console.error(error);

    toast(
      "No se pudo acceder a la cámara.",
      true
    );
  }
}


function closeScanner() {
  clearInterval(scanTimer);

  cameraStream
    ?.getTracks()
    .forEach(track => track.stop());

  cameraStream = null;

  if ($("modal-scanner").open) {
    $("modal-scanner").close();
  }
}


/* =========================================================
   LOGIN
========================================================= */

$("form-login").onsubmit = async event => {
  event.preventDefault();

  const button = $("btn-login");

  button.disabled = true;
  button.textContent = "Ingresando…";

  try {
    await login(
      $("login-email").value.trim(),
      $("login-password").value
    );

    toast("Usuario y contraseña correctos. Ingreso realizado.");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  } catch (error) {
    console.error(error);
    toast(errorMessage(error), true);
  } finally {
    button.disabled = false;
    button.textContent = "Ingresar";
  }
};


/* =========================================================
   EVENTOS PRINCIPALES
========================================================= */

$("btn-salir").onclick = logout;

$("form-entrega").onsubmit = submitNew;

$("e-tipo").onchange = () => {
  toggleDay();
};

$("edit-tipo").onchange = () => {
  toggleDay("edit-");
};

$("form-editar").onsubmit = submitEdit;

$("cancelar-edicion").onclick = () => {
  $("modal-editar").close();
};

$("cancelar-edicion-2").onclick = () => {
  $("modal-editar").close();
};
const newDeliveryPersonSelect =
  getOptionalElement("e-vendedor");

if (newDeliveryPersonSelect) {
  newDeliveryPersonSelect.onchange = () => {
    toggleOtherDeliveryPerson("e-");
  };
}

const editDeliveryPersonSelect =
  getOptionalElement("edit-vendedor");

if (editDeliveryPersonSelect) {
  editDeliveryPersonSelect.onchange = () => {
    toggleOtherDeliveryPerson("edit-");
  };
}

/* =========================================================
   EVENTOS DE FILTROS
========================================================= */

[
  $("buscar"),
  $("filtro-tipo"),
  $("filtro-fecha")
].forEach(element => {
  element.oninput = renderTable;
});

const sellerFilter = getOptionalElement("filtro-vendedor");

if (sellerFilter) {
  sellerFilter.onchange = renderTable;
}


$("btn-limpiar-filtros").onclick = () => {
  $("buscar").value = "";
  $("filtro-tipo").value = "Todos";
  $("filtro-fecha").value = "";

  if (sellerFilter) {
    sellerFilter.value = "Todos";
  }

  renderTable();
};


/* =========================================================
   BOTONES
========================================================= */

$("btn-exportar-csv").onclick = exportCsv;
$("btn-exportar-json").onclick = exportJson;
$("btn-migrar").onclick = migrate;
$("cerrar-scanner").onclick = closeScanner;


/* =========================================================
   CONEXIÓN
========================================================= */

window.addEventListener(
  "online",
  updateConnection
);

window.addEventListener(
  "offline",
  updateConnection
);


/* =========================================================
   INSTALACIÓN DE LA PWA
========================================================= */

window.addEventListener(
  "beforeinstallprompt",
  event => {
    event.preventDefault();

    installPrompt = event;

    $("btn-instalar").hidden = false;
  }
);


$("btn-instalar").onclick = async () => {
  if (!installPrompt) {
    return;
  }

  await installPrompt.prompt();

  installPrompt = null;

  $("btn-instalar").hidden = true;
};


/* =========================================================
   ESTADO DE AUTENTICACIÓN
========================================================= */

observeAuth(user => {
  if (stopWatch) {
    stopWatch();
    stopWatch = null;
  }

  if (!user) {
    $("pantalla-login").hidden = false;
    $("pantalla-app").hidden = true;

    return;
  }

  $("pantalla-login").hidden = true;
  $("pantalla-app").hidden = false;

  $("usuario-email").textContent =
    user.email || "Usuario";

toast("Ingreso correcto. Ya podés registrar entradas.");

setTimeout(() => {
  $("registrar-entrega")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  $("e-cliente")?.focus();
}, 150);

  detectLegacy();

  stopWatch = watchDeliveries(
    (rows, metadata) => {
      deliveries = sortedRows(rows);

      renderAll();

      if (
        metadata.fromCache &&
        !navigator.onLine
      ) {
        updateConnection();
      }
    },
    error => {
      console.error(error);

      toast(
        "No se pudo leer Firestore. Revisá las reglas.",
        true
      );
    }
  );
});

/* =========================================================
   INICIO
========================================================= */

loadDeliveryPeople();
toggleOtherDeliveryPerson("e-");
$("e-dia").value = hoyISO();

toggleDay();

updateConnection();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}
