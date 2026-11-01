import { lazy, type ComponentType } from 'react';
import type { VizType } from '../goal/types';
import type { VizProps } from './common';

// Each style is its own chunk: a goal page only downloads the one it uses.
const GaugeViz = lazy(() => import('./GaugeViz'));
const RingViz = lazy(() => import('./RingViz'));
const BarViz = lazy(() => import('./BarViz'));
const ThermometerViz = lazy(() => import('./ThermometerViz'));
const LiquidViz = lazy(() => import('./LiquidViz'));
const JourneyViz = lazy(() => import('./JourneyViz'));
const CounterViz = lazy(() => import('./CounterViz'));
const WaffleViz = lazy(() => import('./WaffleViz'));

export interface VizDefinition {
  id: VizType;
  name: string;
  description: string;
  component: ComponentType<VizProps>;
  /** Which per-visualization options the wizard should show. */
  options: ('milestones' | 'ringText' | 'counterMode')[];
}

export const VISUALIZATIONS: VizDefinition[] = [
  { id: 'gauge', name: 'گیج (عقربه‌ای)', description: 'حس سرعت و شتاب؛ مناسب تارگت‌های فروش و عملکرد', component: GaugeViz, options: ['milestones'] },
  { id: 'ring', name: 'حلقه (دونات)', description: 'مینیمال و نمادین؛ درصد در مرکز توجه', component: RingViz, options: ['ringText'] },
  { id: 'bar', name: 'نوار پیشرفت', description: 'ساده و خوانا؛ مناسب نمایش روی تلویزیون و اسلاید', component: BarViz, options: ['milestones'] },
  { id: 'thermometer', name: 'دماسنج', description: 'کلاسیک کمپین‌های جذب سرمایه و خیریه', component: ThermometerViz, options: ['milestones'] },
  { id: 'liquid', name: 'ظرف در حال پر شدن', description: 'موج زنده‌ی مایع؛ حس «پر کردن جام» تیمی', component: LiquidViz, options: [] },
  { id: 'journey', name: 'مسیر و ایستگاه‌ها', description: 'سفر تیم از ایستگاه‌ها تا مقصد؛ مناسب اهداف مرحله‌ای', component: JourneyViz, options: ['milestones'] },
  { id: 'counter', name: 'شمارنده‌ی بزرگ', description: 'تمرکز روی خود عدد با ارقام چرخان', component: CounterViz, options: ['counterMode'] },
  { id: 'waffle', name: 'صد مروارید', description: 'هر مروارید ۱٪؛ پیشرفت قابل شمارش و ملموس', component: WaffleViz, options: [] },
];

export const vizById = (id: VizType) => VISUALIZATIONS.find((v) => v.id === id) ?? VISUALIZATIONS[0];
