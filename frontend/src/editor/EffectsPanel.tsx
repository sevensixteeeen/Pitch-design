// S16 text effects: a shadow (colour, distance, direction, blur, opacity) and an outline (colour,
// thickness), for every selected text box. Sliders change the text live and make one undo step when
// let go. The shadow is stored as an x / y offset; distance and direction are how it's shown here.
import { Sparkles } from "lucide-react";
import type { TextElement, TextShadow } from "../lib/document";
import { IconButton } from "../components/ui/Button";
import { Checkbox, Slider } from "../components/ui/inputs";
import { Popover } from "../components/ui/overlays";
import { ColorButton } from "./ColorPicker";
import { styleText } from "./commands";
import type { EditorStore } from "./store";

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Distance (px) and direction (degrees, 0 = to the right, 90 = down) of a shadow's offset. */
function polar(sh: TextShadow) {
  const distance = Math.hypot(sh.offset_x, sh.offset_y);
  const direction = distance === 0 ? 45 : (Math.round((Math.atan2(sh.offset_y, sh.offset_x) * 180) / Math.PI) + 360) % 360;
  return { distance: Math.round(distance), direction };
}

function offset(distance: number, direction: number) {
  const a = (direction * Math.PI) / 180;
  return { offset_x: r1(Math.cos(a) * distance), offset_y: r1(Math.sin(a) * distance) };
}

export function EffectsButton({ store, texts }: { store: EditorStore; texts: TextElement[] }) {
  const first = texts[0];
  const live = { gesture: true };
  const end = () => store.getState().endGesture();
  const sh = first.shadow ?? null;
  const ol = first.outline ?? null;
  const shadowFor = (el: TextElement): TextShadow => ({ color: "#000000", blur: r1(el.font_size * 0.15), opacity: 0.4, ...offset(r1(el.font_size * 0.08), 45) });
  const setShadow = (change: Partial<TextShadow>, opts = {}) =>
    void styleText(store, (el) => ({ shadow: { ...(el.shadow ?? shadowFor(el)), ...change } }), opts);
  const { distance, direction } = sh ? polar(sh) : { distance: 0, direction: 45 };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <IconButton label="Effects" size="sm" pressed={!!(sh || ol)}>
          <Sparkles strokeWidth={1.75} aria-hidden />
        </IconButton>
      </Popover.Trigger>
      <Popover.Content label="Effects" align="center" className="flex w-72 flex-col gap-4">
        <section className="flex flex-col gap-3">
          <Checkbox label="Shadow" checked={!!sh} onChange={(on) => void styleText(store, (el) => ({ shadow: on ? shadowFor(el) : null }))} />
          {sh && (
            <div className="flex flex-col gap-3 pl-6">
              <div className="flex items-center gap-2 text-xs">
                <ColorButton
                  label="Shadow colour"
                  value={sh.color}
                  onPick={(c) => c && setShadow({ color: c })}
                  onLive={(c) => setShadow({ color: c }, live)}
                  onLiveEnd={end}
                />
                Colour
              </div>
              <Slider label="Distance" unit=" px" min={0} max={100} value={distance} onChange={(v) => setShadow(offset(v, direction), live)} onCommit={end} />
              <Slider label="Direction" unit="°" min={0} max={355} step={5} value={direction} onChange={(v) => setShadow(offset(distance, v), live)} onCommit={end} />
              <Slider label="Blur" unit=" px" min={0} max={100} value={Math.round(sh.blur)} onChange={(v) => setShadow({ blur: v }, live)} onCommit={end} />
              <Slider label="Opacity" unit=" %" min={0} max={100} value={Math.round(sh.opacity * 100)} onChange={(v) => setShadow({ opacity: v / 100 }, live)} onCommit={end} />
            </div>
          )}
        </section>
        <section className="flex flex-col gap-3 border-t border-border pt-4">
          <Checkbox
            label="Outline"
            checked={!!ol}
            onChange={(on) => void styleText(store, (el) => ({ outline: on ? { color: "#000000", width: Math.max(1, r1(el.font_size * 0.04)) } : null }))}
          />
          {ol && (
            <div className="flex flex-col gap-3 pl-6">
              <div className="flex items-center gap-2 text-xs">
                <ColorButton
                  label="Outline colour"
                  value={ol.color}
                  onPick={(c) => c && void styleText(store, (el) => ({ outline: { ...(el.outline ?? ol), color: c } }))}
                  onLive={(c) => void styleText(store, (el) => ({ outline: { ...(el.outline ?? ol), color: c } }), live)}
                  onLiveEnd={end}
                />
                Colour
              </div>
              <Slider
                label="Thickness"
                unit=" px"
                min={0.5}
                max={20}
                step={0.5}
                value={ol.width}
                onChange={(v) => void styleText(store, (el) => ({ outline: { ...(el.outline ?? ol), width: v } }), live)}
                onCommit={end}
              />
            </div>
          )}
        </section>
      </Popover.Content>
    </Popover.Root>
  );
}
