import { diffractionBlur, totalBlur } from '../core/optics.js';
import { formatStop } from '../core/stops.js';
import { formatDistance, formatMicrons, formatPercent, formatPixels } from '../core/units.js';
import { clear, readout } from './widgets.js';

function apertureListText(stops) {
  if (!stops.length) return 'None at this standard';
  if (stops.length === 1) return `f/${stops[0].label}`;
  return `f/${stops[0].label} to f/${stops[stops.length - 1].label}`;
}

export function mountDetails({ host }) {
  return {
    update(view, state) {
      clear(host);
      if (!view.result.ok) return;
      const result = view.result;
      const units = state.units;

      host.append(readout('Where to focus', view.focusText || formatDistance(result.focusSensor, units)));

      if (result.noSharpZone) {
        host.append(readout('Sharp zone', 'None, diffraction alone is over the limit.'));
      } else {
        const near = result.depthNear;
        const far = result.depthFar;
        host.append(
          readout('Sharp zone', `${formatDistance(near, units)} to ${formatDistance(far, units)}`),
        );
        const depth = far - near;
        host.append(readout('Depth of field', Number.isFinite(depth) ? formatDistance(depth, units) : '∞'));

        const inFront = result.focusSensor - near;
        const behind = far - result.focusSensor;
        const split = Number.isFinite(behind) ? inFront / (inFront + behind) : 0;
        host.append(
          readout(
            'In front and behind',
            Number.isFinite(behind)
              ? `${formatDistance(inFront, units)} and ${formatDistance(behind, units)} (${formatPercent(
                  split,
                )} / ${formatPercent(1 - split)})`
              : `${formatDistance(inFront, units)} and ∞`,
          ),
        );
      }

      const edgeBlurAt = (objectDistance) =>
        totalBlur({
          objectDistance,
          focus: result.focusObject,
          focalLength: result.focalLength,
          aperture: result.aperture,
          k: result.k,
          aberration: result.aberration,
        });
      host.append(
        readout(
          'Blur at the near and far edges',
          `${formatMicrons(edgeBlurAt(result.nearObject))} and ${formatMicrons(edgeBlurAt(result.farObject))}`,
        ),
      );

      const diffraction = diffractionBlur(result.k, result.aperture, result.magnification);
      host.append(
        readout(
          'Diffraction blur',
          `${formatMicrons(diffraction)} (${formatPixels(diffraction, view.pitch)})`,
        ),
      );

      host.append(readout('Apertures that work', apertureListText(result.workingStops)));
      host.append(
        readout(
          'Sharpest aperture',
          `${formatStop(result.sharpest.aperture)} at ${formatMicrons(result.sharpest.blur)}`,
        ),
      );
      host.append(
        readout('Hyperfocal at this aperture', formatDistance(result.hyperfocalSensor, units)),
      );
      host.append(
        readout('Blur limit', `${formatMicrons(view.limit)} (${formatPixels(view.limit, view.pitch)})`),
      );
    },
  };
}
