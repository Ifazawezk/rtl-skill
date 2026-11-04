import { describe, expect, it } from 'vitest';
import { findLtrIslands, isPhoneLike, latinDigits } from '../src/shared/islands.ts';
import { isOutOfOrder, visualText } from '../src/page/checks/bidi.ts';
import { ltrFieldKind } from '../src/page/checks/inputs.ts';

const texts = (s: string, tel = false) => findLtrIslands(s, { telContext: tel }).map((i) => i.text);

describe('findLtrIslands', () => {
  it.each([
    ['اتصل بنا على +974 5555 1234 اليوم', ['+974 5555 1234']],
    ['رقم ٥٥٥٥ ١٢٣٤ هنا', ['٥٥٥٥ ١٢٣٤']],
    ['رقم الطلب: #A-1029 جاهز', ['#A-1029']],
    ['تعلم C++ اليوم', ['C++']],
    ['استدع print() أولا', ['print()']],
    ['C# و .NET', ['C#', '.NET']],
    ['قطر +974', ['+974']],
    ['البريد info@doha.qa للتواصل', ['info@doha.qa']],
    ['استخدم Node.js.', ['Node.js']],
    ['الرابط https://doha.qa/ar/ هنا', ['https://doha.qa/ar/']],
    ['نسخة v2.1.0-beta متاحة', ['v2.1.0-beta']],
  ])('finds the run in %s', (text, expected) => {
    expect(texts(text)).toEqual(expected);
  });

  it.each([
    ['plain Arabic', 'مرحبا بكم في الدوحة'],
    ['one Latin word', 'شاشة OLED جديدة'],
    ['a word in brackets', 'ملف (PDF) جديد'],
    ['a year range', 'من 2020-2024 فقط'],
    ['a Hijri year range', 'الأعوام 1445-1446 هجرية'],
    ['a number range', 'من 10-20 شخصا'],
    ['a price range', 'السعر 1000-5000 ريال'],
    ['a date', 'تاريخ 30/10/2026 للطلب'],
    ['a time', 'الساعة 10:30 صباحا'],
    ['an amount', 'المبلغ 1,250.50 ريال'],
    ['a percentage', 'خصم 20% اليوم'],
    ['a number with a Latin unit', 'سعة 2 GB فقط'],
    ['sentence punctuation after a word', 'استخدم Python.'],
    ['an ISO date', 'تاريخ الوصول 2015-07-19 من المصدر'],
    ['a day-first date', 'آخر تحديث 19-07-2015 من المصدر'],
    ['a handle typed with the @ last so it displays first', 'تابعنا BBCArabic@ الآن'],
  ])('ignores %s', (_label, text) => {
    expect(texts(text)).toEqual([]);
  });

  it('reports offsets into the original string', () => {
    const text = 'اتصل على +974 5555 1234 الآن';
    const [island] = findLtrIslands(text);
    expect(text.slice(island.start, island.end)).toBe('+974 5555 1234');
    expect(island.kind).toBe('phone');
  });

  it('treats digit groups inside a tel: link as a phone number', () => {
    expect(texts('5555-1234')).toEqual([]);
    expect(texts('5555-1234', true)).toEqual(['5555-1234']);
  });
});

describe('isPhoneLike', () => {
  it.each([
    ['+974 5555 1234', true],
    ['+974', true],
    ['00974 5555 1234', true],
    ['800 123 4567', true],
    ['800-123-4567', true],
    ['5555 1234', true],
    ['٥٥٥٥ ١٢٣٤', true],
    ['2020 2024', false],
    ['10-20', false],
    ['1000-5000', false],
    ['30/10/2026', false],
    ['10:30', false],
    ['1,250', false],
  ])('%s -> %s', (text, expected) => {
    expect(isPhoneLike(text)).toBe(expected);
  });
});

describe('latinDigits', () => {
  it('converts Arabic-Indic and Persian digits', () => {
    expect(latinDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(latinDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
  });
});

describe('order helpers', () => {
  it('detects characters that go backwards', () => {
    expect(isOutOfOrder([1, 2, 3])).toBe(false);
    expect(isOutOfOrder([3, 2, 1])).toBe(true);
    expect(isOutOfOrder([1, 2, 2.2, 2.1])).toBe(false);
  });

  it('rebuilds the visual string and draws mirrored brackets', () => {
    const glyphs = [
      { ch: 'p', x: 50 },
      { ch: 't', x: 60 },
      { ch: '(', x: 40 },
      { ch: ')', x: 30 },
    ];
    expect(visualText(glyphs)).toBe('()pt');
  });
});

describe('ltrFieldKind', () => {
  it.each([
    [{ type: 'email' }, 'email'],
    [{ type: 'tel' }, 'tel'],
    [{ type: 'url' }, 'url'],
    [{ type: 'text', inputMode: 'tel' }, 'tel'],
    [{ type: 'text', autocomplete: 'email' }, 'email'],
    [{ type: 'text', autocomplete: 'section-a tel-national' }, 'tel'],
    [{ type: 'text', name: 'mobile_number' }, 'tel'],
    [{ type: 'text', id: 'iban' }, 'text'],
    [{ type: 'text', name: 'full_name' }, null],
    [{ type: 'text', name: 'hotel' }, null],
    [{ type: 'search', name: 'url' }, null],
    [{ type: 'password' }, null],
    [{ type: 'checkbox', name: 'email_opt_in' }, null],
  ])('%j -> %s', (field, kind) => {
    expect(ltrFieldKind(field)).toBe(kind);
  });
});
