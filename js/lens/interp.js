export function interpolateBreakpoints(points, at) {
  if (!points || !points.length) return undefined;
  const sorted = [...points].sort((a, b) => a.focal - b.focal);
  if (at <= sorted[0].focal) return sorted[0].value;
  const last = sorted[sorted.length - 1];
  if (at >= last.focal) return last.value;
  for (let i = 1; i < sorted.length; i += 1) {
    const low = sorted[i - 1];
    const high = sorted[i];
    if (at <= high.focal) {
      const span = high.focal - low.focal;
      const t = span === 0 ? 0 : (at - low.focal) / span;
      return low.value + (high.value - low.value) * t;
    }
  }
  return last.value;
}

export function interpolateInLogAperture(curve, aperture) {
  if (!curve || !curve.length) return 0;
  const sorted = [...curve].sort((a, b) => a.aperture - b.aperture);
  if (aperture <= sorted[0].aperture) return sorted[0].aberration;
  const last = sorted[sorted.length - 1];
  if (aperture >= last.aperture) return last.aberration;
  for (let i = 1; i < sorted.length; i += 1) {
    const low = sorted[i - 1];
    const high = sorted[i];
    if (aperture <= high.aperture) {
      const span = Math.log(high.aperture) - Math.log(low.aperture);
      const t = span === 0 ? 0 : (Math.log(aperture) - Math.log(low.aperture)) / span;
      return low.aberration + (high.aberration - low.aberration) * t;
    }
  }
  return last.aberration;
}

export function bracketing(values, at) {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  if (at <= sorted[0]) return [sorted[0]];
  if (at >= sorted[sorted.length - 1]) return [sorted[sorted.length - 1]];
  for (let i = 1; i < sorted.length; i += 1) {
    if (at <= sorted[i]) return [sorted[i - 1], sorted[i]];
  }
  return [sorted[sorted.length - 1]];
}

export function constantAberration(value = 0) {
  const fn = () => value;
  fn.constantValue = value;
  return fn;
}
