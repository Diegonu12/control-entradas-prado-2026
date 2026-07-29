import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { db } from "./firebase.js";
import { currentUser } from "./auth.js";

const COLLECTION_NAME = "entregas";

/**
 * Normaliza el número para poder comparar:
 * "a-12", " A-12 " y "A-12" como el mismo número.
 */
function normalizarNumero(numero) {
  return String(numero ?? "")
    .trim()
    .toUpperCase();
}

/**
 * Convierte el número normalizado en un ID seguro para Firestore.
 *
 * Ejemplo:
 * A-12 → QS0xMg
 *
 * Usar el número como base del ID ayuda a impedir duplicados.
 */
function crearIdDesdeNumero(numero) {
  const numeroNormalizado = normalizarNumero(numero);

  const bytes = new TextEncoder().encode(numeroNormalizado);

  let textoBinario = "";

  bytes.forEach(byte => {
    textoBinario += String.fromCharCode(byte);
  });

  return btoa(textoBinario)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

/**
 * Devuelve la fecha local en formato YYYY-MM-DD.
 */
function hoyISO() {
  const fecha = new Date();

  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");

  return `${año}-${mes}-${dia}`;
}

/**
 * Devuelve la hora local en formato HH:mm.
 */
function horaActual() {
  return new Date().toLocaleTimeString("es-UY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

/**
 * Genera un error que app.js reconoce como número duplicado.
 */
function crearErrorDuplicado(entregaExistente = null) {
  const error = new Error("Ese número de entrada ya está registrado.");

  error.code = "duplicate";
  error.existing = entregaExistente;

  return error;
}

/**
 * Prepara los datos con la estructura esperada por app.js.
 */
function prepararEntrega(data, datosAdicionales = {}) {
  const usuario = currentUser();

  return {
    cliente: String(data.cliente ?? "").trim(),

    numero: String(data.numero ?? "").trim(),

    numeroNormalizado: normalizarNumero(data.numero),

    tipoAcceso: data.tipo,

    diaAcceso:
      data.tipo === "Dia"
        ? data.dia
        : "",

    usuarioUid: usuario?.uid ?? null,

    usuarioEmail: usuario?.email ?? null,

    ...datosAdicionales
  };
}

/**
 * Crea una entrega.
 *
 * La transacción comprueba que el documento no exista antes de guardarlo.
 */
export async function createDelivery(data) {
  const numeroNormalizado = normalizarNumero(data.numero);

  if (!numeroNormalizado) {
    throw new Error("El número de entrada es obligatorio.");
  }

  const id = crearIdDesdeNumero(numeroNormalizado);
  const referencia = doc(db, COLLECTION_NAME, id);

  await runTransaction(db, async transaction => {
    const documentoExistente = await transaction.get(referencia);

    if (documentoExistente.exists()) {
      throw crearErrorDuplicado({
        id: documentoExistente.id,
        ...documentoExistente.data()
      });
    }

    const entrega = prepararEntrega(data, {
      fechaEntrega: hoyISO(),
      horaEntrega: horaActual(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    transaction.set(referencia, entrega);
  });

  return id;
}

/**
 * Escucha todas las entregas en tiempo real.
 *
 * Devuelve la función unsubscribe para detener la escucha.
 */
export function watchDeliveries(onData, onError) {
  const referencia = collection(db, COLLECTION_NAME);

  return onSnapshot(
    referencia,
    {
      includeMetadataChanges: true
    },
    snapshot => {
      const entregas = snapshot.docs.map(documento => ({
        id: documento.id,
        ...documento.data()
      }));

      const metadata = {
        fromCache: snapshot.metadata.fromCache,
        hasPendingWrites: snapshot.metadata.hasPendingWrites
      };

      onData(entregas, metadata);
    },
    error => {
      console.error("Error escuchando entregas:", error);

      if (typeof onError === "function") {
        onError(error);
      }
    }
  );
}

/**
 * Actualiza una entrega.
 *
 * Si cambia el número, mueve la entrega a un documento nuevo y verifica
 * que ese nuevo número no esté utilizado.
 */
export async function updateDelivery(idActual, data, entregaAnterior = null) {
  if (!idActual) {
    throw new Error("No se encontró la entrega que querés editar.");
  }

  const nuevoNumeroNormalizado = normalizarNumero(data.numero);

  if (!nuevoNumeroNormalizado) {
    throw new Error("El número de entrada es obligatorio.");
  }

  const nuevoId = crearIdDesdeNumero(nuevoNumeroNormalizado);

  const referenciaActual = doc(
    db,
    COLLECTION_NAME,
    idActual
  );

  const referenciaNueva = doc(
    db,
    COLLECTION_NAME,
    nuevoId
  );

  await runTransaction(db, async transaction => {
    const documentoActual = await transaction.get(referenciaActual);

    if (!documentoActual.exists()) {
      throw new Error("La entrega ya no existe o fue eliminada.");
    }

    const datosActuales = documentoActual.data();

    const entregaActualizada = prepararEntrega(data, {
      fechaEntrega:
        datosActuales.fechaEntrega ||
        entregaAnterior?.fechaEntrega ||
        hoyISO(),

      horaEntrega:
        datosActuales.horaEntrega ||
        entregaAnterior?.horaEntrega ||
        horaActual(),

      createdAt:
        datosActuales.createdAt ||
        serverTimestamp(),

      updatedAt: serverTimestamp()
    });

    /*
     * El número no cambió: actualiza el mismo documento.
     */
    if (nuevoId === idActual) {
      transaction.update(
        referenciaActual,
        entregaActualizada
      );

      return;
    }

    /*
     * El número cambió: comprueba que el nuevo no exista.
     */
    const documentoNuevo = await transaction.get(referenciaNueva);

    if (documentoNuevo.exists()) {
      throw crearErrorDuplicado({
        id: documentoNuevo.id,
        ...documentoNuevo.data()
      });
    }

    /*
     * Crea el nuevo documento y elimina el anterior.
     */
    transaction.set(
      referenciaNueva,
      entregaActualizada
    );

    transaction.delete(referenciaActual);
  });

  return nuevoId;
}

/**
 * Elimina una entrega.
 */
export async function removeDelivery(id) {
  if (!id) {
    throw new Error("No se encontró la entrega que querés eliminar.");
  }

  const referencia = doc(
    db,
    COLLECTION_NAME,
    id
  );

  await deleteDoc(referencia);
}

/**
 * Migra los registros guardados anteriormente en localStorage.
 */
export async function migrateLegacy(registros = []) {
  if (!Array.isArray(registros)) {
    throw new Error("Los registros anteriores no tienen un formato válido.");
  }

  let added = 0;
  let skipped = 0;

  for (const registro of registros) {
    const data = {
      cliente: registro.cliente,
      numero: registro.numero,

      tipo:
        registro.tipoAcceso ||
        registro.tipo ||
        "Dia",

      dia:
        registro.diaAcceso ||
        registro.dia ||
        hoyISO()
    };

    try {
      await createDelivery(data);
      added += 1;
    } catch (error) {
      if (error.code === "duplicate") {
        skipped += 1;
        continue;
      }

      console.error(
        "Error migrando registro:",
        registro,
        error
      );

      throw error;
    }
  }

  return {
    added,
    skipped
  };
}