import { element } from './widgets.js';

const SECTIONS = [
  {
    heading: 'The blur model',
    body: [
      'Every setting is judged by one number: the diameter of the blur disc it puts on the sensor, in microns. Defocus, diffraction and lens aberration are added in quadrature, which is exact for Gaussian blurs and close enough for these. If the total at the worst edge of your subject is inside the blur limit, the subject is tack sharp.',
      'Defocus comes from the thin-lens model. Diffraction is the Airy pattern at 550 nm matched to a disc of equal variance, so it grows in proportion to the aperture number. Stopping down trades one against the other, which is why there is a sharpest aperture rather than a smallest one.',
    ],
  },
  {
    heading: 'The standards',
    body: [
      'Pixel-level is two pixels, the point where a file still looks crisp at 100 percent. Critical is half of Standard, sized for large prints and heavy crops. Standard is the classic 0.030 mm circle of confusion scaled to your sensor diagonal, which assumes the whole image viewed at normal size.',
      'A verdict within ten percent of the limit is reported as borderline rather than pass or fail, because the model is not more precise than that.',
    ],
  },
  {
    heading: 'Best-point focus',
    body: [
      'Blur grows with the difference in reciprocal distance, so the focus point that splits it evenly between the near and far targets is their harmonic mean, not their midpoint. That is the exact minimax: any other focus makes one edge worse than this one makes both.',
    ],
  },
  {
    heading: 'Distances are from the sensor plane',
    body: [
      'Every distance you type or read is measured from the ⦵ mark on the camera, the same reference the lens distance scale uses. The thin-lens formulas need distance from the lens, so the app converts on the way in and back on the way out.',
      'The conversion assumes a symmetric lens that extends to focus. Real internally-focusing lenses extend less than that, so the truth sits between this and no correction at all. The difference is about four percent of distance at portrait range with an 85 mm and vanishes past roughly thirty times the focal length.',
    ],
  },
  {
    heading: 'What is not modelled',
    body: [
      'Motion blur, from the subject or the camera. Missed focus, including autofocus error and focus shift on stopping down. Heat shimmer and atmospheric haze. Field curvature, so a flat wall may not match a rounded one. Lens aberration is zero until you calibrate a lens.',
      'The app also assumes the sensor is square to the subject. Tilt the camera and the plane of focus tilts with it.',
    ],
  },
];

export function mountHowItWorks({ host }) {
  for (const section of SECTIONS) {
    host.append(element('h3', { text: section.heading }));
    for (const paragraph of section.body) host.append(element('p', { text: paragraph }));
  }
}
