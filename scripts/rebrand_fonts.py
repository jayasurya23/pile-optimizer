"""Set the brand typeface on UI chrome while keeping data tables monospaced.

Jost is the Castillo brand face and matches the structural tool. Columns of
numbers still read better in a mono face, so the six data tables are pinned to
DM Mono explicitly (the SVG charts already set it themselves).
"""
from pathlib import Path

SRC = Path("src/App.jsx")
text = SRC.read_text(encoding="utf-8")

ROOT_OLD = "fontFamily:\"'DM Mono','Fira Mono',monospace\""
ROOT_NEW = "fontFamily:\"'Jost',system-ui,sans-serif\""
assert text.count(ROOT_OLD) == 1, f"expected 1 root font decl, found {text.count(ROOT_OLD)}"
text = text.replace(ROOT_OLD, ROOT_NEW, 1)

TABLE_OLD = '<table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>'
TABLE_NEW = ('<table style={{width:"100%",borderCollapse:"collapse",fontSize:11,'
             'fontFamily:"\'DM Mono\',monospace"}}>')
count = text.count(TABLE_OLD)
text = text.replace(TABLE_OLD, TABLE_NEW)

SRC.write_text(text, encoding="utf-8")
print(f"root font -> Jost; {count} data tables pinned to DM Mono")
