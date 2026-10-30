// Solid silhouettes used for the soft cast shadows.
const sil = new WeakMap();
export function silhouette(cv) {
  let s = sil.get(cv);
  if (!s) {
    s = document.createElement('canvas');
    s.width = cv.width; s.height = cv.height;
    const c = s.getContext('2d');
    c.drawImage(cv, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = '#1a1026';
    c.fillRect(0, 0, s.width, s.height);
    s.pad = cv.pad;
    sil.set(cv, s);
  }
  return s;
}
