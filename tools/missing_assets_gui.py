#!/usr/bin/env python3
"""Small tkinter front end for the missing-asset report, with persistent ticks."""
import json
import tkinter as tk
from pathlib import Path
from tkinter import ttk

import missing_assets

TICKS = Path.home() / ".config" / "nuclearism" / "missing_assets_ticks.json"


def load_ticks():
    try:
        return json.loads(TICKS.read_text())
    except (OSError, ValueError):
        return {}


def save_ticks(ticks):
    TICKS.parent.mkdir(parents=True, exist_ok=True)
    TICKS.write_text(json.dumps(ticks, indent=2))


class App:
    def __init__(self, root):
        self.root = root
        root.title("Nuclearism — missing assets")
        root.geometry("780x660")
        self.ticks = load_ticks()
        self.keys = []

        bar = ttk.Frame(root, padding=6)
        bar.pack(fill="x")
        self.count = ttk.Label(bar, text="")
        self.count.pack(side="left")
        ttk.Button(bar, text="Refresh", command=self.rebuild).pack(side="right")

        canvas = tk.Canvas(root, highlightthickness=0)
        scroll = ttk.Scrollbar(root, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=scroll.set)
        scroll.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)
        self.body = ttk.Frame(canvas)
        canvas.create_window((0, 0), window=self.body, anchor="nw")
        self.body.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.bind_all("<MouseWheel>", lambda e: canvas.yview_scroll(int(-e.delta / 120), "units"))

        self.rebuild()

    def heading(self, text, row):
        ttk.Label(self.body, text=text, font=("TkDefaultFont", 11, "bold")).grid(
            row=row, column=0, columnspan=2, sticky="w", pady=(12, 4))

    def row(self, key, label, detail, row):
        var = tk.BooleanVar(value=bool(self.ticks.get(key)))
        var.trace_add("write", lambda *_: self.toggle(key, var))
        self.keys.append(key)
        ttk.Checkbutton(self.body, text=label, variable=var).grid(row=row, column=0, sticky="w")
        ttk.Label(self.body, text=detail, foreground="gray").grid(row=row, column=1, sticky="w", padx=(12, 0))

    def toggle(self, key, var):
        self.ticks[key] = bool(var.get())
        save_ticks(self.ticks)
        self.update_count()

    def update_count(self):
        done = sum(bool(self.ticks.get(k)) for k in self.keys)
        self.count.configure(text=f"Ticked off: {done} / {len(self.keys)}")

    def rebuild(self):
        for child in self.body.winfo_children():
            child.destroy()
        self.keys = []
        try:
            data = missing_assets.load()
        except SystemExit as e:
            ttk.Label(self.body, text=str(e)).grid(row=0, column=0)
            return
        no_model, no_icon = missing_assets.find_missing(data)

        self.heading(f"Workbenches missing a model ({len(no_model)})", 0)
        row = 1
        for m in no_model:
            self.row("workbench:" + m["id"], f"{m['id']} — {m['name']}", m["model"] or "<none>", row)
            row += 1

        self.heading(f"Items with no texture-backed icon ({len(no_icon)})", row)
        row += 1
        for i, kind, path in no_icon:
            self.row("item:" + i["id"], f"{i['id']} — {i['name']}", f"{kind}: {path}", row)
            row += 1
        self.update_count()


if __name__ == "__main__":
    App(tk.Tk()).root.mainloop()
