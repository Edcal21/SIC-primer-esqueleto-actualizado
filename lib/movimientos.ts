import { calcularEquivalenteNio, esMontoPositivo, montosIguales, redondearMonto, sumarMontos } from "./moneda";

export type DetalleEntrada = {
  tipo?: string;
  cuentaCodigo?: string;
  cuentaNombre?: string;
  monto?: string | number;
  afectaCuentaBancaria?: boolean;
  montoOriginal?: string | number;
};

export type DetalleParaInsertar = {
  tipo: "credito" | "debito";
  cuentaCodigo: string;
  cuentaNombre: string;
  monto: string;
  orden: number;
  afectaCuentaBancaria: boolean;
  moneda: "USD" | "NIO";
  montoOriginal: string;
  tasaCambio: string;
};

export type TasaResuelta = { tasa: string } | null;

export type ContextoMovimiento = {
  /** Moneda de la cuenta bancaria del encabezado de la minuta. */
  cuentaBancariaMoneda: "USD" | "NIO";
  /** Tasa NIO/USD vigente para la fecha de la minuta, ya normalizada, o null si no hay tasa registrada. */
  tasaUsd: TasaResuelta;
};

export type ResultadoDetalles = { ok: true; detalles: DetalleParaInsertar[] } | { ok: false; error: string };

/**
 * Valida y construye las líneas contables de una minuta, calculando el importe en NIO de la
 * línea (o líneas) que afecta la cuenta bancaria con aritmética decimal exacta. Nunca asume que
 * el importe bancario es la suma de todos los débitos: exige que el cliente marque explícitamente
 * cuál línea afecta el banco.
 */
export function construirDetallesMovimiento(detalles: DetalleEntrada[], contexto: ContextoMovimiento): ResultadoDetalles {
  if (detalles.length < 2) return { ok: false, error: "Debe agregar al menos dos detalles para cumplir partida doble" };

  const normalizados = detalles.map(detalle => ({
    tipo: detalle.tipo?.trim().toLowerCase(),
    cuentaCodigo: detalle.cuentaCodigo?.trim(),
    cuentaNombre: detalle.cuentaNombre?.trim(),
    monto: detalle.monto,
    montoOriginal: detalle.montoOriginal,
    afectaCuentaBancaria: Boolean(detalle.afectaCuentaBancaria),
  }));

  for (const detalle of normalizados) {
    if (detalle.tipo !== "credito" && detalle.tipo !== "debito") return { ok: false, error: "Tipo inválido; utilice crédito o débito" };
    if (!detalle.cuentaCodigo || !detalle.cuentaNombre) return { ok: false, error: "La cuenta del detalle es obligatoria" };
  }

  const marcadas = normalizados.filter(detalle => detalle.afectaCuentaBancaria);
  if (!marcadas.length) {
    return { ok: false, error: "Marque al menos una línea como la que afecta la cuenta bancaria de la minuta" };
  }

  // Una minuta afecta la cuenta bancaria en una sola dirección: o entra dinero (débito a la cuenta
  // de banco) o sale (crédito). Admitir ambas a la vez produciría un importe bancario sin sentido
  // (la suma de las marcadas dejaría de representar el efecto neto sobre el banco) y además sería
  // inconciliable: una minuta solo puede enlazarse con una línea del estado de cuenta.
  if (marcadas.some(detalle => detalle.tipo !== marcadas[0].tipo)) {
    return {
      ok: false,
      error: "Las líneas que afectan la cuenta bancaria deben ir todas en la misma dirección (todas débito o todas crédito). Si la minuta representa una entrada y una salida, regístrelas por separado.",
    };
  }

  if (contexto.cuentaBancariaMoneda === "USD" && !contexto.tasaUsd) {
    return {
      ok: false,
      error: "Falta registrar la tasa de cambio USD → NIO para la fecha de la minuta. Un administrador debe registrarla en Configuración → Tasas de cambio antes de continuar.",
    };
  }

  const detallesFinales: DetalleParaInsertar[] = [];
  for (const [index, detalle] of normalizados.entries()) {
    const esBanco = detalle.afectaCuentaBancaria;
    const esUsd = esBanco && contexto.cuentaBancariaMoneda === "USD";

    const montoOriginalCrudo = esUsd ? (detalle.montoOriginal ?? detalle.monto) : detalle.monto;
    if (!esMontoPositivo(montoOriginalCrudo)) {
      return {
        ok: false,
        error: esUsd
          ? `La línea ${index + 1} afecta una cuenta bancaria en USD: indique un importe original en USD mayor que cero`
          : `El monto debe ser mayor que cero en la línea ${index + 1}`,
      };
    }

    const montoOriginal = redondearMonto(montoOriginalCrudo);
    const moneda: "USD" | "NIO" = esUsd ? "USD" : "NIO";
    const tasaCambio = esUsd ? contexto.tasaUsd!.tasa : "1.000000";
    const monto = esUsd ? calcularEquivalenteNio(montoOriginal, tasaCambio) : montoOriginal;

    detallesFinales.push({
      tipo: detalle.tipo as "credito" | "debito",
      cuentaCodigo: detalle.cuentaCodigo!,
      cuentaNombre: detalle.cuentaNombre!,
      monto,
      orden: index + 1,
      afectaCuentaBancaria: esBanco,
      moneda,
      montoOriginal,
      tasaCambio,
    });
  }

  const totalDebitos = sumarMontos(detallesFinales.filter(detalle => detalle.tipo === "debito").map(detalle => detalle.monto));
  const totalCreditos = sumarMontos(detallesFinales.filter(detalle => detalle.tipo === "credito").map(detalle => detalle.monto));
  if (!montosIguales(totalDebitos, totalCreditos)) {
    return { ok: false, error: "La minuta no está cuadrada: el total de débitos debe ser igual al total de créditos" };
  }

  return { ok: true, detalles: detallesFinales };
}
