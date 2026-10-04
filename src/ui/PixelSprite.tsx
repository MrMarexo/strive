interface PixelSpriteProps {
  map: string[];
  title?: string; // omit for decorative sprites
  size?: number;
  className?: string;
}

export function PixelSprite({ map, title, size = 80, className = 'sprite' }: PixelSpriteProps) {
  const rows = map.length;
  const cols = map[0].length;
  return (
    <svg
      className={className}
      width={size}
      height={(size * rows) / cols}
      viewBox={`0 0 ${cols} ${rows}`}
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {map.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} /> : null,
        ),
      )}
    </svg>
  );
}
