import fs from 'fs';
import path from 'path';
import {
  categorizar,
  enmascararDatosBancarios,
  huellaExtracto,
  leerExtractoCsv,
  leerFecha,
  leerImporteExtracto,
  leerLineasIa,
  parseCsv,
  proponerImportacion,
  separadorDe,
} from '../moneyextracto';

describe('lectura de campos', () => {
  it('fechas en los formatos de los bancos', () => {
    expect(leerFecha('2026-10-21')).toBe('2026-10-21');
    expect(leerFecha('2026-10-21 09:14:33')).toBe('2026-10-21');
    expect(leerFecha('21/10/2026')).toBe('2026-10-21');
    expect(leerFecha('1-2-2026')).toBe('2026-02-01');
    expect(leerFecha('21.10.26')).toBe('2026-10-21');
    expect(leerFecha('31/02/2026')).toBeNull();
    expect(leerFecha('ayer')).toBeNull();
  });
  it('importes con miles, decimales y signo de mil maneras', () => {
    expect(leerImporteExtracto('-1.234,56')).toBe(-1234.56);
    expect(leerImporteExtracto('1,234.56')).toBe(1234.56);
    expect(leerImporteExtracto('−12,50 €')).toBe(-12.5);
    expect(leerImporteExtracto('(12,50)')).toBe(-12.5);
    expect(leerImporteExtracto('12,50-')).toBe(-12.5);
    expect(leerImporteExtracto('+2.150,00')).toBe(2150);
    expect(leerImporteExtracto('-9.99')).toBe(-9.99);
    expect(leerImporteExtracto('12,50 EUR')).toBe(12.5);
    expect(leerImporteExtracto('')).toBeNull();
    expect(leerImporteExtracto('n/a')).toBeNull();
  });
  it('separador y comillas', () => {
    expect(separadorDe('Fecha;Concepto;Importe\n')).toBe(';');
    expect(separadorDe('Type,Product,Started Date\n')).toBe(',');
    expect(parseCsv('a,"b, con coma","c ""cita"""\n1,2,3\n')).toEqual([
      ['a', 'b, con coma', 'c "cita"'],
      ['1', '2', '3'],
    ]);
  });
});

describe('CSV de bancos reales (formato)', () => {
  it('Revolut: completados, comisiones aparte y traspasos internos', () => {
    const csv = [
      'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance',
      'CARD_PAYMENT,Current,2026-10-01 10:00:00,2026-10-02 09:00:00,Mercadona,-45.20,0.00,EUR,COMPLETED,100',
      'CARD_PAYMENT,Current,2026-10-03 10:00:00,,Pendiente,-9.00,0.00,EUR,PENDING,91',
      'TOPUP,Current,2026-10-04 10:00:00,2026-10-04 10:00:00,Top-up by *1234,200.00,0.00,EUR,COMPLETED,291',
      'EXCHANGE,Current,2026-10-05 10:00:00,2026-10-05 10:00:00,To USD,-50.00,0.25,EUR,COMPLETED,240.75',
    ].join('\n');
    const r = leerExtractoCsv(csv);
    expect(r.error).toBeNull();
    expect(r.descartadas).toBe(1);
    expect(r.filas.map((f) => [f.fecha, f.importe, f.concepto, f.interno])).toEqual([
      ['2026-10-02', -45.2, 'Mercadona', false],
      ['2026-10-04', 200, 'Top-up by *1234', true],
      ['2026-10-05', -50.25, 'To USD', true],
    ]);
  });
  it('banco español: punto y coma, títulos antes de la cabecera, coma decimal', () => {
    const csv = [
      'Movimientos de la cuenta ES00 **** 1234',
      '',
      'Fecha operación;Fecha valor;Concepto;Importe;Saldo',
      '21/10/2026;21/10/2026;COMPRA TARJ. LIDL 0042;-23,45;1.976,55',
      '20/10/2026;20/10/2026;NOMINA OCTUBRE EMPRESA SL;2.000,00;2.000,00',
    ].join('\r\n');
    const r = leerExtractoCsv(csv);
    expect(r.filas.map((f) => [f.fecha, f.importe])).toEqual([
      ['2026-10-21', -23.45],
      ['2026-10-20', 2000],
    ]);
  });
  it('cargo y abono en columnas separadas', () => {
    const csv = 'Fecha;Descripción;Cargo;Abono\n02/10/2026;Recibo luz;62,30;\n03/10/2026;Transferencia recibida;;150,00\n';
    expect(leerExtractoCsv(csv).filas.map((f) => f.importe)).toEqual([-62.3, 150]);
  });
  it('sin columnas reconocibles o vacío', () => {
    expect(leerExtractoCsv('a;b;c\n1;2;3\n').error).toBe('sin_columnas');
    expect(leerExtractoCsv('').error).toBe('vacio');
  });
});

