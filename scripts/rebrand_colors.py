"""One-shot palette remap for App.jsx.

The tool was authored as a dark-theme app and later recoloured onto a white
background, which left every muted text colour far too light (help text sat at
1.6:1 contrast) and the dark-green borders reading as black hairlines. This maps
the leftover palette onto Castillo's brand colours at WCAG-AA contrast.

Colour literals only — no logic, no numbers, no JSX structure is touched.
Replacements are applied longest-key-first so alpha variants (#4a9eff44) are
matched before their base colour (#4a9eff).
"""
import re
import sys
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "src/App.jsx")

MAPPING = {
    # ── neutral text ramp: body > secondary > label > help, all >= 4.5:1 on white
    "#333333": "#333132",   # body            near-black (brand)
    "#666666": "#4d4d4f",   # secondary       dark gray (brand)
    "#999999": "#5f6165",   # labels          was 2.85:1
    "#cccccc": "#6d6f73",   # help text       was 1.61:1 (invisible)
    "#aaaaaa": "#6d6f73",

    # ── brand red replaces the generic accent red
    "#cc0000": "#ad1f2b",
    # existing-ground chart line was #cc2222 — nearly identical to the TOP line.
    # Give it the neutral so ground vs. tube reads at a glance.
    "#cc2222": "#4d4d4f",

    # ── failures / violations -> Castillo FAIL red
    "#ff4444": "#e12a3f", "#ff444433": "#e12a3f33", "#ff444455": "#e12a3f55",
    "#ff6644": "#e12a3f", "#ff664466": "#e12a3f66",
    "#ff8888": "#e12a3f",

    # ── pass / ok -> Castillo PASS green (neon leftovers)
    "#00e5a0": "#278747", "#00e5a033": "#27874733", "#00e5a044": "#27874744",
    "#00e5a066": "#27874766", "#00e5a077": "#27874777",
    "#00aa44": "#278747", "#155a30": "#278747",

    # ── data-series colours, darkened for text legibility on white
    "#e8a838": "#b5820f", "#e8a83844": "#b5820f44", "#e8a83866": "#b5820f66",
    "#c8941c": "#b5820f", "#cc8800": "#b5820f",
    "#4a9eff": "#2f7fd4", "#4a9eff33": "#2f7fd433", "#4a9eff44": "#2f7fd444",
    "#4a9eff55": "#2f7fd455",
    "#00b8ff": "#1f6fd0",
    "#ff8844": "#c2571c", "#ff884466": "#c2571c66",
    "#cc88ff": "#7b4bb5", "#cc88ff88": "#7b4bb588",

    # ── borders / rules: dark-green leftovers -> brand light gray
    "#1e4030": "#bcbec0",
    "#0f2a1a": "#e2e3e5",
    "#0a1a10": "#eceded",
    "#c8d8cf": "#bcbec0",
    "#dde8e2": "#e2e3e5",
    "#5a1515": "#e12a3f",
    "#111111": "#ffffff",   # toggle knob on a coloured track
}


def main() -> int:
    text = SRC.read_text(encoding="utf-8")
    original = text

    for key in sorted(MAPPING, key=len, reverse=True):
        text = re.sub(re.escape(key), MAPPING[key], text, flags=re.IGNORECASE)

    # Root container declared near-white TEXT on a white background — every
    # element that did not set its own colour was invisible.
    text = text.replace(
        'minHeight:"100vh",background:"#ffffff",color:"#f5f5f5"',
        'minHeight:"100vh",background:"#ffffff",color:"#333132"',
    )

    # Header: dark-green gradient carrying red text (~2.5:1). Castillo red banner
    # with white text, matching the structural tool's header.
    text = text.replace(
        'background:"linear-gradient(135deg,#0a1f14,#061209)",borderBottom:"1px solid #bcbec0"',
        'background:"#ad1f2b",borderBottom:"1px solid #8e1922"',
    )

    SRC.write_text(text, encoding="utf-8")
    remaining = sorted(set(re.findall(r"#[0-9a-fA-F]{3,8}", text)))
    print(f"rewrote {SRC} ({len(original)} -> {len(text)} chars)")
    print("palette now:", " ".join(remaining))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
