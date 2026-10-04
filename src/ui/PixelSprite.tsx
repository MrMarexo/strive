interface PixelSpriteProps {
  map: string[];
  title: string;
  size?: number;
}

export function PixelSprite({ map, title, size = 80 }: PixelSpriteProps) {
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  return (
    <svg
      className="sprite"
      width={size}
      height={(size * rows) / cols}
      viewBox={`0 0 ${cols} ${rows}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={title}
    >
      {map.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} /> : null,
        ),
      )}
    </svg>
  );
}
