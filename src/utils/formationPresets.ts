export interface Point { x: number; y: number }

export interface FormationPreset {
  id: string;
  name: string;
  family: string;
  path: Point[];
  closed: boolean;
}

const point = (x: number, y: number): Point => ({ x, y });
const polar = (angle: number, radius: number, scaleY = 1) =>
  point(Math.cos(angle) * radius, Math.sin(angle) * radius * scaleY);
const samples = (count: number, draw: (t: number, index: number) => Point) =>
  Array.from({ length: count }, (_, index) => draw(index / count, index));
const turn = 2 * Math.PI;
const series = (family: string, id: string, names: string[], draw: (index: number) => Point[], closed = true) =>
  names.map((name, index): FormationPreset => ({ id: id + '-' + index, name, family, path: draw(index), closed }));

export const formationPresets: FormationPreset[] = [
  ...series('Polígonos', 'polygon',
    ['Triángulo', 'Cuadrado', 'Pentágono', 'Hexágono', 'Heptágono', 'Octágono', 'Eneágono', 'Decágono', 'Endecágono', 'Dodecágono'],
    (index) => samples(index + 3, (t) => polar(t * turn - Math.PI / 2, 1))),
  ...series('Estrellas', 'star',
    ['Estrella de 3 puntas', 'Estrella de 4 puntas', 'Estrella de 5 puntas', 'Estrella de 6 puntas', 'Estrella de 7 puntas', 'Estrella de 8 puntas', 'Estrella de 9 puntas', 'Estrella de 10 puntas', 'Estrella de 11 puntas', 'Estrella de 12 puntas'],
    (index) => samples((index + 3) * 2, (t, vertex) => polar(t * turn - Math.PI / 2, vertex % 2 ? 0.46 : 1))),
  ...series('Curvas cerradas', 'rounded',
    ['Círculo', 'Elipse horizontal', 'Elipse vertical', 'Superelipse', 'Óvalo de Cassini', 'Cardioide', 'Lemniscata', 'Deltoide', 'Astroide', 'Nefroide'],
    (index) => samples(192, (t) => {
      const a = t * turn;
      const x = Math.cos(a);
      const y = Math.sin(a);
      switch (index) {
        case 0: return point(x, y);
        case 1: return point(x, y * 0.55);
        case 2: return point(x * 0.55, y);
        case 3: return point(Math.sign(x) * Math.sqrt(Math.abs(x)), Math.sign(y) * Math.sqrt(Math.abs(y)));
        case 4: return polar(a, Math.sqrt(0.55 * Math.cos(a * 2) + Math.sqrt(1 - (0.55 * Math.sin(a * 2)) ** 2)));
        case 5: return polar(a, 1 - x);
        case 6: return point(x / (1 + y * y), x * y / (1 + y * y));
        case 7: return point(2 * x + Math.cos(a * 2), 2 * y - Math.sin(a * 2));
        case 8: return point(x ** 3, y ** 3);
        default: return point(3 * x - Math.cos(a * 3), 3 * y - Math.sin(a * 3));
      }
    })),
  ...series('Líneas y ángulos', 'linear',
    ['Fila horizontal', 'Columna', 'Diagonal ascendente', 'Diagonal descendente', 'U abierta', 'V frontal', 'V invertida', 'Escalera', 'Rayo', 'Zigzag'],
    (index) => [
      [point(-1, 0), point(1, 0)], [point(0, -1), point(0, 1)],
      [point(-1, 1), point(1, -1)], [point(-1, -1), point(1, 1)],
      [point(-1,-1), point(-1,1), point(1,1), point(1,-1)],
      [point(-1,-1), point(0,1), point(1,-1)], [point(-1,1), point(0,-1), point(1,1)],
      samples(10, (t, i) => point(Math.floor((i + 1) / 2) / 2, Math.floor(i / 2) / 2)),
      [point(0.2,-1), point(-0.65,0.1), point(0.4,-0.05), point(-0.15,1)],
      samples(8, (t, i) => point(t * 2 - 1, i % 2 ? 0.65 : -0.65)),
    ][index], false),
  ...series('Retículas', 'grid',
    ['Paralelas dobles', 'Paralelas triples', 'Retícula cuadrada', 'Retícula rectangular', 'Triángulo escalonado', 'Diamante escalonado', 'Tablero alternado', 'Malla hexagonal', 'Pasillo central', 'Gradas'],
    (index) => {
      const layouts = [[2,8], [3,6], [4,4], [4,7], [6,6], [7,7], [6,6], [5,6], [5,8], [5,6]];
      const [rows, columns] = layouts[index];
      return Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, step) => {
        const column = row % 2 ? columns - step - 1 : step;
        if ((index === 4 && column > row) || (index === 5 && Math.abs(column - 3) + Math.abs(row - 3) > 3) ||
            (index === 6 && (column + row) % 2) || (index === 8 && (column === 3 || column === 4))) return [];
        const x = (column / (columns - 1) - 0.5) * 2 + (index === 7 && row % 2 ? 0.14 : 0);
        return [point(x, row / (rows - 1) * 2 - 1 + (index === 9 ? x * 0.35 : 0))];
      }).flat()).flat();
    }, false),
  ...series('Espirales', 'spiral',
    ['Arquímedes simple', 'Arquímedes doble', 'Arquímedes triple', 'Espiral logarítmica', 'Logarítmica extendida', 'Espiral de Fermat', 'Fermat invertida', 'Espiral hiperbólica', 'Espiral cuadrada', 'Espiral triangular'],
    (index) => samples(181, (_, i) => {
      const t = i / 180;
      const coils = [1, 2, 3, 1.5, 2.5, 2, -2, 2.25, 2, 2][index];
      const radius = index === 3 || index === 4 ? Math.exp(3 * (t - 1))
        : index === 5 || index === 6 ? Math.sqrt(t)
        : index === 7 ? 1 / (1 + 7 * t) : t;
      const angle = coils * turn * t;
      if (index === 8) return polar(angle, radius / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle))));
      if (index === 9) return polar(angle, radius / Math.cos(((angle + Math.PI / 3) % (turn / 3)) - Math.PI / 3));
      return polar(angle, radius);
    }), false),
  ...series('Ondas', 'wave',
    ['Media onda', 'Onda simple', 'Onda doble', 'Onda triple', 'Onda cuádruple', 'Coseno', 'Onda triangular', 'Onda amortiguada', 'Onda creciente', 'Diente de sierra'],
    (index) => samples(181, (_, i) => {
      const t = i / 180;
      const phase = t * [0.5,1,2,3,4,1,2,3,3,3][index];
      let y = Math.sin(phase * turn);
      if (index === 5) y = Math.cos(phase * turn);
      if (index === 6) y = 2 * Math.asin(y) / Math.PI;
      if (index === 7) y *= 1 - t;
      if (index === 8) y *= t;
      if (index === 9) y = (phase - Math.floor(phase)) * 2 - 1;
      return point(2 * t - 1, y * 0.55);
    }), false),
  ...series('Rosetas', 'rose',
    ['Rosa de 3 pétalos', 'Rosa de 4 pétalos', 'Rosa de 5 pétalos', 'Rosa de 6 pétalos', 'Rosa de 7 pétalos', 'Rosa de 8 pétalos', 'Rosa de 9 pétalos', 'Rosa de 10 pétalos', 'Rosa de 11 pétalos', 'Rosa de 12 pétalos'],
    (index) => samples(360, (t) => {
      const a = t * turn;
      return polar(a, 0.58 + 0.42 * Math.cos((index + 3) * a));
    })),
  ...series('Arcos y parábolas', 'arc',
    ['Arco de 60°', 'Arco de 90°', 'Arco de 120°', 'Semicírculo', 'Arco de 210°', 'Arco de 270°', 'Parábola abierta', 'Parábola profunda', 'Parábola invertida', 'Catenaria'],
    (index) => samples(121, (_, i) => {
      const t = i / 120;
      const x = 2 * t - 1;
      return index < 6 ? polar(-Math.PI / 2 + x * [60,90,120,180,210,270][index] * Math.PI / 360, 1)
        : point(x, index === 9 ? Math.cosh(x * 1.5) - 1 : x * x * [0.45,1,-1][index - 6]);
    }), false),
  ...series('Figuras y proyecciones', 'projection',
    ['Rectángulo', 'Rombo', 'Trapecio', 'Paralelogramo', 'Cometa', 'Cruz latina', 'Cruz griega', 'Cubo isométrico', 'Pirámide proyectada', 'Corazón'],
    (index) => [
      [point(-1,-0.55),point(1,-0.55),point(1,0.55),point(-1,0.55)],
      [point(0,-1),point(0.65,0),point(0,1),point(-0.65,0)],
      [point(-0.55,-0.7),point(0.55,-0.7),point(1,0.7),point(-1,0.7)],
      [point(-0.5,-0.7),point(1,-0.7),point(0.5,0.7),point(-1,0.7)],
      [point(0,-1),point(0.7,-0.3),point(0,1),point(-0.7,-0.3)],
      [point(-.2,-1),point(.2,-1),point(.2,-.55),point(.8,-.55),point(.8,-.15),point(.2,-.15),point(.2,1),point(-.2,1),point(-.2,-.15),point(-.8,-.15),point(-.8,-.55),point(-.2,-.55)],
      [point(-.25,-1),point(.25,-1),point(.25,-.25),point(1,-.25),point(1,.25),point(.25,.25),point(.25,1),point(-.25,1),point(-.25,.25),point(-1,.25),point(-1,-.25),point(-.25,-.25)],
      [point(0,-1),point(.9,-.5),point(.9,.5),point(0,1),point(-.9,.5),point(-.9,-.5),point(0,0),point(.9,-.5),point(0,0),point(0,1),point(0,0),point(-.9,-.5)],
      [point(0,-1),point(.95,.55),point(0,1),point(-.95,.55),point(0,-1),point(0,1),point(0,-1),point(0,.18),point(-.95,.55),point(0,.18),point(.95,.55)],
      samples(180, (t) => {
        const a = t * turn;
        return point(16 * Math.sin(a) ** 3, -(13 * Math.cos(a) - 5 * Math.cos(2*a) - 2 * Math.cos(3*a) - Math.cos(4*a)));
      }),
    ][index]),
];

