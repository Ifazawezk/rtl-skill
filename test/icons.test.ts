import { describe, expect, it } from 'vitest';
import {
  classifyIconName,
  classifyLabel,
  expectedPointing,
  opposite,
  rotatePropertyX,
  scalePropertyX,
  transformScaleX,
} from '../src/shared/icons.ts';

const right = { kind: 'directional', pointing: 'right', meaning: 'forward' };
const left = { kind: 'directional', pointing: 'left', meaning: 'backward' };

describe('classifyIconName', () => {
  it.each([
    ['icon icon-chevron-right'],
    ['lucide lucide-chevron-right'],
    ['lucide-chevrons-right'],
    ['fa-solid fa-arrow-right'],
    ['fa-solid fa-angle-right'],
    ['bi bi-arrow-right-short'],
    ['ph ph-caret-right'],
    ['material-icons arrow_forward'],
    ['material-symbols-outlined arrow_forward_ios'],
    ['material-icons keyboard_arrow_right'],
    ['material-icons navigate_next'],
    ['heroicon-arrow-narrow-right'],
    ['icon-next'],
    ['send'],
    ['logout'],
  ])('%s points right and means forward', (name) => {
    expect(classifyIconName(name)).toEqual(right);
  });

  it.each([
    ['icon-chevron-left'],
    ['fa-solid fa-arrow-left'],
    ['material-icons arrow_back'],
    ['material-icons arrow_back_ios'],
    ['material-icons navigate_before'],
    ['icon-prev'],
    ['icon-back'],
    ['reply'],
    ['undo'],
  ])('%s points left and means backward', (name) => {
    expect(classifyIconName(name)).toEqual(left);
  });

  it.each([
    ['icon-play'],
    ['material-icons play_arrow'],
    ['material-icons skip_next'],
    ['fa-solid fa-forward-fast fa-play'],
    ['icon-check'],
    ['lucide-check-circle'],
    ['icon-clock'],
    ['fa-brands fa-whatsapp'],
    ['site-logo'],
  ])('%s must not mirror', (name) => {
    expect(classifyIconName(name)?.kind).toBe('fixed');
  });

  it.each([
    ['icon'],
    ['icon-cart'],
    ['float-right'],
    ['text-left'],
    ['ms-auto rtl:-scale-x-100'],
    ['background'],
    ['checkout-step'],
    ['fa-solid fa-arrow-up-right'],
    ['arrow-down'],
    ['caret-up'],
  ])('%s is not directional', (name) => {
    expect(classifyIconName(name)).toBeNull();
  });
});

describe('classifyLabel', () => {
  it.each([
    ['التالي', 'forward'],
    ['التالى', 'forward'],
    ['الصفحة التالية', 'forward'],
    ['اقرأ المزيد', 'forward'],
    ['إرسال', 'forward'],
    ['ارسال', 'forward'],
    ['Next page', 'forward'],
    ['بعدی', 'forward'],
    ['הבא', 'forward'],
    ['السابق', 'backward'],
    ['الصفحة السابقة', 'backward'],
    ['رجوع', 'backward'],
    ['العودة إلى المتجر', 'backward'],
    ['Go back', 'backward'],
    ['قبلی', 'backward'],
    ['הקודם', 'backward'],
  ])('%s -> %s', (text, meaning) => {
    expect(classifyLabel(text)).toBe(meaning);
  });

  it('returns null for unrelated text or both meanings', () => {
    expect(classifyLabel('إضافة إلى السلة')).toBeNull();
    expect(classifyLabel('السابق التالي')).toBeNull();
    expect(classifyLabel('')).toBeNull();
  });
});

describe('direction helpers', () => {
  it('forward points left and back points right in RTL', () => {
    expect(expectedPointing('forward')).toBe('left');
    expect(expectedPointing('backward')).toBe('right');
    expect(opposite('left')).toBe('right');
  });

  it('reads the horizontal factor of computed transforms', () => {
    expect(transformScaleX('none')).toBe(1);
    expect(transformScaleX('matrix(-1, 0, 0, 1, 0, 0)')).toBe(-1);
    expect(transformScaleX('matrix3d(-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)')).toBe(-1);
    expect(scalePropertyX('-1 1')).toBe(-1);
    expect(scalePropertyX('-100%')).toBe(-1);
    expect(scalePropertyX('none')).toBe(1);
    expect(rotatePropertyX('180deg')).toBeCloseTo(-1);
    expect(rotatePropertyX('z 180deg')).toBeCloseTo(-1);
    expect(rotatePropertyX('90deg')).toBeCloseTo(0);
  });
});