describe('lo que devuelve la IA al leer un PDF', () => {
  it('líneas fecha|importe|concepto, tolerante con la basura', () => {
    const r = leerLineasIa('Aquí tienes:\n2026-10-02|-45,20|MERCADONA 4471\n2026-10-03|xx|mal\n2026-10-04|2150|NOMINA | OCTUBRE\n');
    expect(r.filas.map((f) => [f.fecha, f.importe, f.concepto])).toEqual([
      ['2026-10-02', -45.2, 'MERCADONA 4471'],
      ['2026-10-04', 2150, 'NOMINA OCTUBRE'],
    ]);
    expect(r.descartadas).toBe(1);
  });
});

describe('categorías y propuesta', () => {
  it('reglas de serie, reglas propias primero y el signo manda', () => {
    expect(categorizar('COMPRA MERCADONA 4471', -30)).toBe('super');
    expect(categorizar('NETFLIX.COM', -12.99)).toBe('suscripciones');
    expect(categorizar('NOMINA OCTUBRE', 2000)).toBe('ingreso_nomina');
    expect(categorizar('Algo raro', -5)).toBe('sin_clasificar');
    expect(categorizar('Algo raro', 5)).toBe('ingreso_otro');
    // Una devolución de Mercadona entra en positivo: no puede ser «super».
    expect(categorizar('Devolución MERCADONA', 12)).toBe('ingreso_otro');
    expect(categorizar('MERCADONA', -3, [{ pattern: 'mercadona', category: 'restaurante', priority: 70 }])).toBe('restaurante');
  });
  it('huella igual que el importador de scripts y estados de la revisión', () => {
    expect(huellaExtracto('Revolut', '2026-10-02', -45.2, 'Mercadona')).toBe('Revolut|2026-10-02|-45.20|mercadona');
    const filas = [
      { fecha: '2026-10-02', importe: -45.2, concepto: 'Mercadona', divisa: 'EUR', interno: false },
      { fecha: '2026-10-02', importe: -45.2, concepto: 'Mercadona', divisa: 'EUR', interno: false },
      { fecha: '2026-10-05', importe: -3.5, concepto: 'Café bar', divisa: 'EUR', interno: false },
      { fecha: '2026-10-06', importe: -9, concepto: 'Nuevo', divisa: 'EUR', interno: false },
      { fecha: '2026-10-07', importe: -50, concepto: 'To EUR vault', divisa: 'EUR', interno: true },
    ];
    const p = proponerImportacion(filas, 'Revolut', [], [
      { date: '2026-10-04', amount: -3.5, dedup_hash: 'app|x', source: 'manual' },
      { date: '2026-09-01', amount: -1, dedup_hash: 'Revolut|2026-10-05|-3.50|café bar' },
    ]);
    expect(p.map((f) => f.estado)).toEqual(['nuevo', 'repetido', 'repetido', 'nuevo', 'nuevo']);
    expect(p[4]!.categoria).toBe('transferencia');
    const p2 = proponerImportacion([filas[2]!], 'BBVA', [], [{ date: '2026-10-04', amount: -3.5, dedup_hash: 'app|x', source: 'manual' }]);
    expect(p2[0]!.estado).toBe('parecido');
  });
});

describe('enmascarar antes de la IA', () => {
  it('IBAN, tarjetas, CCC y tiras largas; fechas e importes intactos', () => {
    const t = enmascararDatosBancarios(
      'Titular cuenta ES91 2100 0418 4502 0005 1332 · IBAN ES9121000418450200051332\n' +
        'Tarjeta 4111 1111 1111 1234 · 4111-1111-1111-5678 · Ref 00490001512000123456\n' +
        '21/10/2026 2026-10-21 -1.234,56 2.150,00 BIZUM 612345678',
    );
    expect(t).not.toMatch(/2100 0418 4502|21000418450200051332|4111 1111 1111|4111-1111|00490001512/);
    expect(t).toContain('ES** **** 1332');
    expect(t).toContain('**** 1234');
    expect(t).toContain('**** 5678');
    expect(t).toContain('****3456');
    expect(t).toContain('21/10/2026 2026-10-21 -1.234,56 2.150,00');
    expect(t).toContain('612345678');
  });
});

describe('paridad con la Edge Function', () => {
  it('_shared/extracto.ts es una copia exacta del bloque INICIO..FIN', () => {
    const bloque = (p: string) => {
      const s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
      return s.slice(s.indexOf('// ── INICIO'), s.indexOf('// ── FIN'));
    };
    const raiz = path.resolve(__dirname, '..', '..', '..');
    const app = bloque(path.join(raiz, 'src', 'lib', 'moneyextracto.ts'));
    const deno = bloque(path.join(raiz, 'supabase', 'functions', '_shared', 'extracto.ts'));
    expect(app.length).toBeGreaterThan(1000);
    expect(deno).toBe(app);
  });
});