export function distributePreset(preset: FormationPreset, count: number): Point[] {
  if (count <= 1) return count === 1 ? [point(0.5, 0.5)] : [];
  const minX = Math.min(...preset.path.map((p) => p.x));
  const maxX = Math.max(...preset.path.map((p) => p.x));
  const minY = Math.min(...preset.path.map((p) => p.y));
  const maxY = Math.max(...preset.path.map((p) => p.y));
  const scale = 0.76 / Math.max(maxX - minX, maxY - minY);
  const path = preset.path.map((p) => point(0.5 + (p.x - (minX + maxX) / 2) * scale, 0.5 + (p.y - (minY + maxY) / 2) * scale));
  if (preset.closed) path.push(path[0]);
  let total = 0;
  const segments = path.slice(1).map((end, index) => {
    const start = path[index];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const segment = { start, end, length, offset: total };
    total += length;
    return segment;
  });
  return Array.from({ length: count }, (_, index) => {
    const distance = total * index / (preset.closed ? count : count - 1);
    const segment = segments.find(({ offset, length }) => length > 0 && distance <= offset + length);
    if (!segment) return path[path.length - 1];
    const ratio = (distance - segment.offset) / segment.length;
    return point(segment.start.x + (segment.end.x - segment.start.x) * ratio,
      segment.start.y + (segment.end.y - segment.start.y) * ratio);
  });
}
