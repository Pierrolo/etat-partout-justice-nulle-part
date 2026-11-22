#!/usr/bin/env python3
"""Dump every sheet of the downloaded workbooks (xlsx via openpyxl, xls via xlrd)
to CSV (values only, no macro/formula execution) and print a structural summary.
Usage: python3 -I dump_workbooks.py <raw_donnees_dir> <out_csv_dir>"""
import sys, os, csv, re
import openpyxl, xlrd
src, out = sys.argv[1], sys.argv[2]
def slug(s): return re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")[:60]
for f in sorted(os.listdir(src)):
    p = os.path.join(src, f)
    base = slug(os.path.splitext(f)[0])
    d = os.path.join(out, base); os.makedirs(d, exist_ok=True)
    print("=====", f)
    if f.endswith(".xlsx"):
        wb = openpyxl.load_workbook(p, data_only=True, read_only=False)
        for ws in wb.worksheets:
            rows = [[("" if c is None else c) for c in r] for r in ws.iter_rows(values_only=True)]
            while rows and all(c == "" for c in rows[-1]): rows.pop()
            with open(os.path.join(d, slug(ws.title) + ".csv"), "w", newline="", encoding="utf-8") as fh:
                csv.writer(fh).writerows(rows)
            ncols = max((len(r) for r in rows), default=0)
            print(f"  sheet '{ws.title}': {len(rows)} rows x {ncols} cols, state={ws.sheet_state}")
    else:
        wb = xlrd.open_workbook(p)
        for ws in wb.sheets():
            rows = [[ws.cell_value(r, c) for c in range(ws.ncols)] for r in range(ws.nrows)]
            with open(os.path.join(d, slug(ws.name) + ".csv"), "w", newline="", encoding="utf-8") as fh:
                csv.writer(fh).writerows(rows)
            print(f"  sheet '{ws.name}': {ws.nrows} rows x {ws.ncols} cols")
