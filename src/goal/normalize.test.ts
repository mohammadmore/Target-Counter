import { describe, expect, it } from 'vitest';
import { normalizeConfig, safeAssetUrl } from './normalize';
import { createDefaultConfig, PALETTES } from './presets';
import { contrastIssues } from './quality';

describe('normalizeConfig', () => {
  it('maps the legacy null config to the original Kiyan design', () => {
    const cfg = normalizeConfig(null);
    expect(cfg.background.image).toBe('builtin:kiyan');
    expect(cfg.languages).toEqual(['fa', 'ar']);
    expect(cfg.texts.fa.vizLabel).toBe('سفیر مروارید');
    expect(cfg.theme.mode).toBe('dark'); // unchanged look until an admin opts in
    expect(cfg.features.editorButton).toBe(true);
  });

  it('migrates single-palette configs without changing their look', () => {
    const gold = PALETTES[0].dark;
    const preset = normalizeConfig({ theme: { paletteId: 'gold', palette: gold } });
    expect(preset.theme.mode).toBe('dark');
    expect(preset.theme.palettes.dark).toEqual(gold);
    expect(preset.theme.palettes.light).toEqual(PALETTES[0].light);

    const lightCustom = { ...PALETTES[7].light, primary: '#0f766e' };
    const custom = normalizeConfig({ theme: { paletteId: 'custom', palette: lightCustom } });
    expect(custom.theme.mode).toBe('light');
    expect(custom.theme.palettes.light).toEqual(lightCustom);
    expect(contrastIssues(custom.theme.palettes.dark)).toEqual([]); // derived counterpart is readable
  });

  it('round-trips a valid config unchanged', () => {
    const cfg = createDefaultConfig();
    cfg.visualization.type = 'liquid';
    cfg.theme.palettes.dark.primary = '#123456';
    expect(normalizeConfig(JSON.parse(JSON.stringify(cfg)))).toEqual(cfg);
  });

  it('repairs invalid or hostile values', () => {
    const cfg = normalizeConfig({
      languages: ['xx', 'en'],
      defaultLang: 'fa',
      visualization: { type: 'pie-3d', milestones: 99 },
      theme: { mode: 'sepia', palettes: { dark: { primary: 'red; background:url(//evil)' } }, font: { id: 'comic-sans' } },
      background: { type: 'image', image: 'javascript:alert(1)', overlay: 5 },
      logo: '"><script>',
      texts: { fa: { title: 42 } },
    });
    expect(cfg.languages).toEqual(['en']);
    expect(cfg.defaultLang).toBe('en');
    expect(cfg.visualization.type).toBe('gauge');
    expect(cfg.visualization.milestones).toBe(10);
    expect(cfg.theme.palettes.dark.primary).toBe(createDefaultConfig().theme.palettes.dark.primary);
    expect(cfg.theme.mode).toBe('both');
    expect(cfg.theme.font.id).toBe('vazirmatn');
    expect(cfg.background.type).toBe('glow');
    expect(cfg.background.overlay).toBe(1);
    expect(cfg.logo).toBe('');
    expect(typeof cfg.texts.fa.title).toBe('string');
  });
});

describe('safeAssetUrl', () => {
  it('only allows our uploads, builtins and https', () => {
    expect(safeAssetUrl('uploads/image-abc.png')).toBe('uploads/image-abc.png');
    expect(safeAssetUrl('builtin:kiyan')).toBe('builtin:kiyan');
    expect(safeAssetUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(safeAssetUrl('http://example.com/a.jpg')).toBe('');
    expect(safeAssetUrl('uploads/../api.php')).toBe('');
    expect(safeAssetUrl('https://x.com/a.jpg) ; background:url(evil')).toBe('');
  });
});
