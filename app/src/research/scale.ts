/**
 * Plan V20 E09: the scale calibration and measured distances on the video.
 * Every point is a fraction of the displayed video; a vertical fraction is
 * converted to width units by the aspect ratio (displayed height over width),
 * so a result does not depend on the displayed size.
 */

/** A point on the video as fractions of its displayed width and height. */
export type VideoPoint = Readonly<{ xFraction: number; yFraction: number }>;

/** The distance between two points in fractions of the displayed width. */
function widthFractionBetween(from: VideoPoint, to: VideoPoint, aspectRatio: number): number {
  if (!(Number.isFinite(aspectRatio) && aspectRatio > 0))
    throw new RangeError("The video's aspect ratio must be a positive number.");
  return Math.hypot(to.xFraction - from.xFraction, (to.yFraction - from.yFraction) * aspectRatio);
}

/** E09: the drag length over the monster's body, as a fraction of the displayed width, divided by the body's width in tiles. */
export function tileWidthFractionOf(
  dragFrom: VideoPoint,
  dragTo: VideoPoint,
  bodyWidthTiles: number,
  aspectRatio: number,
): number {
  if (!(Number.isFinite(bodyWidthTiles) && bodyWidthTiles > 0))
    throw new RangeError("The monster's body width must be a positive number of tiles.");
  const length = widthFractionBetween(dragFrom, dragTo, aspectRatio);
  if (!(length > 0)) throw new RangeError("Drag across the monster's body; the drag had no length.");
  return length / bodyWidthTiles;
}

/** E09: the distance between two points in tiles; `aspectRatio` is displayed height over width, so vertical fractions scale correctly. */
export function distanceTiles(
  from: VideoPoint,
  to: VideoPoint,
  tileWidthFraction: number,
  aspectRatio: number,
): number {
  if (!(Number.isFinite(tileWidthFraction) && tileWidthFraction > 0))
    throw new RangeError("The scale must be a positive fraction of the video's width.");
  return widthFractionBetween(from, to, aspectRatio) / tileWidthFraction;
}
