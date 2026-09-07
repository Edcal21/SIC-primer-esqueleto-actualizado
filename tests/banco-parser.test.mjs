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
