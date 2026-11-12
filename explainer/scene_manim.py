"""Manim version of the BMAD vs LEAN explainer, synced to narration/timings.json.
Render: manim -qm scene_manim.py Explainer ; then mux with narration/all.wav (see build_manim.sh)."""
import json, re, textwrap
from contextlib import contextmanager
from pathlib import Path
from manim import *

TM = json.loads((Path(__file__).parent / "narration" / "timings.json").read_text())
SEGS = {s["id"]: s for s in TM["segments"]}
config.background_color = "#14161e"
FG="#ebeef5"; DIM="#8a92a3"; ACC="#ffd166"; BLU="#4cc9f0"; RED="#ef476f"; GRN="#06d6a0"; PANEL="#222634"
F="DejaVu Sans"; FM="DejaVu Sans Mono"

def tx(s, fs=22, c=FG, bold=False, mono=False):
    if "\n" in s: return VGroup(*[tx(l, fs, c, bold, mono) for l in s.split("\n")]).arrange(DOWN, buff=0.12)
    return Text(s, font=FM if mono else F, font_size=fs, color=c, weight=BOLD if bold else NORMAL)
def bx(label, w, h, col=BLU, fs=20, sub=None, c=FG):
    r = RoundedRectangle(width=w, height=h, corner_radius=0.12, stroke_color=col, stroke_width=3, fill_color=PANEL, fill_opacity=1)
    t = VGroup(*[tx(l, fs, c, True) for l in label.split("\n")]).arrange(DOWN, buff=0.08) if "\n" in label else tx(label, fs, c, True)
    if sub:
        t2 = tx(sub, max(12, int(fs*0.7)), DIM)
        g = VGroup(t, t2).arrange(DOWN, buff=0.1)
    else: g = t
    g.move_to(r)
    return VGroup(r, g)
def arr(a, b, col=DIM, **k): return Arrow(a, b, buff=0, color=col, stroke_width=4, max_tip_length_to_length_ratio=0.25, **k)
def title(s, c=ACC): return tx(s, 30, c, True).to_corner(UL, buff=0.4)

def chunks(seg):
    sents = [x for x in re.split(r'(?<=[.:;?!])\s+', seg["text"]) if x]
    parts = []
    for s in sents: parts += [s] if len(s) < 110 else [x for x in re.split(r'(?<=,)\s+', s) if x]
    out = []
    for x in parts:
        if out and len(out[-1]) + len(x) < 80: out[-1] += " " + x
        else: out.append(x)
    return out
CH = {k: chunks(v) for k, v in SEGS.items()}

