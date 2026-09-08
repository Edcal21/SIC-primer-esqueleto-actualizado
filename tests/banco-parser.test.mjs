import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import { leerEstadoBancario, mismoMonto, resumenEstadoBancario, valorFecha } from '../lib/banco.ts';

test('CSV preserva ISO y aplica día/mes/año explícitamente', async () => {
  for (const fecha of ['2026-09-07', '07/09/2026']) {
    const lineas = await leerEstadoBancario(new File([`Fecha,Descripcion,Credito\n${fecha},Deposito,100.00`], 'banco.csv'));
    assert.equal(lineas[0].fecha, '2026-09-07');
    assert.equal(resumenEstadoBancario(lineas).periodoFin, '2026-09-07');
  }
});
test('rechaza fechas imposibles y formatos ambiguos no admitidos', async () => {
  for (const fecha of ['2026-02-30', '31/04/2026', '09/07/26', 'September 7 2026']) {
    assert.equal(valorFecha(fecha), null);
    await assert.rejects(leerEstadoBancario(new File([`Fecha,Descripcion,Credito\n${fecha},Deposito,100`], 'banco.csv')), /fecha inválida/);
  }
});
test('Excel mantiene fechas nativas', async () => {
  for (const bookType of ['xlsx', 'xls']) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Fecha','Descripcion','Credito'], [new Date(Date.UTC(2026,8,7)), 'Deposito',100]], {cellDates:true}), 'Banco');
    const lineas = await leerEstadoBancario(new File([XLSX.write(wb,{type:'buffer',bookType})], `banco.${bookType}`));
    assert.equal(lineas[0].fecha,'2026-09-07');
  }
});
test('emparejamiento exige moneda e históricos USD completos; conserva legado NIO', () => {
  const linea = {moneda:'USD',debito:'0.00',credito:'100.00'};
  const movimiento = {montoOriginal:100,moneda:'NIO',completo:false};
  assert.equal(mismoMonto(linea,movimiento),false);
  assert.equal(mismoMonto(linea,{...movimiento,moneda:'USD'}),false);
  assert.equal(mismoMonto(linea,{...movimiento,moneda:'USD',completo:true}),true);
  assert.equal(mismoMonto({...linea,moneda:'NIO'},movimiento),true);
});

// --- Regresión H3: el emparejamiento debe distinguir entrada de salida ---

const minuta = (extra) => ({
  id: "m", fecha: "2026-09-07", referencia: null, concepto: "Prueba",
  monto: 100, montoOriginal: 100, moneda: "USD", sentido: "entrada", completo: true, lineaId: null,
  ...extra,
});
const deposito = (importe = "100.00") => ({ moneda: "USD", credito: importe, debito: "0.00" });
const retiro = (importe = "100.00") => ({ moneda: "USD", credito: "0.00", debito: importe });

test("un retiro no empareja con una minuta de entrada del mismo importe", () => {
  assert.equal(mismoMonto(deposito(), minuta()), true, "el depósito sí debe emparejar");
  assert.equal(mismoMonto(retiro(), minuta()), false, "un retiro nunca puede enlazarse con una entrada");
});

test("un depósito no empareja con una minuta de salida del mismo importe", () => {
  const salida = minuta({ sentido: "salida" });
  assert.equal(mismoMonto(retiro(), salida), true, "el retiro sí debe emparejar");
  assert.equal(mismoMonto(deposito(), salida), false, "un depósito nunca puede enlazarse con una salida");
});

test("compara importes con aritmética decimal exacta, no con tolerancia flotante", () => {
  // 0.03 - 0.02 da 0.00999... en IEEE-754 y pasaba el umbral de 0.01.
  assert.equal(mismoMonto(deposito("0.02"), minuta({ montoOriginal: 0.03 })), false);
  assert.equal(mismoMonto(deposito("0.03"), minuta({ montoOriginal: 0.03 })), true);
});

test("no cruza monedas ni acepta históricos USD incompletos", () => {
  assert.equal(mismoMonto({ moneda: "NIO", credito: "100.00", debito: "0.00" }, minuta()), false);
  assert.equal(mismoMonto(deposito(), minuta({ completo: false })), false);
});

test("minuta histórica NIO sin dirección registrada conserva el emparejamiento por importe", () => {
  // sentido null = la dirección nunca se registró; no se le inventa una para ser más estrictos.
  const legada = minuta({ moneda: "NIO", sentido: null, completo: false });
  assert.equal(mismoMonto({ moneda: "NIO", credito: "100.00", debito: "0.00" }, legada), true);
  assert.equal(mismoMonto({ moneda: "NIO", credito: "0.00", debito: "100.00" }, legada), true);
});