class Explainer(Scene):
    def mk_caption(self, text):
        ls = textwrap.wrap(text, 66)[:2]
        g = VGroup(*[tx(l, 21) for l in ls]).arrange(DOWN, buff=0.1).move_to(DOWN * 3.45)
        return g
    def caption_update(self, m):
        t = float(self.renderer.time)
        for sid, s in SEGS.items():
            if s["start"] <= t < s["start"] + s["duration"]:
                ch = CH[sid]; tot = sum(len(x) for x in ch)
                q = min(1, (t - s["start"]) / s["speech"]) * tot; acc = 0; idx = len(ch) - 1
                for i, x in enumerate(ch):
                    acc += len(x)
                    if q <= acc: idx = i; break
                if self._ck != (sid, idx):
                    self._ck = (sid, idx); m.become(self.mk_caption(ch[idx]))
                return
    def now(self): return float(self.renderer.time)
    def until(self, t):
        d = t - self.now()
        if d > 1e-3: self.wait(d)
    @contextmanager
    def beat(self, sid):
        s = SEGS[sid]; self.until(s["start"]); self.cur = s
        others = [m for m in self.mobjects if m is not self.cap and m is not self.bar]
        if others: self.play(FadeOut(*others), run_time=0.4)
        yield s
        end = s["start"] + s["duration"]
        if self.now() > end + 0.05: print(f"[overrun] {sid} {self.now()-end:.2f}s")
        self.until(end)
    def at(self, f):
        s = self.cur; self.until(s["start"] + f * s["speech"])

    def construct(self):
        self.bar = Rectangle(width=14.5, height=1.15, stroke_width=0, fill_color="#000000", fill_opacity=0.72).move_to(DOWN * 3.45)
        self._ck = None
        self.cap = tx("", 21).move_to(DOWN * 3.45)
        self.add(self.bar, self.cap)
        self.cap.add_updater(self.caption_update)

        with self.beat("intro"):
            a = tx("BMAD", 80, RED, True).shift(UP * 1.7)
            b = tx("contro", 30, DIM).shift(UP * 0.5)
            c = tx("LEAN", 80, GRN, True).shift(DOWN * 0.8)
            d = tx("Stessa spina dorsale, molto meno peso", 26).shift(DOWN * 2.1)
            self.play(Write(a), run_time=1.0); self.at(0.2); self.play(FadeIn(b), run_time=0.5)
            self.at(0.3); self.play(Write(c), run_time=1.0); self.at(0.6); self.play(FadeIn(d, shift=UP * 0.2), run_time=0.8)

        with self.beat("weight"):
            self.add(title("BMAD v6.12.4"))
            n1 = VGroup(tx("29", 64, RED, True), tx("skill", 22, DIM)).arrange(DOWN, buff=0.25).move_to([-3.2, 2.2, 0])
            n2 = VGroup(tx("~180.000", 56, RED, True), tx("parole di istruzioni", 22, DIM)).arrange(DOWN, buff=0.25).move_to([3.0, 2.2, 0])
            self.at(0.05); self.play(FadeIn(n1, scale=1.4), run_time=0.6)
            self.at(0.15); self.play(FadeIn(n2, scale=1.4), run_time=0.6)
            lab = tx("Catena obbligatoria", 18, BLU).move_to([-5.4, 0.55, 0])
            names = ["PRD", "Architettura", "Epiche &\nStorie", "Sprint\nPlanning", "Build"]
            row = VGroup(*[bx(n, 2.2, 0.95, BLU, 18) for n in names]).arrange(RIGHT, buff=0.5).move_to([0, -0.2, 0])
            self.at(0.3); self.add(lab)
            for i, bb in enumerate(row):
                anims = [FadeIn(bb, shift=RIGHT * 0.3)]
                if i: anims.append(GrowArrow(arr(row[i-1].get_right(), bb.get_left())))
                self.play(*anims, run_time=0.5)
            lab2 = tx("Percorso più leggero accanto", 18, GRN).move_to([-4.4, -1.3, 0])
            row2 = VGroup(*[bx(n, 2.2, 0.8, GRN, 18) for n in ["Spec", "stories.yaml", "Build"]]).arrange(RIGHT, buff=0.5).move_to([-3.0, -2.0, 0])
            self.at(0.8); self.add(lab2)
            for i, bb in enumerate(row2):
                anims = [FadeIn(bb, shift=RIGHT * 0.3)]
                if i: anims.append(GrowArrow(arr(row2[i-1].get_right(), bb.get_left())))
                self.play(*anims, run_time=0.4)

        with self.beat("rewrites"):
            self.add(title("Lo stesso requisito, riscritto 5 volte"))
            labels = ["1  Brief", "2  PRD", "3  epics.md (copiato)", "4  Criteri della storia", "5  Spec di build"]
            boxes = []
            for i, l in enumerate(labels):
                r = RoundedRectangle(width=7.4, height=0.75, corner_radius=0.1, stroke_color=RED if i else BLU, stroke_width=3, fill_color=PANEL, fill_opacity=1)
                t1 = tx(l, 20, FG, True).move_to(r).align_to(r, LEFT).shift(RIGHT * 0.25)
                t2 = tx("FR-7 ...", 18, ACC, mono=True).move_to(r).align_to(r, RIGHT).shift(LEFT * 0.25)
                g = VGroup(r, t1, t2).move_to([-2.6, 2.1 - i * 1.0, 0]); boxes.append(g)
            self.at(0.08); self.play(FadeIn(boxes[0]), run_time=0.5)
            for i in range(1, 5):
                self.at(0.08 + i * 0.15)
                self.play(TransformFromCopy(boxes[i-1], boxes[i]), run_time=0.7)
            side = bx("+ file di contesto\ndell'epica", 3.6, 1.4, RED, 20)
            side.move_to([4.7, 0.1, 0]); self.at(0.85); self.play(FadeIn(side, shift=LEFT * 0.4), run_time=0.7)

        with self.beat("ceremony"):
            self.add(title("Il rituale finale, per ogni documento"))
            doc = bx("PRD · Architettura · UX", 5.0, 0.8, BLU, 18).move_to([-3.8, 2.4, 0])
            self.at(0.05); self.play(FadeIn(doc), run_time=0.5)
            rit = ["registro delle decisioni con te", "subagent di riconciliazione input", "revisori in parallelo", "passata di rifinitura", "report HTML"]
            items = VGroup(*[bx(r, 5.0, 0.6, RED, 16) for r in rit]).arrange(DOWN, buff=0.18).move_to([-3.8, -0.2, 0])
            for i, it in enumerate(items):
                self.at(0.12 + i * 0.1); self.play(FadeIn(it, shift=RIGHT * 0.3), run_time=0.45)
            ep = VGroup(RoundedRectangle(width=5.2, height=2.5, corner_radius=0.12, stroke_color=ACC, stroke_width=3, fill_color=PANEL, fill_opacity=1),)
            ep.move_to([3.9, 1.6, 0])
            content = VGroup(tx("Epiche & Storie", 20, ACC, True), *[tx("[C] per continuare", 18, mono=True) for _ in range(3)]).arrange(DOWN, buff=0.28, aligned_edge=LEFT).move_to(ep)
            self.at(0.6); self.play(FadeIn(ep), run_time=0.4)
            self.play(LaggedStart(*[FadeIn(x) for x in content], lag_ratio=0.25), run_time=1.2)
            oks = VGroup(*[bx("ok?", 0.85, 0.5, RED, 14) for _ in range(5)]).arrange(RIGHT, buff=0.15).move_to([3.9, -0.5, 0])
            self.at(0.82); self.play(LaggedStart(*[FadeIn(o, scale=0.6) for o in oks], lag_ratio=0.15), run_time=1.0)
            self.add(tx("approvazione di ogni singola storia", 18).next_to(oks, DOWN, buff=0.25))

        with self.beat("boiler"):
            self.add(title("Ripetizioni"))
            self.add(tx("Routine di avvio (script, hook, saluto per nome)", 18, FG, True).move_to([-3.3, 2.7, 0]))
            sq = VGroup(*[Square(0.4, stroke_color=RED, stroke_width=2, fill_color=PANEL, fill_opacity=1) for _ in range(26)]).arrange_in_grid(2, 13, buff=0.12).move_to([-1.6, 1.7, 0])
            self.at(0.05); self.play(FadeIn(sq), run_time=0.5)
            self.play(LaggedStart(*[s.animate.set_fill(RED, 0.9) for s in sq], lag_ratio=0.06), run_time=1.6)
            self.add(tx("ripetuta in 26 skill", 20, RED, True).move_to([-5.0, 0.7, 0]))
            self.at(0.38)
            self.add(tx("5 agenti con nome: solo rimandi ad altre skill", 18, FG, True).move_to([-3.0, 0.0, 0]))
            pers = VGroup(*[VGroup(Circle(0.5, stroke_color=BLU, stroke_width=3, fill_color=PANEL, fill_opacity=1), tx(n, 14, FG, True)) for n in ["John", "Mary", "Winston", "Amelia", "Sally"]])
            for p in pers: p[1].move_to(p[0])
            pers.arrange(RIGHT, buff=0.35).move_to([-3.6, -1.0, 0])
            self.play(LaggedStart(*[FadeIn(p, scale=0.5) for p in pers], lag_ratio=0.2), run_time=1.2)
            ars = VGroup(*[arr(p.get_bottom(), p.get_bottom() + DOWN * 0.5) for p in pers])
            self.play(LaggedStart(*[GrowArrow(a) for a in ars], lag_ratio=0.15), run_time=0.8)
            self.add(tx("→ altre skill", 16, DIM).move_to([-6.0, -2.15, 0]))
            self.at(0.72)
            self.add(tx("Prompt dei revisori", 18, FG, True).move_to([4.6, 0.0, 0]))
            cp = VGroup(*[bx(f"copia {i+1}", 1.3, 1.0, ACC, 14) for i in range(3)]).arrange(RIGHT, buff=0.2).move_to([4.6, -1.0, 0])
            self.play(LaggedStart(*[TransformFromCopy(cp[0], c) for c in cp], lag_ratio=0.3), run_time=1.0)
            self.add(tx("≠  ≠   fuori sincrono", 20, RED, True).move_to([4.6, -2.2, 0]))

        with self.beat("keep"):
            self.add(title("Il nucleo da tenere", GRN))
            cards = [("1", "Cosa · Come · Fare", "file su disco\ncome passaggi\ndi consegne"), ("2", "Intento dall'utente", "ogni inferenza\nmarcata [ASSUMPTION]"), ("3", "Architettura = invarianti", "Binds / Prevents / Rule")]
            for i, (n, h, s) in enumerate(cards):
                r = RoundedRectangle(width=4.0, height=4.0, corner_radius=0.2, stroke_color=GRN, stroke_width=3, fill_color=PANEL, fill_opacity=1)
                num = tx(n, 54, GRN, True).move_to(r.get_top() + DOWN * 0.8)
                hh = tx(h, 19, FG, True).next_to(num, DOWN, buff=0.5)
                ss = tx(s, 17, DIM).next_to(hh, DOWN, buff=0.4)
                g = VGroup(r, num, hh, ss).move_to([-4.4 + i * 4.4, -0.0, 0])
                self.at(0.05 + i * 0.3); self.play(GrowFromCenter(g), run_time=0.8)

        with self.beat("keep2"):
            self.add(title("...e ancora, dal nucleo", GRN))
            it = [("Spec di build piccole", "intento congelato + gate sulle domande aperte"), ("Subagent nuovo", "implementa dalla sola spec"), ("3 revisori ciechi in parallelo", "poi triage"), ("Triage", "intent_gap · bad_spec · patch · defer"), ("Controllo di prontezza", "prima di costruire"), ("Registro del rinviato + cambi", "deferred.md, lean-change")]
            for i, (a, b) in enumerate(it):
                r = RoundedRectangle(width=6.3, height=1.3, corner_radius=0.14, stroke_color=GRN, stroke_width=3, fill_color=PANEL, fill_opacity=1)
                t1 = tx(a, 20, FG, True); t2 = tx(b, 15, DIM)
                tt = VGroup(t1, t2).arrange(DOWN, buff=0.15, aligned_edge=LEFT).move_to(r).align_to(r, LEFT).shift(RIGHT * 0.3)
                g = VGroup(r, tt).move_to([-3.4 + (i % 2) * 6.8, 1.9 - (i // 2) * 1.7, 0])
                self.at(0.04 + i * 0.13); self.play(FadeIn(g, shift=UP * 0.25), run_time=0.6)

        with self.beat("flow"):
            self.add(title("LEAN: 7 skill", GRN))
            spec = [("lean-intent", "SPEC.md"), ("lean-architecture", "ARCHITECTURE.md"), ("lean-plan", "stories.yaml"), ("lean-build ×N", "spec + codice")]
            xs = [-4.55, -1.5, 1.55, 4.6]; y = 1.6
            idea = tx("idea", 22, DIM, True).move_to([-6.6, y, 0]); self.at(0.02); self.add(idea)
            boxes = []
            for i, (a, b) in enumerate(spec):
                r = RoundedRectangle(width=2.7, height=1.3, corner_radius=0.14, stroke_color=GRN if i != 1 else DIM, stroke_width=3, fill_color=PANEL, fill_opacity=1)
                g = VGroup(r, VGroup(tx(a, 17, FG, True), tx(b, 15, ACC, mono=True)).arrange(DOWN, buff=0.15).move_to(r)).move_to([xs[i], y, 0])
                boxes.append(g)
                self.at(0.1 + i * 0.12)
                prev = idea.get_right() + RIGHT * 0.05 if i == 0 else boxes[i-1].get_right()
                self.play(GrowArrow(arr(prev, g.get_left())), FadeIn(g, shift=RIGHT * 0.3), run_time=0.6)
            self.at(0.45); self.add(tx("opzionale per lavori piccoli", 14, DIM).next_to(boxes[1], DOWN, buff=0.12))
            chg = bx("lean-change", 3.7, 1.2, BLU, 20, "cambi + retrospettive").move_to([-4.6, -1.2, 0])
            rev = bx("lean-review", 3.7, 1.2, BLU, 20, "revisioni + lenti").move_to([0, -1.2, 0])
            kit = bx("lean-kit", 3.7, 1.2, BLU, 20, "regole condivise").move_to([4.6, -1.2, 0])
            self.at(0.65)
            p1 = Line(boxes[3].get_bottom(), [4.6, -0.1, 0], color=DIM, stroke_width=4); p2 = Line([4.6, -0.1, 0], [-4.6, -0.1, 0], color=DIM, stroke_width=4)
            p3 = arr([-4.6, -0.1, 0], chg.get_top())
            self.play(Create(p1), Create(p2), GrowArrow(p3), FadeIn(chg), run_time=1.2)
            self.at(0.8); self.play(FadeIn(rev, shift=UP * 0.2), FadeIn(kit, shift=UP * 0.2), run_time=0.8)

        with self.beat("replaces"):
            self.add(title("Che cosa sostituisce cosa", GRN))
            rows = [("brief · PRD · spec · PRFAQ · forge-idea · UX", "lean-intent"), ("epiche · sprint planning · readiness", "lean-plan"), ("build · build-auto", "lean-build  (--auto)"), ("review · code-review · prompt revisori", "lean-review  (1 sola copia)"), ("correct-course · retrospettiva", "lean-change")]
            for i, (a, b) in enumerate(rows):
                y = 2.3 - i * 1.0
                L = VGroup(RoundedRectangle(width=7.2, height=0.8, corner_radius=0.1, stroke_color=RED, stroke_width=2, fill_color=PANEL, fill_opacity=1), tx(a, 17)).move_to([-3.1, y, 0])
                L[1].move_to(L[0])
                R = VGroup(RoundedRectangle(width=4.8, height=0.8, corner_radius=0.1, stroke_color=GRN, stroke_width=3, fill_color=PANEL, fill_opacity=1), tx(b, 20, GRN, True)).move_to([4.2, y, 0])
                R[1].move_to(R[0])
                self.at(0.05 + i * 0.17)
                self.play(FadeIn(L), run_time=0.4)
                self.play(TransformFromCopy(L, R), run_time=0.8)

        with self.beat("plan"):
            self.add(title("Pianificare con meno copie", GRN))
            it = [("Storie → ID dei requisiti", "niente copie del testo"), ("Elenco storie approvato in un solo passaggio", "non una per una"), ("Stato = campo in stories.yaml", "niente sprint-status, niente script"), ("Checkpoint sulla spec di build", "solo quando serve")]
            copies = VGroup(*[bx("FR-7 ...", 2.4, 0.5, RED, 14) for _ in range(5)])
            for i, c in enumerate(copies): c.move_to([4.9, 2.4 - i * 0.62, 0])
            self.at(0.03); self.play(LaggedStart(*[FadeIn(c) for c in copies], lag_ratio=0.15), run_time=1.0)
            one = bx("FR-7", 2.4, 0.7, GRN, 18, c=ACC).move_to([4.9, 1.2, 0])
            for i, (a, b) in enumerate(it):
                dot = VGroup(Circle(0.2, color=GRN, fill_opacity=1, stroke_width=0), tx("✓", 18, "#14161e", True)); dot[1].move_to(dot[0])
                tt = VGroup(tx(a, 22, FG, True), tx(b, 17, DIM)).arrange(DOWN, buff=0.12, aligned_edge=LEFT)
                g = VGroup(dot, tt).arrange(RIGHT, buff=0.3, aligned_edge=UP).move_to([-3.0, 2.2 - i * 1.4, 0]).align_to([-6.6, 0, 0], LEFT)
                self.at(0.05 + i * 0.2)
                if i == 0:
                    self.play(FadeIn(g, shift=RIGHT * 0.3), ReplacementTransform(copies, one), run_time=1.2)
                    sts = VGroup(*[bx(f"storia {k}", 1.1, 0.5, BLU, 13) for k in "ABC"]).arrange(RIGHT, buff=0.15).move_to([4.9, -0.8, 0])
                    self.play(FadeIn(sts), *[GrowArrow(arr(s.get_top(), one.get_bottom() + DOWN * 0.05 + RIGHT * (k-1) * 0.4)) for k, s in enumerate(sts)], run_time=0.8)
                else: self.play(FadeIn(g, shift=RIGHT * 0.3), run_time=0.6)

        with self.beat("orch"):
            self.add(title("Orchestratore e costi", GRN))
            sl = 0.65; cx = -3.8
            def layer(y1, y2, col):
                h1 = (3.0 - y1) * sl; h2 = (3.0 - y2) * sl
                return Polygon([cx - h1, y1, 0], [cx + h1, y1, 0], [cx + h2, y2, 0], [cx - h2, y2, 0], stroke_color=col, stroke_width=3, fill_color=PANEL, fill_opacity=1)
            top = layer(3.0, 1.6, ACC); mid = layer(1.5, 0.1, BLU); low = layer(0.0, -1.4, GRN)
            tl = [tx("Opus", 20, ACC, True).move_to([cx, 2.1, 0]), tx("Sonnet", 20, BLU, True).move_to([cx, 0.8, 0]), tx("Haiku", 20, GRN, True).move_to([cx, -0.7, 0])]
            ds = [tx("orchestra · triage · decide · parla con te", 17), tx("implement · review · check · research", 17), tx("scout: esplorazione di repo e documenti", 17)]
            for i, d in enumerate(ds): d.move_to([0.4, [2.2, 0.8, -0.7][i], 0]).align_to([0.2, 0, 0], LEFT)
            self.at(0.03)
            self.play(FadeIn(top), FadeIn(tl[0]), run_time=0.6); self.play(FadeIn(d_ := ds[0], shift=LEFT * 0.2), run_time=0.4)
            self.play(FadeIn(mid, shift=UP * 0.3), FadeIn(tl[1]), FadeIn(ds[1], shift=LEFT * 0.2), run_time=0.8)
            self.play(FadeIn(low, shift=UP * 0.3), FadeIn(tl[2]), FadeIn(ds[2], shift=LEFT * 0.2), run_time=0.8)
            self.at(0.5); self.add(tx("Livelli: lean.yaml o modello di sessione", 16, DIM).move_to([-1.4, -1.95, 0]))
            self.at(0.62)
            path = Arrow([cx + 3.0, -0.7, 0], [cx + 2.0, 0.8, 0], color=ACC, buff=0, stroke_width=4)
            path2 = Arrow([cx + 2.0, 0.8, 0], [cx + 1.1, 2.1, 0], color=ACC, buff=0, stroke_width=4)
            dot = Dot([cx + 3.0, -0.7, 0], color=RED, radius=0.14)
            self.add(dot); self.play(MoveAlongPath(dot, Line(dot.get_center(), [cx + 2.0, 0.8, 0])), GrowArrow(path), run_time=0.8)
            self.play(MoveAlongPath(dot, Line(dot.get_center(), [cx + 1.1, 2.1, 0])), GrowArrow(path2), run_time=0.8)
            self.add(tx("fallimento → un livello più su", 16, ACC).move_to([2.9, 2.9, 0]))
            self.at(0.78); self.play(FadeIn(tx("I lavoratori economici generano, il modello costoso giudica", 22, GRN, True).move_to([0, -2.55, 0]), shift=UP * 0.2), run_time=0.8)

        with self.beat("kiss"):
            self.add(title("KISS di default", GRN))
            it = ["Codice più semplice che passa l'accettazione", "Niente astrazioni speculative", "Il revisore caccia l'over-engineering", "Documenti brevi, limiti rigidi"]
            for i, a in enumerate(it):
                g = VGroup(Dot(color=GRN, radius=0.1), tx(a, 20)).arrange(RIGHT, buff=0.25).move_to([-6.6, 2.4 - i * 0.8, 0]).align_to([-6.6, 0, 0], LEFT)
                self.at(0.05 + i * 0.1); self.play(FadeIn(g, shift=RIGHT * 0.3), run_time=0.5)
            rb = RoundedRectangle(width=4.7, height=3.9, corner_radius=0.14, stroke_color=BLU, stroke_width=3, fill_color=PANEL, fill_opacity=1).move_to([4.5, 1.3, 0])
            lines = ["stato: ...", "┌──────┬──────┐", "│ tabella     │", "└──────┴──────┘", "1) domanda  a/b/c", "2) domanda  a/b/c", "risposta: 1a 2b", "Next: ..."]
            rt = VGroup(tx("Risposta all'utente (≤ 12 righe)", 15, BLU, True), *[tx(l, 15, mono=True) for l in lines]).arrange(DOWN, buff=0.14, aligned_edge=LEFT).move_to(rb)
            self.at(0.4); self.play(FadeIn(rb), LaggedStart(*[FadeIn(x) for x in rt], lag_ratio=0.1), run_time=1.5)
            ban = bx("Sporco ≠ non verificato", 10.5, 1.4, ACC, 30, "KISS taglia la rifinitura, mai i controlli").move_to([0, -1.6, 0])
            self.at(0.72); self.play(GrowFromCenter(ban), run_time=0.8)

        with self.beat("lanes"):
            self.add(title("Team in parallelo: corsie e contratti", GRN))
            s0 = RoundedRectangle(width=3.0, height=3.6, corner_radius=0.14, stroke_color=ACC, stroke_width=3, fill_color=PANEL, fill_opacity=1)
            lst = VGroup(tx("Storia 0: contratti", 17, ACC, True), *[tx(t, 14) for t in ["tipi", "1 fake per porta", "fixture vs schema reale", "test di contratto", "test di confine", "walking skeleton"]]).arrange(DOWN, buff=0.17).move_to(s0)
            s0g = VGroup(s0, lst).move_to([-5.3, 0.4, 0]); self.at(0.05); self.play(FadeIn(s0g), run_time=0.7)
            ys = [1.7, 0.4, -0.9]; cnt = [3, 2, 3]; names = "ABC"; lane_groups = []
            for i in range(3):
                bs = VGroup(*[bx(f"{names[i]}{k+1}", 1.2, 0.8, BLU, 18) for k in range(cnt[i])]).arrange(RIGHT, buff=0.45).move_to([0, ys[i], 0]).align_to([-2.4, 0, 0], LEFT)
                lane_groups.append(bs)
            self.at(0.25)
            firsts = [TransformFromCopy(s0g[0], g[0][0]) for g in lane_groups]
            self.play(*firsts, run_time=1.0)
            for i, g in enumerate(lane_groups):
                self.add(tx(f"corsia {names[i]}", 14, DIM).move_to([-3.0, ys[i] + 0.65, 0]))
            self.at(0.32)
            for g in lane_groups: self.add(g[0])
            seq = []
            for g in lane_groups:
                for k in range(1, len(g)):
                    seq += [FadeIn(g[k], shift=RIGHT * 0.2), GrowArrow(arr(g[k-1].get_right(), g[k].get_left()))]
            self.play(LaggedStart(*seq, lag_ratio=0.12), run_time=1.8)
            self.at(0.6)
            ck = DashedLine([3.3, 2.4, 0], [3.3, -1.5, 0], color=GRN, stroke_width=4); ckl = tx("checkpoint\nper giunzione", 14, GRN).move_to([3.3, 2.75, 0])
            ext = bx("uscita:\nfixture\nend to end", 2.0, 1.4, GRN, 14).move_to([5.9, 0.4, 0])
            self.play(Create(ck), FadeIn(ckl), run_time=0.8)
            joins = [arr(g[-1].get_right(), [3.3, g[-1].get_center()[1], 0], col=GRN) for g in lane_groups]
            outs = [arr([3.3, y, 0], ext.get_left() + UP * (y - 0.4) * 0.3, col=GRN) for y in ys]
            self.play(*[GrowArrow(j) for j in joins], FadeIn(ext), *[GrowArrow(o) for o in outs], run_time=1.2)
            self.add(tx("ogni giunzione: owner · regole sui valori · checkpoint", 17, GRN).move_to([0, -2.0, 0]))
            self.at(0.85); self.add(tx("Modellato su un vero epic a 3 corsie, con le correzioni ai problemi visti", 16, ACC).move_to([0, -2.5, 0]))

        with self.beat("close"):
            self.add(title("In numeri", GRN))
            sq = VGroup(*[Square(0.36, stroke_width=0, fill_color=RED, fill_opacity=1) for _ in range(29)]).arrange_in_grid(2, 15, buff=0.1).move_to([-1.5, 2.0, 0])
            n1 = tx("29 skill", 28, RED, True).move_to([5.0, 2.0, 0]); lab = tx("Skill", 22, DIM, True).move_to([-5.4, 2.9, 0])
            self.at(0.03); self.add(lab); self.play(LaggedStart(*[FadeIn(s) for s in sq], lag_ratio=0.03), FadeIn(n1), run_time=1.0)
            self.at(0.2)
            sev = VGroup(*[Square(0.36, stroke_width=0, fill_color=GRN, fill_opacity=1) for _ in range(7)]).arrange(RIGHT, buff=0.1).move_to([-5.3, 2.0, 0]).align_to([-5.8, 0, 0], LEFT)
            n2 = tx("7 skill", 28, GRN, True).move_to([5.0, 2.0, 0])
            self.play(ReplacementTransform(sq, sev), ReplacementTransform(n1, n2), run_time=1.4)
            lab2 = tx("Parole di istruzioni", 22, DIM, True).move_to([-5.0, 0.6, 0]); self.at(0.5); self.add(lab2)
            bar = Rectangle(width=9.0, height=0.5, stroke_width=0, fill_color=RED, fill_opacity=1).move_to([-6.2, -0.2, 0]).align_to([-6.2, 0, 0], LEFT)
            l1 = tx("~180.000", 22, RED, True).next_to(bar, RIGHT, buff=0.2)
            self.play(GrowFromEdge(bar, LEFT), FadeIn(l1), run_time=1.0)
            self.at(0.62)
            bar2 = Rectangle(width=0.8, height=0.5, stroke_width=0, fill_color=GRN, fill_opacity=1).move_to(bar).align_to([-6.2, 0, 0], LEFT)
            l2 = tx("~16.000", 22, GRN, True).next_to(bar2, RIGHT, buff=0.2)
            self.play(ReplacementTransform(bar, bar2), ReplacementTransform(l1, l2), run_time=1.3)
            self.at(0.8); self.play(Write(tx("Stessa spina dorsale, un decimo del peso", 30, ACC, True).move_to([0, -1.6, 0])), run_time=1.0)
        self.cap.clear_updaters()
